// ─────────────────────────────────────────────────────────────────────────────
// PDFViewerWithAnnotations.tsx
// Drop-in replacement for the inline PDFViewer in DrawingsPage.tsx
// Wraps the iframe with an AnnotationCanvas overlay
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import AnnotationCanvas from './AnnotationCanvas'
import type { Drawing, DrawingVersion } from '../hooks/useDrawings'

interface PDFViewerWithAnnotationsProps {
  drawing: Drawing
  activeVersion: DrawingVersion | null
  projectId: string
  onClose: () => void
}

export default function PDFViewerWithAnnotations({
  drawing, activeVersion, projectId, onClose,
}: PDFViewerWithAnnotationsProps) {
  const { can } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [zoom, setZoom] = useState(100)

  const canAnnotate  = can('annotate_drawings')
  const versionUrl   = activeVersion?.dropbox_url ?? drawing.latest_dropbox_url
  const versionId    = activeVersion?.id ?? drawing.latest_version_id

  // Track container dimensions for canvas sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1a1a2e', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{
        height: '44px', background: '#0d0d1a',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '0 14px', flexShrink: 0,
      }}>
        {/* Sheet info */}
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#f6f4f1', letterSpacing: '0.5px', textTransform: 'uppercase', marginRight: '4px' }}>
          {drawing.sheet_number}
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: 'rgba(255,255,255,0.4)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {drawing.sheet_name}
          {activeVersion && (
            <span style={{ marginLeft: '10px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
              {activeVersion.revision_label || `Rev ${activeVersion.version_number}`}
            </span>
          )}
        </div>

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={() => setZoom(z => Math.max(25, z - 25))}
            style={toolBtn}>−</button>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.5)', minWidth: '40px', textAlign: 'center' }}>
            {zoom}%
          </span>
          <button onClick={() => setZoom(z => Math.min(200, z + 25))}
            style={toolBtn}>+</button>
          <button onClick={() => setZoom(100)} style={toolBtn}>Fit</button>
        </div>

        {/* Annotation toggle */}
        {versionId && (
          <button
            onClick={() => setShowAnnotations(a => !a)}
            style={{
              ...toolBtn,
              background: showAnnotations ? 'rgba(232,97,26,0.2)' : 'rgba(255,255,255,0.05)',
              borderColor: showAnnotations ? '#e8611a' : 'rgba(255,255,255,0.15)',
              color: showAnnotations ? '#e8611a' : 'rgba(255,255,255,0.5)',
              padding: '0 10px', fontSize: '11px',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {showAnnotations ? '✏ Markup ON' : '✏ Markup OFF'}
          </button>
        )}

        {/* Open external */}
        {versionUrl && (
          <button onClick={() => window.open(versionUrl, '_blank')} style={{ ...toolBtn, padding: '0 10px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px' }}>
            ↗ Dropbox
          </button>
        )}

        <button onClick={onClose} style={{ ...toolBtn, background: 'rgba(255,255,255,0.05)', padding: '0 10px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px' }}>
          ✕ Close
        </button>
      </div>

      {/* ── PDF + Annotation overlay ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', background: '#2a2a3e', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{
          position: 'relative',
          width: `${zoom}%`,
          minWidth: '400px',
          maxWidth: '100%',
          background: 'white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          borderRadius: '2px',
        }}>
          {/* PDF iframe */}
          {versionUrl ? (
            <iframe
              src={`${versionUrl}#toolbar=0&navpanes=0`}
              style={{ width: '100%', height: `${Math.max(600, window.innerHeight - 200)}px`, border: 'none', display: 'block' }}
              title={`${drawing.sheet_number} - ${drawing.sheet_name}`}
            />
          ) : (
            <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>No PDF uploaded</div>
              </div>
            </div>
          )}

          {/* Annotation canvas sits on top of iframe */}
          {versionId && showAnnotations && (
            <div
              ref={containerRef}
              style={{ position: 'absolute', inset: 0, zIndex: 10 }}
            >
              <AnnotationCanvas
                drawingVersionId={versionId}
                projectId={projectId}
                canAnnotate={canAnnotate}
                containerWidth={dims.w}
                containerHeight={dims.h}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared button style ────────────────────────────────────────────────────────

const toolBtn: React.CSSProperties = {
  height: '28px',
  minWidth: '28px',
  padding: '0 8px',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '3px',
  background: 'transparent',
  color: 'rgba(255,255,255,0.6)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '15px',
  lineHeight: 1,
  transition: 'all 0.15s',
}
