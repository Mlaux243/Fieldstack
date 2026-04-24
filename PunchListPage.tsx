import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  useDrawings, type Drawing, type DrawingVersion,
  type DrawingDiscipline, type IssueType,
  DISCIPLINE_META, ISSUE_TYPE_META,
} from '../hooks/useDrawings'
import {
  PageHeader, Button, Modal, FormField, EmptyState, Skeleton,
  inputStyle, selectStyle,
} from '../components/ui'
import { formatFileSize } from '../lib/dropbox'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30) return `${d}d ago`
  return fmtDate(iso)
}

// ─── Discipline Badge ─────────────────────────────────────────────────────────

function DisciplineBadge({ discipline, size = 'md' }: {
  discipline: DrawingDiscipline; size?: 'sm' | 'md'
}) {
  const meta = DISCIPLINE_META[discipline]
  const pad  = size === 'sm' ? '2px 7px' : '3px 10px'
  const fs   = size === 'sm' ? '10px' : '11px'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: pad, borderRadius: '3px', background: meta.bg, color: meta.color,
      fontFamily: "'IBM Plex Mono', monospace", fontSize: fs,
      fontWeight: 600, letterSpacing: '0.5px', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontWeight: 800 }}>{meta.abbr}</span>
      {size === 'md' && meta.label}
    </span>
  )
}

// ─── Issue Type Badge ─────────────────────────────────────────────────────────

function IssueTypeBadge({ issueType }: { issueType: IssueType | null }) {
  if (!issueType) return null
  const meta = ISSUE_TYPE_META[issueType]
  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
      color: meta.color, background: `${meta.color}15`,
      padding: '2px 8px', borderRadius: '3px', whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

// ─── PDF Viewer Panel ─────────────────────────────────────────────────────────

function PDFViewer({ drawing, versionUrl, onClose }: {
  drawing: Drawing
  versionUrl: string | null
  onClose: () => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [zoom, setZoom]   = useState(100)
  const [page, setPage]   = useState(1)

  if (!versionUrl) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#1a1a2e', color: 'rgba(255,255,255,0.4)',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.3 }}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', letterSpacing: '1px' }}>
          No PDF available
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1a1a2e', overflow: 'hidden' }}>
      {/* Viewer toolbar */}
      <div style={{
        height: '44px', background: '#0d0d1a', borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: '8px', padding: '0 14px', flexShrink: 0,
      }}>
        {/* Sheet info */}
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#f6f4f1', letterSpacing: '0.5px', textTransform: 'uppercase', marginRight: '8px' }}>
          {drawing.sheet_number}
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: 'rgba(255,255,255,0.4)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {drawing.sheet_name}
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={() => setZoom(z => Math.max(25, z - 25))}
            style={{ width: '28px', height: '28px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>−</button>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.5)', minWidth: '42px', textAlign: 'center' }}>
            {zoom}%
          </span>
          <button onClick={() => setZoom(z => Math.min(200, z + 25))}
            style={{ width: '28px', height: '28px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>+</button>
          <button onClick={() => setZoom(100)}
            style={{ height: '28px', padding: '0 8px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px' }}>
            Fit
          </button>
        </div>

        {/* Open external */}
        <button onClick={() => window.open(versionUrl, '_blank')}
          style={{ height: '28px', padding: '0 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
          ↗ Dropbox
        </button>

        <button onClick={onClose}
          style={{ height: '28px', padding: '0 10px', border: 'none', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', marginLeft: '4px' }}>
          ✕
        </button>
      </div>

      {/* PDF iframe */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '16px', background: '#2a2a3e' }}>
        <div style={{
          width:  `${zoom}%`,
          minWidth: '400px',
          maxWidth: '100%',
          background: 'white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          borderRadius: '2px',
        }}>
          <iframe
            ref={iframeRef}
            src={`${versionUrl}#toolbar=0&navpanes=0`}
            style={{
              width: '100%',
              height: `${Math.max(600, window.innerHeight - 200)}px`,
              border: 'none',
              display: 'block',
            }}
            title={`${drawing.sheet_number} - ${drawing.sheet_name}`}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Version History Panel ────────────────────────────────────────────────────

function VersionHistoryPanel({ drawing, versions, onSelectVersion, selectedVersionId, onAddVersion, uploading, uploadPct, canUpload }: {
  drawing: Drawing
  versions: DrawingVersion[]
  onSelectVersion: (v: DrawingVersion) => void
  selectedVersionId: string | null
  onAddVersion: () => void
  uploading: boolean
  uploadPct: number
  canUpload: boolean
}) {
  return (
    <div style={{
      width: '260px', flexShrink: 0, background: '#0f1923',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(246,244,241,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          Versions ({versions.length})
        </div>
        {canUpload && (
          <button onClick={onAddVersion}
            style={{ border: 'none', background: 'rgba(232,97,26,0.15)', color: '#e8611a', cursor: 'pointer', borderRadius: '3px', padding: '4px 8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(232,97,26,0.3)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(232,97,26,0.15)'}
          >
            + New Rev
          </button>
        )}
      </div>

      {/* Upload progress */}
      {uploading && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(246,244,241,0.4)', marginBottom: '6px' }}>Uploading…</div>
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: `${uploadPct}%`, background: '#e8611a', borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Version list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {versions.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'rgba(246,244,241,0.3)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>
            No versions
          </div>
        ) : versions.map((ver, i) => {
          const isSelected  = ver.id === selectedVersionId
          const isCurrent   = ver.version_number === drawing.current_version
          const issueMeta   = ISSUE_TYPE_META[ver.issue_type]

          return (
            <div key={ver.id} onClick={() => onSelectVersion(ver)} style={{
              padding: '12px 16px', cursor: 'pointer',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: isSelected ? 'rgba(232,97,26,0.1)' : 'transparent',
              borderLeft: `3px solid ${isSelected ? '#e8611a' : 'transparent'}`,
              transition: 'all 0.1s',
            }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {/* Version circle */}
                <div style={{
                  width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                  background: isCurrent ? '#e8611a' : 'rgba(255,255,255,0.08)',
                  border: `1.5px solid ${isCurrent ? '#e8611a' : 'rgba(255,255,255,0.15)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
                  fontWeight: 800, color: isCurrent ? 'white' : 'rgba(255,255,255,0.4)',
                }}>
                  {ver.version_number}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 600, color: 'rgba(246,244,241,0.8)' }}>
                      {ver.revision_label || `Rev ${ver.version_number}`}
                    </span>
                    {isCurrent && (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#e8611a', background: 'rgba(232,97,26,0.2)', padding: '1px 4px', borderRadius: '2px', letterSpacing: '0.5px' }}>
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: issueMeta.color, marginTop: '2px' }}>
                    {issueMeta.label}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {ver.issued_date && (
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(246,244,241,0.3)' }}>
                    {fmtDate(ver.issued_date)}
                  </span>
                )}
                {ver.uploaded_by_name && (
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(246,244,241,0.25)' }}>
                    {ver.uploaded_by_name}
                  </span>
                )}
              </div>

              {ver.file_size_bytes && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(246,244,241,0.2)', marginTop: '4px' }}>
                  {formatFileSize(ver.file_size_bytes)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Create Drawing Modal ─────────────────────────────────────────────────────

function CreateDrawingModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const { createDrawing, uploading, uploadPct } = useDrawings()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    sheet_number: '', sheet_name: '', discipline: 'architectural' as DrawingDiscipline,
    revision_label: '', issue_type: 'construction' as IssueType, issued_date: '',
  })
  const [file,   setFile]   = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!form.sheet_number.trim()) e.sheet_number = 'Sheet number is required'
    if (!form.sheet_name.trim())   e.sheet_name   = 'Sheet name is required'
    if (!file)                     e.file         = 'PDF file is required'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate() || !file) return
    const { error } = await createDrawing({ ...form, file })
    if (error) { setErrors({ _: error }); return }
    setForm({ sheet_number: '', sheet_name: '', discipline: 'architectural', revision_label: '', issue_type: 'construction', issued_date: '' })
    setFile(null); setErrors({})
    onCreated(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload Drawing" subtitle="Add a new sheet to the drawing register" width={580}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button onClick={handleSubmit} loading={uploading}>
            {uploading ? `Uploading ${uploadPct}%…` : 'Upload Drawing →'}
          </Button>
        </>
      }
    >
      {errors._ && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>{errors._}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
        <FormField label="Sheet Number" required error={errors.sheet_number}>
          <input style={{ ...inputStyle, borderColor: errors.sheet_number ? '#fca5a5' : '#e5e7eb', textTransform: 'uppercase' }}
            placeholder="A1.01" autoFocus
            value={form.sheet_number} onChange={e => setForm(f => ({ ...f, sheet_number: e.target.value }))} />
        </FormField>
        <FormField label="Sheet Name" required error={errors.sheet_name}>
          <input style={{ ...inputStyle, borderColor: errors.sheet_name ? '#fca5a5' : '#e5e7eb' }}
            placeholder="Floor Plan Level 1"
            value={form.sheet_name} onChange={e => setForm(f => ({ ...f, sheet_name: e.target.value }))} />
        </FormField>
      </div>

      <FormField label="Discipline" required>
        <select style={selectStyle} value={form.discipline}
          onChange={e => setForm(f => ({ ...f, discipline: e.target.value as DrawingDiscipline }))}>
          {Object.entries(DISCIPLINE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.abbr} — {v.label}</option>
          ))}
        </select>
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <FormField label="Revision Label">
          <input style={inputStyle} placeholder="Rev 0, SD, DD…"
            value={form.revision_label} onChange={e => setForm(f => ({ ...f, revision_label: e.target.value }))} />
        </FormField>
        <FormField label="Issue Type" required>
          <select style={selectStyle} value={form.issue_type}
            onChange={e => setForm(f => ({ ...f, issue_type: e.target.value as IssueType }))}>
            {Object.entries(ISSUE_TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Issue Date">
          <input type="date" style={inputStyle} value={form.issued_date}
            onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} />
        </FormField>
      </div>

      {/* File upload */}
      <FormField label="PDF File" required error={errors.file}>
        <div onClick={() => fileRef.current?.click()} style={{
          padding: '16px', border: `2px dashed ${errors.file ? '#fca5a5' : file ? '#2d9e5f' : '#e5e7eb'}`,
          borderRadius: '4px', cursor: 'pointer', background: file ? '#f0fdf4' : '#f9fafb',
          textAlign: 'center', transition: 'all 0.15s',
        }}>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
          {file ? (
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#2d9e5f', fontWeight: 600 }}>
                ✓ {file.name}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                {formatFileSize(file.size)} · Click to change
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Click to select PDF
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                DWG files should be exported to PDF first
              </div>
            </div>
          )}
        </div>
      </FormField>

      {/* Upload progress */}
      {uploading && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#6b7280' }}>Uploading to Dropbox…</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#e8611a' }}>{uploadPct}%</span>
          </div>
          <div style={{ height: '3px', background: '#f3f4f6', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: `${uploadPct}%`, background: '#e8611a', borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Add Version Modal ────────────────────────────────────────────────────────

function AddVersionModal({ drawing, open, onClose, onAdded }: {
  drawing: Drawing | null; open: boolean; onClose: () => void; onAdded: () => void
}) {
  const { addVersion, uploading, uploadPct } = useDrawings()
  const fileRef = useRef<HTMLInputElement>(null)

  const [file,          setFile]          = useState<File | null>(null)
  const [revisionLabel, setRevisionLabel] = useState('')
  const [issueType,     setIssueType]     = useState<IssueType>('construction')
  const [issuedDate,    setIssuedDate]    = useState('')
  const [error,         setError]         = useState<string | null>(null)

  useEffect(() => {
    if (drawing) {
      setRevisionLabel(`Rev ${drawing.current_version + 1}`)
      setError(null); setFile(null)
    }
  }, [drawing])

  async function handleSubmit() {
    if (!drawing || !file) { setError('Select a PDF file.'); return }
    setError(null)
    const { error } = await addVersion(drawing, file, revisionLabel, issueType, issuedDate)
    if (error) { setError(error); return }
    onAdded(); onClose()
  }

  if (!drawing) return null

  return (
    <Modal open={open} onClose={onClose}
      title={`New Version — ${drawing.sheet_number}`}
      subtitle={`Currently Rev ${drawing.current_version} · Next will be Rev ${drawing.current_version + 1}`}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button onClick={handleSubmit} loading={uploading} disabled={!file}>
            {uploading ? `Uploading ${uploadPct}%…` : 'Upload New Version →'}
          </Button>
        </>
      }
    >
      {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Revision Label">
          <input style={inputStyle} value={revisionLabel}
            onChange={e => setRevisionLabel(e.target.value)}
            placeholder="Rev 2, ASI-003…" />
        </FormField>
        <FormField label="Issue Date">
          <input type="date" style={inputStyle} value={issuedDate}
            onChange={e => setIssuedDate(e.target.value)} />
        </FormField>
      </div>

      <FormField label="Issue Type">
        <select style={selectStyle} value={issueType}
          onChange={e => setIssueType(e.target.value as IssueType)}>
          {Object.entries(ISSUE_TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </FormField>

      <FormField label="PDF File" required>
        <div onClick={() => fileRef.current?.click()} style={{
          padding: '14px', border: `2px dashed ${file ? '#2d9e5f' : '#e5e7eb'}`,
          borderRadius: '4px', cursor: 'pointer', background: file ? '#f0fdf4' : '#f9fafb',
          textAlign: 'center', transition: 'all 0.15s',
        }}>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
          {file ? (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#2d9e5f' }}>✓ {file.name}</span>
          ) : (
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>
              Select Updated PDF
            </span>
          )}
        </div>
      </FormField>

      {uploading && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ height: '3px', background: '#f3f4f6', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: `${uploadPct}%`, background: '#e8611a', borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Drawings Page ────────────────────────────────────────────────────────────

export default function DrawingsPage() {
  const { activeProject, can } = useAuth()
  const {
    drawings, allDrawings, disciplines, disciplineCounts,
    loading, uploading, uploadPct, error,
    searchStr, setSearchStr, discipline, setDiscipline,
    fetchDrawings, fetchVersions, addVersion,
  } = useDrawings()

  const [showCreate,    setShowCreate]    = useState(false)
  const [viewDrawing,   setViewDrawing]   = useState<Drawing | null>(null)
  const [versions,      setVersions]      = useState<DrawingVersion[]>([])
  const [loadingVers,   setLoadingVers]   = useState(false)
  const [selectedVer,   setSelectedVer]   = useState<DrawingVersion | null>(null)
  const [showAddVer,    setShowAddVer]    = useState(false)
  const [addVerTarget,  setAddVerTarget]  = useState<Drawing | null>(null)

  const canUpload = can('upload_drawings')

  // Load versions when a drawing is opened in viewer
  useEffect(() => {
    if (!viewDrawing) return
    setLoadingVers(true)
    fetchVersions(viewDrawing.id).then(vers => {
      setVersions(vers)
      setSelectedVer(vers[0] ?? null)
      setLoadingVers(false)
    })
  }, [viewDrawing, fetchVersions])

  function openViewer(drawing: Drawing) {
    setViewDrawing(drawing)
  }

  function closeViewer() {
    setViewDrawing(null)
    setVersions([])
    setSelectedVer(null)
  }

  const disciplineOrder: DrawingDiscipline[] = [
    'architectural', 'structural', 'civil', 'mechanical', 'electrical', 'plumbing', 'landscape', 'other',
  ]

  // Group by discipline for register display
  const grouped = disciplineOrder.reduce((acc, disc) => {
    const group = drawings.filter(d => d.discipline === disc)
    if (group.length > 0) acc[disc] = group
    return acc
  }, {} as Record<DrawingDiscipline, Drawing[]>)

  if (!activeProject) {
    return <EmptyState title="No Project Selected" description="Select a project to view drawings." />
  }

  // ── VIEWER MODE ──────────────────────────────────────────────────────────────
  if (viewDrawing) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0d0d1a', zIndex: 100 }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {loadingVers ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#e8611a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* PDF Viewer */}
            <PDFViewer
              drawing={viewDrawing}
              versionUrl={selectedVer?.dropbox_url ?? viewDrawing.latest_dropbox_url}
              onClose={closeViewer}
            />

            {/* Version sidebar */}
            <VersionHistoryPanel
              drawing={viewDrawing}
              versions={versions}
              onSelectVersion={ver => setSelectedVer(ver)}
              selectedVersionId={selectedVer?.id ?? null}
              onAddVersion={() => { setAddVerTarget(viewDrawing); setShowAddVer(true) }}
              uploading={uploading}
              uploadPct={uploadPct}
              canUpload={canUpload}
            />
          </div>
        )}

        <AddVersionModal
          drawing={addVerTarget}
          open={showAddVer}
          onClose={() => setShowAddVer(false)}
          onAdded={async () => {
            if (viewDrawing) {
              const vers = await fetchVersions(viewDrawing.id)
              setVersions(vers)
              setSelectedVer(vers[0] ?? null)
            }
            await fetchDrawings()
          }}
        />
      </div>
    )
  }

  // ── REGISTER MODE ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .drawing-row{cursor:pointer;transition:background 0.1s}
        .drawing-row:hover{background:#f9fafb}
        input:focus,select:focus{border-color:#e8611a!important;outline:none}
      `}</style>

      <PageHeader
        title="Drawings"
        subtitle={`${allDrawings.length} sheet${allDrawings.length !== 1 ? 's' : ''} in register`}
        actions={canUpload ? (
          <Button onClick={() => setShowCreate(true)}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}>
            Upload Drawing
          </Button>
        ) : undefined}
      />

      {/* Discipline filter pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '280px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input style={{ ...inputStyle, paddingLeft: '32px' }} placeholder="Search sheets…"
            value={searchStr} onChange={e => setSearchStr(e.target.value)} />
        </div>

        {/* Discipline pills */}
        <button onClick={() => setDiscipline('all')} style={{
          padding: '5px 12px', borderRadius: '20px', cursor: 'pointer', border: `1.5px solid ${discipline === 'all' ? '#0f1923' : '#e5e7eb'}`,
          background: discipline === 'all' ? '#0f1923' : 'white', color: discipline === 'all' ? 'white' : '#6b7280',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', transition: 'all 0.15s',
        }}>
          All ({allDrawings.length})
        </button>
        {disciplineOrder.filter(d => disciplineCounts[d]).map(d => {
          const meta = DISCIPLINE_META[d]
          const active = discipline === d
          return (
            <button key={d} onClick={() => setDiscipline(active ? 'all' : d)} style={{
              padding: '5px 12px', borderRadius: '20px', cursor: 'pointer',
              border: `1.5px solid ${active ? meta.color : '#e5e7eb'}`,
              background: active ? meta.bg : 'white', color: active ? meta.color : '#6b7280',
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', transition: 'all 0.15s',
            }}>
              {meta.abbr} — {meta.label} ({disciplineCounts[d]})
            </button>
          )
        })}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}

      {/* Drawing Register */}
      {loading ? (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <Skeleton width={32} height={32} borderRadius="50%" />
              <Skeleton width={70} height={12} />
              <Skeleton width="40%" height={12} />
              <Skeleton width={90} height={20} borderRadius="3px" style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      ) : drawings.length === 0 ? (
        <EmptyState
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e8611a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>}
          title={allDrawings.length === 0 ? 'No Drawings Yet' : 'No Results'}
          description={allDrawings.length === 0 ? 'Upload the first drawing sheet for this project.' : 'Try adjusting your search or discipline filter.'}
          action={allDrawings.length === 0 && canUpload ? <Button onClick={() => setShowCreate(true)}>Upload First Drawing</Button> : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {disciplineOrder.filter(d => grouped[d]).map(disc => {
            const meta = DISCIPLINE_META[disc]
            return (
              <div key={disc}>
                {/* Discipline header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: meta.bg, border: `2px solid ${meta.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px',
                    fontWeight: 800, color: meta.color,
                  }}>{meta.abbr}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {meta.label}
                  </div>
                  <div style={{ flex: 1, height: '1px', background: `${meta.color}20` }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>
                    {grouped[disc].length} sheet{grouped[disc].length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Sheets table */}
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {[
                          ['Sheet No.',   '100px'],
                          ['Sheet Name',  ''],
                          ['Current Rev', '120px'],
                          ['Issue Type',  '160px'],
                          ['Issued',      '110px'],
                          ['Versions',    '80px'],
                          ['Updated',     '90px'],
                          ['',            '80px'],
                        ].map(([label, width]) => (
                          <th key={label} style={{ padding: '9px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb', ...(width ? { width } : {}) }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[disc].map(drawing => (
                        <tr key={drawing.id} className="drawing-row" onClick={() => openViewer(drawing)}>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: 700, color: meta.color }}>
                              {drawing.sheet_number}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#0f1923', fontWeight: 500 }}>
                              {drawing.sheet_name}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#374151' }}>
                              {drawing.latest_revision_label || `Rev ${drawing.current_version}`}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            <IssueTypeBadge issueType={drawing.latest_issue_type} />
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
                              {fmtDate(drawing.latest_issued_date)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: drawing.current_version > 1 ? '#e8611a' : '#9ca3af', fontWeight: drawing.current_version > 1 ? 600 : 400 }}>
                              {drawing.current_version}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
                              {timeAgo(drawing.updated_at)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {/* Open viewer */}
                              <button onClick={() => openViewer(drawing)} title="View drawing"
                                style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', transition: 'all 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = meta.color; (e.currentTarget as HTMLElement).style.color = meta.color }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                              </button>
                              {/* Add version */}
                              {canUpload && (
                                <button onClick={() => { setAddVerTarget(drawing); setShowAddVer(true) }} title="Upload new version"
                                  style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2d9e5f'; (e.currentTarget as HTMLElement).style.color = '#2d9e5f' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/></svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CreateDrawingModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchDrawings}
      />

      <AddVersionModal
        drawing={addVerTarget}
        open={showAddVer}
        onClose={() => { setShowAddVer(false); setAddVerTarget(null) }}
        onAdded={fetchDrawings}
      />
    </>
  )
}
