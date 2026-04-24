import { useRef, useEffect, useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  useAnnotations,
  type Annotation, type AnnotationLayer, type AnnotationType,
  type Tool, type Point,
  type PenData, type ArrowData, type TextData, type RectData, type PinData,
} from '../hooks/useAnnotations'
import { Button, Modal, FormField, inputStyle, selectStyle } from '../components/ui'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  '#e8611a', '#dc2626', '#2d6fd4', '#2d9e5f',
  '#ca8a04', '#8b5cf6', '#0891b2', '#000000',
  '#ffffff', '#6b7280',
]

const WEIGHTS = [1, 2, 3, 5, 8]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCanvasPoint(e: React.MouseEvent | MouseEvent, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width  / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top)  * scaleY,
  }
}

function dist(a: Point, b: Point) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
}

// ─── Cloud path helper ────────────────────────────────────────────────────────

function drawCloud(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string, weight: number) {
  const x1 = Math.min(from.x, to.x), y1 = Math.min(from.y, to.y)
  const x2 = Math.max(from.x, to.x), y2 = Math.max(from.y, to.y)
  const r  = 10
  const steps = 6

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth   = weight
  ctx.setLineDash([])

  // Top edge - bumpy
  for (let i = 0; i < steps; i++) {
    const cx = x1 + (x2 - x1) * (i + 0.5) / steps
    ctx.arc(cx, y1, r, Math.PI, 0, false)
  }
  // Right edge
  for (let i = 0; i < steps; i++) {
    const cy = y1 + (y2 - y1) * (i + 0.5) / steps
    ctx.arc(x2, cy, r, -Math.PI / 2, Math.PI / 2, false)
  }
  // Bottom edge
  for (let i = steps - 1; i >= 0; i--) {
    const cx = x1 + (x2 - x1) * (i + 0.5) / steps
    ctx.arc(cx, y2, r, 0, Math.PI, false)
  }
  // Left edge
  for (let i = steps - 1; i >= 0; i--) {
    const cy = y1 + (y2 - y1) * (i + 0.5) / steps
    ctx.arc(x1, cy, r, Math.PI / 2, -Math.PI / 2, false)
  }

  ctx.stroke()
}

// ─── Render all annotations to canvas ────────────────────────────────────────

function renderAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  selectedId: string | null,
) {
  annotations.forEach(anno => {
    const isSelected = anno.id === selectedId
    ctx.save()

    if (isSelected) {
      ctx.shadowBlur  = 8
      ctx.shadowColor = '#e8611a'
    }

    switch (anno.type) {
      case 'pen': {
        const d = anno.data as PenData
        if (d.points.length < 2) break
        ctx.beginPath()
        ctx.strokeStyle = d.color
        ctx.lineWidth   = d.weight
        ctx.lineCap     = 'round'
        ctx.lineJoin    = 'round'
        ctx.setLineDash([])
        ctx.moveTo(d.points[0].x, d.points[0].y)
        d.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
        ctx.stroke()
        break
      }

      case 'arrow': {
        const d = anno.data as ArrowData
        const dx = d.to.x - d.from.x
        const dy = d.to.y - d.from.y
        const angle = Math.atan2(dy, dx)
        const headLen = 16

        ctx.strokeStyle = d.color
        ctx.fillStyle   = d.color
        ctx.lineWidth   = d.weight
        ctx.setLineDash([])

        // Line
        ctx.beginPath()
        ctx.moveTo(d.from.x, d.from.y)
        ctx.lineTo(d.to.x, d.to.y)
        ctx.stroke()

        // Arrowhead
        ctx.beginPath()
        ctx.moveTo(d.to.x, d.to.y)
        ctx.lineTo(
          d.to.x - headLen * Math.cos(angle - Math.PI / 6),
          d.to.y - headLen * Math.sin(angle - Math.PI / 6),
        )
        ctx.lineTo(
          d.to.x - headLen * Math.cos(angle + Math.PI / 6),
          d.to.y - headLen * Math.sin(angle + Math.PI / 6),
        )
        ctx.closePath()
        ctx.fill()
        break
      }

      case 'text': {
        const d = anno.data as TextData
        ctx.font         = `${d.fontSize}px 'IBM Plex Sans', sans-serif`
        ctx.fillStyle    = d.color
        ctx.textBaseline = 'top'
        // Background
        const metrics = ctx.measureText(d.text)
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.fillRect(d.origin.x - 3, d.origin.y - 3, metrics.width + 6, d.fontSize + 6)
        ctx.fillStyle = d.color
        ctx.fillText(d.text, d.origin.x, d.origin.y)
        break
      }

      case 'rect': {
        const d = anno.data as RectData
        ctx.strokeStyle = d.color
        ctx.lineWidth   = d.weight
        ctx.setLineDash([])
        const x = Math.min(d.from.x, d.to.x), y = Math.min(d.from.y, d.to.y)
        const w = Math.abs(d.to.x - d.from.x),  h = Math.abs(d.to.y - d.from.y)
        ctx.strokeRect(x, y, w, h)
        break
      }

      case 'cloud': {
        const d = anno.data as RectData
        drawCloud(ctx, d.from, d.to, d.color, d.weight)
        break
      }

      case 'pin': {
        const d   = anno.data as PinData
        const num = anno.pin_number ?? 0

        // Circle
        ctx.beginPath()
        ctx.arc(d.center.x, d.center.y, 14, 0, Math.PI * 2)
        ctx.fillStyle   = d.color
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth   = 2
        ctx.stroke()

        // Number
        ctx.font         = "bold 11px 'Barlow Condensed', sans-serif"
        ctx.fillStyle    = 'white'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(num), d.center.x, d.center.y)
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'alphabetic'

        // Linked badge
        if (anno.linked_module) {
          const badge = anno.linked_module === 'rfi' ? 'RFI' : 'PL'
          const bw = 28
          ctx.fillStyle    = anno.linked_module === 'rfi' ? '#e8611a' : '#dc2626'
          ctx.beginPath()
          ctx.roundRect?.(d.center.x + 10, d.center.y - 20, bw, 14, 3)
          ctx.fill()
          ctx.font      = "bold 8px 'IBM Plex Mono', monospace"
          ctx.fillStyle = 'white'
          ctx.textAlign = 'center'
          ctx.fillText(badge, d.center.x + 10 + bw / 2, d.center.y - 13)
          ctx.textAlign = 'left'
        }
        break
      }
    }

    ctx.restore()
  })
}

// ─── Pin Link Modal ───────────────────────────────────────────────────────────

function PinLinkModal({ open, onClose, onLink, projectId }: {
  open: boolean
  onClose: () => void
  onLink: (module: 'rfi' | 'punch_item', id: string, label: string) => void
  projectId: string
}) {
  const [tab,     setTab]     = useState<'rfi' | 'punch_item'>('rfi')
  const [records, setRecords] = useState<{ id: string; label: string; subject: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const table  = tab === 'rfi' ? 'rfis' : 'punch_items'
    const numCol = tab === 'rfi' ? 'rfi_number' : 'punch_number'
    const subCol = tab === 'rfi' ? 'subject' : 'description'

    supabase.from(table)
      .select(`id, ${numCol}, ${subCol}, status`)
      .eq('project_id', projectId)
      .not('status', 'in', '("closed","void")')
      .order(numCol)
      .then(({ data }) => {
        setRecords((data ?? []).map((r: any) => ({
          id:      r.id,
          label:   r[numCol],
          subject: r[subCol],
        })))
        setLoading(false)
      })
  }, [open, tab, projectId])

  return (
    <Modal open={open} onClose={onClose} title="Link Pin to Record" width={480}
      footer={<Button variant="secondary" onClick={onClose}>Cancel</Button>}
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px', background: '#f3f4f6', borderRadius: '6px', marginBottom: '16px' }}>
        {(['rfi', 'punch_item'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '7px', border: 'none', cursor: 'pointer',
            background: tab === t ? 'white' : 'transparent',
            color: tab === t ? '#0f1923' : '#6b7280',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
            fontWeight: tab === t ? 700 : 400, textTransform: 'uppercase',
            letterSpacing: '0.5px', borderRadius: '4px', transition: 'all 0.15s',
          }}>
            {t === 'rfi' ? 'RFIs' : 'Punch Items'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>
          Loading…
        </div>
      ) : records.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px' }}>
          No open {tab === 'rfi' ? 'RFIs' : 'punch items'} found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
          {records.map(r => (
            <button key={r.id} onClick={() => { onLink(tab, r.id, r.label); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e8611a'; (e.currentTarget as HTMLElement).style.background = '#fef3ec' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.background = 'white' }}
            >
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#e8611a', flexShrink: 0 }}>
                {r.label}
              </span>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.subject}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ─── Text Input Overlay ───────────────────────────────────────────────────────

function TextInputOverlay({ position, color, fontSize, onSubmit, onCancel }: {
  position: { x: number; y: number }
  color: string; fontSize: number
  onSubmit: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div style={{ position: 'absolute', left: position.x, top: position.y, zIndex: 50 }}>
      <input
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && text.trim()) { onSubmit(text.trim()) }
          if (e.key === 'Escape') onCancel()
        }}
        style={{
          padding: '4px 8px', border: `2px solid ${color}`,
          borderRadius: '3px', background: 'rgba(255,255,255,0.95)',
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: `${fontSize}px`, color: color,
          outline: 'none', minWidth: '120px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
        placeholder="Type and press Enter…"
      />
    </div>
  )
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function AnnotationToolbar({ toolState, setToolState, onSaveSet, onClear, saving }: {
  toolState: ReturnType<typeof useAnnotations>['toolState']
  setToolState: ReturnType<typeof useAnnotations>['setToolState']
  onSaveSet: () => void
  onClear: () => void
  saving: boolean
}) {
  const tools: { id: Tool; icon: string; title: string }[] = [
    { id: 'select', icon: '↖', title: 'Select / Pan' },
    { id: 'pen',    icon: '✏', title: 'Freehand Pen' },
    { id: 'arrow',  icon: '→', title: 'Arrow' },
    { id: 'text',   icon: 'T', title: 'Text Label' },
    { id: 'rect',   icon: '□', title: 'Rectangle' },
    { id: 'cloud',  icon: '☁', title: 'Cloud (revision bubble)' },
    { id: 'pin',    icon: '📍', title: 'Pin (link to RFI/Punch)' },
  ]

  return (
    <div style={{
      position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
      display: 'flex', flexDirection: 'column', gap: '4px',
      background: '#0f1923', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '8px', zIndex: 20,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      {/* Tools */}
      {tools.map(t => (
        <button key={t.id} title={t.title}
          onClick={() => setToolState(s => ({ ...s, active: t.id }))}
          style={{
            width: '36px', height: '36px', borderRadius: '5px', border: 'none',
            background: toolState.active === t.id ? '#e8611a' : 'rgba(255,255,255,0.05)',
            color: toolState.active === t.id ? 'white' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer', fontSize: '16px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (toolState.active !== t.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)' }}
          onMouseLeave={e => { if (toolState.active !== t.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
        >
          {t.icon}
        </button>
      ))}

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

      {/* Colors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {[COLORS.slice(0, 5), COLORS.slice(5)].map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: '3px' }}>
            {row.map(c => (
              <button key={c} title={c}
                onClick={() => setToolState(s => ({ ...s, color: c }))}
                style={{
                  width: '14px', height: '14px', borderRadius: '3px',
                  background: c, border: `2px solid ${toolState.color === c ? 'white' : 'transparent'}`,
                  cursor: 'pointer', padding: 0, flexShrink: 0,
                  boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : 'none',
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

      {/* Weight */}
      {['pen', 'arrow', 'rect', 'cloud'].includes(toolState.active) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {WEIGHTS.map(w => (
            <button key={w} title={`Weight ${w}`}
              onClick={() => setToolState(s => ({ ...s, weight: w }))}
              style={{
                width: '36px', height: '20px', border: 'none', borderRadius: '3px',
                background: toolState.weight === w ? 'rgba(232,97,26,0.2)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ height: w, width: '24px', background: toolState.color, borderRadius: '1px' }} />
            </button>
          ))}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
        </div>
      )}

      {/* Save markup set */}
      <button title="Save Markup Set" onClick={onSaveSet}
        style={{ width: '36px', height: '30px', borderRadius: '5px', border: 'none', background: 'rgba(45,158,95,0.15)', color: '#2d9e5f', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        💾
      </button>
    </div>
  )
}

// ─── Layer Panel ──────────────────────────────────────────────────────────────

function LayerPanel({ layers, annotations, onToggle, onClose }: {
  layers: AnnotationLayer[]
  annotations: Annotation[]
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const countByLayer = annotations.reduce((acc, a) => {
    acc[a.layer_id] = (acc[a.layer_id] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{
      position: 'absolute', right: '14px', top: '60px',
      width: '220px', background: '#0f1923',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 20, overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(246,244,241,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          Layers ({layers.length})
        </span>
        <button onClick={onClose} style={{ border: 'none', background: 'none', color: 'rgba(246,244,241,0.3)', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>×</button>
      </div>

      {layers.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(246,244,241,0.3)' }}>
          No layers yet.<br />Start drawing to create one.
        </div>
      ) : layers.map(layer => (
        <div key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Visibility toggle */}
          <button onClick={() => onToggle(layer.id)} style={{
            width: '20px', height: '20px', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '3px', background: layer.is_visible ? '#e8611a' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {layer.is_visible && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: 'rgba(246,244,241,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {layer.name}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(246,244,241,0.3)', marginTop: '2px' }}>
              {countByLayer[layer.id] ?? 0} annotation{countByLayer[layer.id] !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Pin Info Popup ───────────────────────────────────────────────────────────

function PinPopup({ annotation, onDelete, onClose }: {
  annotation: Annotation | null
  onDelete: (id: string) => void
  onClose: () => void
}) {
  if (!annotation || annotation.type !== 'pin') return null
  const d = annotation.data as PinData

  return (
    <div style={{
      position: 'absolute',
      left: (d.center.x / 2) + 60, // rough canvas-to-screen approximation
      top:  (d.center.y / 2) - 80,
      background: '#0f1923',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '6px',
      padding: '12px 14px',
      zIndex: 30,
      minWidth: '200px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#f6f4f1', textTransform: 'uppercase' }}>
          Pin {annotation.pin_number}
        </span>
        <button onClick={onClose} style={{ border: 'none', background: 'none', color: 'rgba(246,244,241,0.4)', cursor: 'pointer', fontSize: '14px' }}>×</button>
      </div>

      {annotation.linked_module && (
        <div style={{ padding: '6px 10px', background: annotation.linked_module === 'rfi' ? 'rgba(232,97,26,0.15)' : 'rgba(220,38,38,0.15)', borderRadius: '4px', marginBottom: '8px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: annotation.linked_module === 'rfi' ? '#e8611a' : '#dc2626', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>
            {annotation.linked_module === 'rfi' ? 'Linked RFI' : 'Linked Punch Item'}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: 'rgba(246,244,241,0.8)', fontWeight: 600 }}>
            {annotation.linked_record_label ?? '—'}
          </div>
        </div>
      )}

      <button onClick={() => { onDelete(annotation.id); onClose() }}
        style={{ width: '100%', padding: '6px', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '4px', background: 'transparent', color: '#f87171', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', transition: 'all 0.15s' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.15)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
      >
        Delete Pin
      </button>
    </div>
  )
}

// ─── Main Annotation Canvas Component ────────────────────────────────────────

interface AnnotationCanvasProps {
  drawingVersionId: string
  projectId: string
  canAnnotate: boolean
  containerWidth: number
  containerHeight: number
}

export default function AnnotationCanvas({
  drawingVersionId, projectId, canAnnotate,
  containerWidth, containerHeight,
}: AnnotationCanvasProps) {
  const { user } = useAuth()
  const {
    layers, annotations, allAnnotations, loading, saving,
    toolState, setToolState,
    saveAnnotation, deleteAnnotation, toggleLayer,
    saveMarkupSet, nextPinNumber,
  } = useAnnotations(drawingVersionId)

  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const [isDrawing,      setIsDrawing]      = useState(false)
  const [currentPoints,  setCurrentPoints]  = useState<Point[]>([])
  const [startPoint,     setStartPoint]     = useState<Point | null>(null)
  const [currentEnd,     setCurrentEnd]     = useState<Point | null>(null)
  const [textPos,        setTextPos]        = useState<Point | null>(null)
  const [selectedAnno,   setSelectedAnno]   = useState<string | null>(null)
  const [hoveredPin,     setHoveredPin]     = useState<Annotation | null>(null)
  const [showLayers,     setShowLayers]     = useState(false)
  const [showPinLink,    setShowPinLink]    = useState(false)
  const [pendingPinPos,  setPendingPinPos]  = useState<Point | null>(null)
  const [showMarkupForm, setShowMarkupForm] = useState(false)
  const [markupName,     setMarkupName]     = useState('')

  // ── Canvas size ──────────────────────────────────────────────────────────

  const CANVAS_W = 2000
  const CANVAS_H = Math.round(CANVAS_W * (containerHeight / containerWidth))

  // ── Redraw ───────────────────────────────────────────────────────────────

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Render saved annotations
    renderAnnotations(ctx, annotations, selectedAnno)

    // Render in-progress stroke
    const { active: tool, color, weight } = toolState

    if (isDrawing) {
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth   = weight
      ctx.lineCap     = 'round'
      ctx.lineJoin    = 'round'

      if (tool === 'pen' && currentPoints.length > 1) {
        ctx.beginPath()
        ctx.setLineDash([])
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y)
        currentPoints.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
        ctx.stroke()
      }

      if ((tool === 'arrow' || tool === 'rect' || tool === 'cloud') && startPoint && currentEnd) {
        ctx.setLineDash([4, 4])
        if (tool === 'arrow') {
          ctx.beginPath()
          ctx.moveTo(startPoint.x, startPoint.y)
          ctx.lineTo(currentEnd.x, currentEnd.y)
          ctx.stroke()
        } else if (tool === 'rect') {
          const x = Math.min(startPoint.x, currentEnd.x)
          const y = Math.min(startPoint.y, currentEnd.y)
          const w = Math.abs(currentEnd.x - startPoint.x)
          const h = Math.abs(currentEnd.y - startPoint.y)
          ctx.strokeRect(x, y, w, h)
        } else {
          ctx.setLineDash([])
          drawCloud(ctx, startPoint, currentEnd, color, weight)
        }
      }

      ctx.restore()
    }
  }, [annotations, selectedAnno, toolState, isDrawing, currentPoints, startPoint, currentEnd])

  useEffect(() => { redraw() }, [redraw])

  // ── Hit-test for pin selection ────────────────────────────────────────────

  function hitTestPin(point: Point): Annotation | null {
    for (const anno of [...annotations].reverse()) {
      if (anno.type !== 'pin') continue
      const d = anno.data as PinData
      if (dist(point, d.center) <= 18) return anno
    }
    return null
  }

  // ── Mouse handlers ───────────────────────────────────────────────────────

  function onMouseDown(e: React.MouseEvent) {
    if (!canAnnotate || !canvasRef.current) return
    const pt = getCanvasPoint(e, canvasRef.current)
    const { active: tool } = toolState

    if (tool === 'select') {
      const pin = hitTestPin(pt)
      if (pin) { setHoveredPin(pin); setSelectedAnno(pin.id) }
      else      { setHoveredPin(null); setSelectedAnno(null) }
      return
    }

    if (tool === 'text') {
      setTextPos(pt)
      return
    }

    if (tool === 'pin') {
      setPendingPinPos(pt)
      setShowPinLink(true)
      return
    }

    setIsDrawing(true)
    setStartPoint(pt)
    setCurrentPoints([pt])
    setCurrentEnd(pt)
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDrawing || !canvasRef.current) return
    const pt = getCanvasPoint(e, canvasRef.current)
    const { active: tool } = toolState

    if (tool === 'pen') {
      setCurrentPoints(prev => [...prev, pt])
    } else {
      setCurrentEnd(pt)
    }
  }

  async function onMouseUp(e: React.MouseEvent) {
    if (!isDrawing || !canvasRef.current) return
    const pt = getCanvasPoint(e, canvasRef.current)
    const { active: tool, color, weight } = toolState
    setIsDrawing(false)

    if (tool === 'pen' && currentPoints.length > 1) {
      await saveAnnotation('pen', { points: currentPoints, color, weight } as PenData)
    } else if (tool === 'arrow' && startPoint && dist(startPoint, pt) > 5) {
      await saveAnnotation('arrow', { from: startPoint, to: pt, color, weight } as ArrowData)
    } else if (tool === 'rect' && startPoint && dist(startPoint, pt) > 5) {
      await saveAnnotation('rect', { from: startPoint, to: pt, color, weight, style: 'rect' } as RectData)
    } else if (tool === 'cloud' && startPoint && dist(startPoint, pt) > 5) {
      await saveAnnotation('cloud', { from: startPoint, to: pt, color, weight, style: 'cloud' } as RectData)
    }

    setCurrentPoints([])
    setStartPoint(null)
    setCurrentEnd(null)
  }

  async function handleTextSubmit(text: string) {
    if (!textPos) return
    await saveAnnotation('text', {
      origin: textPos,
      text,
      color: toolState.color,
      fontSize: toolState.fontSize,
    } as TextData)
    setTextPos(null)
  }

  async function handlePinLink(module: 'rfi' | 'punch_item', id: string, label: string) {
    if (!pendingPinPos) return
    await saveAnnotation(
      'pin',
      { center: pendingPinPos, number: nextPinNumber, color: toolState.color } as PinData,
      nextPinNumber, module, id, label
    )
    setPendingPinPos(null)
  }

  async function handlePinWithoutLink() {
    if (!pendingPinPos) return
    await saveAnnotation(
      'pin',
      { center: pendingPinPos, number: nextPinNumber, color: toolState.color } as PinData,
      nextPinNumber
    )
    setPendingPinPos(null)
    setShowPinLink(false)
  }

  // ── Cursor style ─────────────────────────────────────────────────────────

  const cursorMap: Record<Tool, string> = {
    select: 'default',
    pen:    'crosshair',
    arrow:  'crosshair',
    text:   'text',
    rect:   'crosshair',
    cloud:  'crosshair',
    pin:    'cell',
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          cursor: canAnnotate ? cursorMap[toolState.active] : 'default',
          pointerEvents: canAnnotate ? 'all' : 'none',
          zIndex: 10,
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { if (isDrawing) { setIsDrawing(false); setCurrentPoints([]) } }}
      />

      {/* Toolbar — only if can annotate */}
      {canAnnotate && (
        <AnnotationToolbar
          toolState={toolState}
          setToolState={setToolState}
          onSaveSet={() => setShowMarkupForm(true)}
          onClear={() => setSelectedAnno(null)}
          saving={saving}
        />
      )}

      {/* Top-right controls */}
      <div style={{ position: 'absolute', right: '14px', top: '14px', display: 'flex', gap: '6px', zIndex: 20 }}>
        {/* Pin count badge */}
        {allAnnotations.filter(a => a.type === 'pin').length > 0 && (
          <div style={{ padding: '5px 10px', background: 'rgba(15,25,35,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(246,244,241,0.6)' }}>
            {allAnnotations.filter(a => a.type === 'pin').length} pin{allAnnotations.filter(a => a.type === 'pin').length !== 1 ? 's' : ''}
          </div>
        )}

        <button onClick={() => setShowLayers(l => !l)} title="Layer control"
          style={{ padding: '6px 10px', background: showLayers ? '#e8611a' : 'rgba(15,25,35,0.85)', border: `1px solid ${showLayers ? '#e8611a' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', color: 'rgba(246,244,241,0.8)', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', transition: 'all 0.15s' }}>
          ⊞ Layers
        </button>
      </div>

      {/* Layer panel */}
      {showLayers && (
        <LayerPanel
          layers={layers}
          annotations={allAnnotations}
          onToggle={toggleLayer}
          onClose={() => setShowLayers(false)}
        />
      )}

      {/* Text input overlay */}
      {textPos && canvasRef.current && (
        <TextInputOverlay
          position={{
            x: (textPos.x / CANVAS_W) * containerWidth  + 60,
            y: (textPos.y / CANVAS_H) * containerHeight,
          }}
          color={toolState.color}
          fontSize={toolState.fontSize}
          onSubmit={handleTextSubmit}
          onCancel={() => setTextPos(null)}
        />
      )}

      {/* Hovered pin popup */}
      {hoveredPin && canvasRef.current && (
        <PinPopup
          annotation={hoveredPin}
          onDelete={async id => { await deleteAnnotation(id); setHoveredPin(null) }}
          onClose={() => { setHoveredPin(null); setSelectedAnno(null) }}
        />
      )}

      {/* Saving indicator */}
      {saving && (
        <div style={{ position: 'absolute', bottom: '14px', left: '60px', padding: '5px 12px', background: 'rgba(15,25,35,0.9)', borderRadius: '4px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#e8611a', zIndex: 20 }}>
          Saving…
        </div>
      )}

      {/* Pin link modal */}
      <PinLinkModal
        open={showPinLink}
        onClose={() => { setShowPinLink(false); setPendingPinPos(null) }}
        onLink={handlePinLink}
        projectId={projectId}
      />

      {/* Also allow placing pin without link */}
      {showPinLink && (
        <div style={{ position: 'absolute', bottom: '60px', left: '60px', zIndex: 30 }}>
          <Button size="sm" variant="secondary" onClick={handlePinWithoutLink}
            style={{ background: 'rgba(15,25,35,0.9)', color: 'rgba(246,244,241,0.6)', borderColor: 'rgba(255,255,255,0.1)' }}>
            Place pin without link
          </Button>
        </div>
      )}

      {/* Markup set save modal */}
      <Modal open={showMarkupForm} onClose={() => setShowMarkupForm(false)} title="Save Markup Set" width={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowMarkupForm(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!markupName.trim()) return
              await saveMarkupSet(markupName, '')
              setMarkupName(''); setShowMarkupForm(false)
            }}>Save Set</Button>
          </>
        }
      >
        <FormField label="Markup Set Name" required>
          <input style={inputStyle} autoFocus
            placeholder="e.g. RFI Coordination Set — 4/22/26"
            value={markupName} onChange={e => setMarkupName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { /* submit */ } }} />
        </FormField>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
          Saves the current set of visible layers as a named markup set you can restore later.
        </p>
      </Modal>
    </div>
  )
}
