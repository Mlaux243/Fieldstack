import { useState, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  useDocuments, fmtSize, fileIcon,
  FOLDER_CATEGORIES, FOLDER_META,
  type Document, type FolderCategory,
} from '../hooks/useDocuments'
import {
  PageHeader, Button, Modal, FormField,
  EmptyState, Skeleton, inputStyle, selectStyle, textareaStyle,
} from '../components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30)  return `${d}d ago`
  return fmtDate(iso)
}

// ─── Dropbox Connect Banner / Modal ───────────────────────────────────────────

function DropboxConnectModal({ open, onClose, onConnect }: {
  open: boolean; onClose: () => void; onConnect: (token: string) => void
}) {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  async function handleConnect() {
    if (!token.trim()) { setError('Please enter your access token.'); return }
    setTesting(true); setError(null)
    try {
      // Test the token with a simple API call
      const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token.trim()}` },
      })
      if (!res.ok) throw new Error('Invalid token — authentication failed.')
      const data = await res.json()
      onConnect(token.trim())
      setToken('')
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Could not connect to Dropbox. Check your token and try again.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect Dropbox" width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConnect} loading={testing}>Connect →</Button>
        </>
      }
    >
      {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>{error}</div>}

      <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', marginBottom: '24px' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
          How to get your Dropbox Access Token
        </div>
        <ol style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#166534', lineHeight: 1.8, paddingLeft: '18px', margin: 0 }}>
          <li>Go to <strong>dropbox.com/developers/apps</strong></li>
          <li>Click <strong>Create App</strong> → choose <strong>Scoped Access</strong> → <strong>Full Dropbox</strong></li>
          <li>Name your app (e.g. "FieldStack")</li>
          <li>In the app settings, go to <strong>Permissions</strong> and enable: <code>files.content.write</code>, <code>files.content.read</code>, <code>sharing.write</code></li>
          <li>Go to <strong>Settings</strong> → <strong>OAuth 2</strong> → click <strong>Generate</strong> under Generated Access Token</li>
          <li>Copy and paste the token below</li>
        </ol>
      </div>

      <FormField label="Dropbox Access Token" required>
        <input
          style={inputStyle}
          type="password"
          placeholder="sl.XXXXXXXX..."
          value={token}
          onChange={e => setToken(e.target.value)}
          autoFocus
        />
      </FormField>

      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', margin: 0 }}>
        Your token is stored locally in your browser and never sent to our servers. Files upload directly from your browser to Dropbox.
      </p>
    </Modal>
  )
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({ open, onClose, defaultCategory }: {
  open: boolean; onClose: () => void; defaultCategory: FolderCategory
}) {
  const { uploadDocument, uploading, uploadProgress } = useDocuments()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [files,       setFiles]       = useState<File[]>([])
  const [category,    setCategory]    = useState<FolderCategory>(defaultCategory)
  const [description, setDescription] = useState('')
  const [tagInput,    setTagInput]    = useState('')
  const [tags,        setTags]        = useState<string[]>([])
  const [error,       setError]       = useState<string | null>(null)
  const [dragOver,    setDragOver]    = useState(false)
  const [done,        setDone]        = useState(false)

  function reset() {
    setFiles([]); setDescription(''); setTagInput(''); setTags([])
    setError(null); setDone(false)
    setCategory(defaultCategory)
  }

  function handleClose() { reset(); onClose() }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length) setFiles(prev => [...prev, ...dropped])
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length) setFiles(prev => [...prev, ...selected])
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  function removeTag(tag: string) { setTags(prev => prev.filter(t => t !== tag)) }

  async function handleUpload() {
    if (files.length === 0) { setError('Please select at least one file.'); return }
    setError(null)

    let anyError = false
    for (const file of files) {
      const { error } = await uploadDocument(file, category, description, tags)
      if (error) { setError(error); anyError = true; break }
    }

    if (!anyError) {
      setDone(true)
      setTimeout(() => { handleClose() }, 1200)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Upload Documents" width={580}
      footer={done ? undefined : (
        <>
          <Button variant="secondary" onClick={handleClose} disabled={uploading}>Cancel</Button>
          <Button onClick={handleUpload} loading={uploading} disabled={files.length === 0}>
            {uploading ? `Uploading... ${uploadProgress}%` : `Upload ${files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}`}
          </Button>
        </>
      )}
    >
      {done ? (
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px', fontWeight: 700, color: '#2d9e5f', textTransform: 'uppercase' }}>
            Upload Complete!
          </div>
        </div>
      ) : (
        <>
          {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>{error}</div>}

          {/* Upload progress bar */}
          {uploading && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#e8611a', borderRadius: '3px', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', marginTop: '5px', textAlign: 'center' }}>
                {uploadProgress}% — uploading to Dropbox...
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#e8611a' : '#d1d5db'}`,
              borderRadius: '6px', padding: '32px',
              textAlign: 'center', cursor: 'pointer',
              background: dragOver ? '#fef3ec' : '#fafafa',
              transition: 'all 0.15s', marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {dragOver ? 'Drop files here' : 'Click or drag files to upload'}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', marginTop: '6px' }}>
              PDF, DWG, DOCX, XLSX, PNG, JPG, and more
            </div>
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileInput} />
          </div>

          {/* Selected files */}
          {files.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              {files.map((f, i) => {
                const fi = fileIcon(f.name)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '18px' }}>{fi.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#0f1923', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>{fmtSize(f.size)}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setFiles(prev => prev.filter((_, idx) => idx !== i)) }}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: '0 4px' }}>×</button>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField label="Folder Category" required>
              <select style={selectStyle} value={category} onChange={e => setCategory(e.target.value as FolderCategory)}>
                {FOLDER_CATEGORIES.map(c => (
                  <option key={c} value={c}>{FOLDER_META[c].icon} {c}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Tags" hint="Press Enter to add">
              <div style={{ display: 'flex', gap: '6px' }}>
                <input style={{ ...inputStyle, flex: 1 }}
                  placeholder="e.g. structural"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                />
                <button onClick={addTag} style={{ padding: '0 12px', border: '1.5px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#374151' }}>
                  +
                </button>
              </div>
            </FormField>
          </div>

          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', marginTop: '-8px' }}>
              {tags.map(tag => (
                <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', background: '#eff6ff', color: '#2d6fd4', borderRadius: '3px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>
                  {tag}
                  <button onClick={() => removeTag(tag)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2d6fd4', padding: 0, lineHeight: 1, fontSize: '13px' }}>×</button>
                </span>
              ))}
            </div>
          )}

          <FormField label="Description">
            <textarea style={{ ...textareaStyle, minHeight: '72px' }}
              placeholder="Optional notes about this document..."
              value={description} onChange={e => setDescription(e.target.value)} />
          </FormField>
        </>
      )}
    </Modal>
  )
}

// ─── Document Detail Modal ────────────────────────────────────────────────────

function DocDetailModal({ doc, open, onClose, onDeleted }: {
  doc: Document | null; open: boolean; onClose: () => void; onDeleted: () => void
}) {
  const { can } = useAuth()
  const { deleteDocument, updateDocument } = useDocuments()
  const [tagInput, setTagInput] = useState('')
  const [tags,     setTags]     = useState<string[]>([])
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const canDelete = can('upload_documents')

  const fi = doc ? fileIcon(doc.name) : { icon: '📁', color: '#6b7280' }

  if (!doc) return null

  const isPreviewable = ['png','jpg','jpeg','gif','webp','pdf'].includes(doc.name.split('.').pop()?.toLowerCase() ?? '')

  return (
    <Modal open={open} onClose={onClose} title={doc.name} width={600}
      footer={
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          {canDelete && (
            <Button variant="danger" size="sm"
              onClick={async () => {
                if (!window.confirm(`Remove "${doc.name}" from the document library? (The file will remain in Dropbox.)`)) return
                await deleteDocument(doc.id)
                onDeleted(); onClose()
              }}
            >
              Remove
            </Button>
          )}
          <div style={{ flex: 1 }} />
          {doc.dropbox_url && (
            <Button variant="secondary" size="sm"
              onClick={() => window.open(doc.dropbox_url!, '_blank')}
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>}
            >
              Open in Dropbox
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      }
    >
      {/* File preview */}
      {doc.dropbox_url && isPreviewable && (
        <div style={{ marginBottom: '20px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'center', maxHeight: '280px' }}>
          {doc.name.split('.').pop()?.toLowerCase() === 'pdf' ? (
            <iframe
              src={`${doc.dropbox_url}?raw=1`}
              style={{ width: '100%', height: '280px', border: 'none' }}
              title={doc.name}
            />
          ) : (
            <img
              src={`${doc.dropbox_url}?raw=1`}
              alt={doc.name}
              style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>
      )}

      {/* Icon + name */}
      {(!doc.dropbox_url || !isPreviewable) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', background: '#f9fafb', borderRadius: '4px', marginBottom: '20px' }}>
          <span style={{ fontSize: '36px' }}>{fi.icon}</span>
          <div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '15px', color: '#0f1923', fontWeight: 500 }}>{doc.name}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>{fmtSize(doc.file_size_bytes)}</div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {[
          ['Category',   doc.folder_category ?? '—'],
          ['Uploaded',   fmtDate(doc.created_at)],
          ['By',         doc.uploaded_by_name ?? '—'],
          ['File Size',  fmtSize(doc.file_size_bytes)],
        ].map(([label, val]) => (
          <div key={label as string}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Dropbox path */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Dropbox Path</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#6b7280', padding: '8px 12px', background: '#f3f4f6', borderRadius: '4px', wordBreak: 'break-all' }}>
          {doc.dropbox_path}
        </div>
      </div>

      {/* Description */}
      {doc.description && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Description</div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>{doc.description}</div>
        </div>
      )}

      {/* Tags */}
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Tags</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {doc.tags.map(tag => (
            <span key={tag} style={{ padding: '3px 10px', background: '#eff6ff', color: '#2d6fd4', borderRadius: '3px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>
              {tag}
            </span>
          ))}
          {doc.tags.length === 0 && <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#9ca3af' }}>No tags</span>}
        </div>
      </div>
    </Modal>
  )
}

// ─── Documents Page ───────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { activeProject, can } = useAuth()
  const {
    documents, allDocuments, allTags, allFileTypes,
    loading, uploading, error,
    dropboxLinked, connectDropbox, disconnectDropbox,
    filters, setFilters,
    fetchDocuments,
  } = useDocuments()

  const [view,         setView]        = useState<'grid' | 'list'>('grid')
  const [showConnect,  setShowConnect]  = useState(false)
  const [showUpload,   setShowUpload]   = useState(false)
  const [selectedDoc,  setSelectedDoc]  = useState<Document | null>(null)
  const [showDetail,   setShowDetail]   = useState(false)
  const [activeFolder, setActiveFolder] = useState<FolderCategory | 'all'>('all')

  const canUpload = can('upload_documents')

  // Folder sizes
  const folderCounts = FOLDER_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = allDocuments.filter(d => d.folder_category === cat).length
    return acc
  }, {} as Record<FolderCategory, number>)

  const totalSize = allDocuments.reduce((sum, d) => sum + (d.file_size_bytes ?? 0), 0)

  function handleFolderClick(cat: FolderCategory | 'all') {
    setActiveFolder(cat)
    setFilters(f => ({ ...f, category: cat }))
  }

  if (!activeProject) {
    return <EmptyState title="No Project Selected" description="Select a project to view documents." />
  }

  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .doc-card{cursor:pointer;transition:box-shadow 0.15s,transform 0.15s;border:1px solid #e5e7eb}
        .doc-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.08);transform:translateY(-1px);border-color:#d1d5db}
        .doc-row{cursor:pointer;transition:background 0.1s}
        .doc-row:hover{background:#fafafa}
        .folder-btn{transition:all 0.15s;cursor:pointer;border:none;background:none;width:100%;text-align:left}
        input:focus,select:focus{border-color:#e8611a!important;outline:none}
      `}</style>

      <PageHeader
        title="Documents"
        subtitle={`${allDocuments.length} files · ${fmtSize(totalSize)} total`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {!dropboxLinked ? (
              <Button variant="secondary" onClick={() => setShowConnect(true)}
                icon={<span style={{ fontSize: '14px' }}>📦</span>}>
                Connect Dropbox
              </Button>
            ) : (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#2d9e5f', display: 'flex', alignItems: 'center', gap: '5px', padding: '0 10px' }}>
                ✓ Dropbox Connected
              </span>
            )}
            {canUpload && dropboxLinked && (
              <Button onClick={() => setShowUpload(true)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>}>
                Upload Files
              </Button>
            )}
            <div style={{ display: 'flex', border: '1.5px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
              {(['grid', 'list'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding: '7px 12px', border: 'none', cursor: 'pointer', background: view === v ? '#0f1923' : 'white', color: view === v ? 'white' : '#6b7280', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', transition: 'all 0.15s' }}>
                  {v === 'grid' ? '⊞' : '≡'}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Dropbox not connected warning */}
      {!dropboxLinked && (
        <div style={{ padding: '14px 18px', background: '#fef3ec', border: '1px solid #fddcbc', borderRadius: '6px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dropbox Not Connected</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#92400e', marginTop: '3px' }}>Connect your Dropbox account to upload and manage files directly from FieldStack.</div>
          </div>
          <Button size="sm" onClick={() => setShowConnect(true)}>Connect Now</Button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── Folder Sidebar ── */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Folders
            </div>
          </div>

          {/* All files */}
          <button className="folder-btn" onClick={() => handleFolderClick('all')}
            style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', background: activeFolder === 'all' ? '#fef3ec' : 'transparent', borderLeft: activeFolder === 'all' ? '3px solid #e8611a' : '3px solid transparent' }}>
            <span>📁</span>
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: activeFolder === 'all' ? '#e8611a' : '#374151', flex: 1 }}>All Files</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>{allDocuments.length}</span>
          </button>

          {FOLDER_CATEGORIES.map(cat => {
            const meta  = FOLDER_META[cat]
            const count = folderCounts[cat]
            const active = activeFolder === cat
            return (
              <button key={cat} className="folder-btn" onClick={() => handleFolderClick(cat)}
                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', background: active ? meta.bg : 'transparent', borderLeft: `3px solid ${active ? meta.color : 'transparent'}` }}>
                <span>{meta.icon}</span>
                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: active ? meta.color : '#374151', flex: 1 }}>{cat}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: active ? meta.color : '#9ca3af' }}>{count}</span>
              </button>
            )
          })}

          {/* Storage info */}
          <div style={{ padding: '14px', borderTop: '1px solid #f3f4f6', marginTop: '4px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Storage Used</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 700, color: '#0f1923' }}>{fmtSize(totalSize)}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>Unlimited via Dropbox</div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '280px' }}>
              <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input style={{ ...inputStyle, paddingLeft: '32px' }} placeholder="Search files..."
                value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
            </div>

            {allTags.length > 0 && (
              <select style={{ ...selectStyle, width: '130px' }} value={filters.tag}
                onChange={e => setFilters(f => ({ ...f, tag: e.target.value }))}>
                <option value="all">All Tags</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

            {allFileTypes.length > 1 && (
              <select style={{ ...selectStyle, width: '110px' }} value={filters.file_type}
                onChange={e => setFilters(f => ({ ...f, file_type: e.target.value }))}>
                <option value="all">All Types</option>
                {allFileTypes.map(t => <option key={t} value={t}>.{t}</option>)}
              </select>
            )}

            {(filters.search || filters.tag !== 'all' || filters.file_type !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(f => ({ ...f, search: '', tag: 'all', file_type: 'all' }))}>
                Clear
              </Button>
            )}
            <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
              {documents.length} file{documents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {error && <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>{error}</div>}

          {/* ── Grid View ── */}
          {view === 'grid' && (
            loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} height={160} borderRadius="6px" />)}
              </div>
            ) : documents.length === 0 ? (
              <EmptyState
                icon={<span style={{ fontSize: '28px' }}>📁</span>}
                title={allDocuments.length === 0 ? 'No Documents Yet' : 'No Results'}
                description={allDocuments.length === 0 ? (dropboxLinked ? 'Upload the first document for this project.' : 'Connect Dropbox to start uploading documents.') : 'Try adjusting your search or filters.'}
                action={allDocuments.length === 0 && canUpload && dropboxLinked ? (
                  <Button onClick={() => setShowUpload(true)}>Upload First Document</Button>
                ) : !dropboxLinked ? (
                  <Button onClick={() => setShowConnect(true)}>Connect Dropbox</Button>
                ) : undefined}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                {documents.map(doc => {
                  const fi   = fileIcon(doc.name)
                  const meta = doc.folder_category ? FOLDER_META[doc.folder_category] : null
                  return (
                    <div key={doc.id} className="doc-card"
                      onClick={() => { setSelectedDoc(doc); setShowDetail(true) }}
                      style={{ background: 'white', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer' }}>
                      {/* Icon */}
                      <div style={{ width: '48px', height: '48px', background: `${fi.color}15`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                        {fi.icon}
                      </div>
                      {/* Name */}
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#0f1923', fontWeight: 500, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {doc.name}
                      </div>
                      {/* Meta */}
                      <div style={{ marginTop: 'auto' }}>
                        {meta && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: meta.color, background: meta.bg, padding: '2px 6px', borderRadius: '3px', display: 'inline-block', marginBottom: '5px' }}>
                            {doc.folder_category}
                          </div>
                        )}
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>
                          {fmtSize(doc.file_size_bytes)}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>
                          {timeAgo(doc.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* ── List View ── */}
          {view === 'list' && (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '0 20px' }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <Skeleton width={36} height={36} borderRadius="6px" />
                      <div style={{ flex: 1 }}><Skeleton height={13} width="40%" style={{ marginBottom: '6px' }} /><Skeleton height={10} width="20%" /></div>
                      <Skeleton width={80} height={20} borderRadius="3px" />
                    </div>
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <EmptyState
                  icon={<span style={{ fontSize: '24px' }}>📁</span>}
                  title={allDocuments.length === 0 ? 'No Documents Yet' : 'No Results'}
                  description="Upload documents or adjust your filters."
                />
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {[['File', ''], ['Category', '140px'], ['Tags', '160px'], ['Size', '90px'], ['Uploaded', '110px'], ['By', '130px']].map(([h, w]) => (
                        <th key={h} style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb', ...(w ? { width: w } : {}) }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map(doc => {
                      const fi   = fileIcon(doc.name)
                      const meta = doc.folder_category ? FOLDER_META[doc.folder_category] : null
                      return (
                        <tr key={doc.id} className="doc-row" onClick={() => { setSelectedDoc(doc); setShowDetail(true) }}>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '32px', height: '32px', background: `${fi.color}15`, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                                {fi.icon}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#0f1923', fontWeight: 500 }}>
                                {doc.name}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            {meta ? (
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: '3px' }}>
                                {doc.folder_category}
                              </span>
                            ) : <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {doc.tags.slice(0, 3).map(tag => (
                                <span key={tag} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#2d6fd4', background: '#eff6ff', padding: '1px 6px', borderRadius: '3px' }}>
                                  {tag}
                                </span>
                              ))}
                              {doc.tags.length > 3 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>+{doc.tags.length - 3}</span>}
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#6b7280' }}>{fmtSize(doc.file_size_bytes)}</span>
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#6b7280' }}>{timeAgo(doc.created_at)}</span>
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#374151' }}>{doc.uploaded_by_name ?? '—'}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <DropboxConnectModal
        open={showConnect}
        onClose={() => setShowConnect(false)}
        onConnect={connectDropbox}
      />
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        defaultCategory={activeFolder !== 'all' ? activeFolder : 'General'}
      />
      <DocDetailModal
        doc={selectedDoc}
        open={showDetail}
        onClose={() => { setShowDetail(false); setSelectedDoc(null) }}
        onDeleted={fetchDocuments}
      />
    </>
  )
}
