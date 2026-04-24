import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePunchList, type PunchItem, type PunchStatus } from '../hooks/usePunchList'
import {
  PageHeader, Button, Modal, FormField, StatusBadge,
  EmptyState, Skeleton, inputStyle, selectStyle, textareaStyle,
} from '../components/ui'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FLOW: Record<PunchStatus, { label: string; color: string; bg: string; border: string; next: PunchStatus[] }> = {
  open:                 { label: 'Open',                 color: '#e8611a', bg: '#fef3ec', border: '#fddcbc', next: ['in_progress', 'closed'] },
  in_progress:          { label: 'In Progress',          color: '#2d6fd4', bg: '#eff6ff', border: '#bfdbfe', next: ['ready_for_inspection', 'open'] },
  ready_for_inspection: { label: 'Ready for Inspection', color: '#ca8a04', bg: '#fefce8', border: '#fde68a', next: ['closed', 'in_progress'] },
  closed:               { label: 'Closed',               color: '#2d9e5f', bg: '#f0fdf4', border: '#bbf7d0', next: [] },
}

const STATUS_ORDER: PunchStatus[] = ['open', 'in_progress', 'ready_for_inspection', 'closed']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysOverdue(dueDate: string) {
  return Math.max(1, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000))
}

// ─── Status stepper component ─────────────────────────────────────────────────

function StatusStepper({ item, onUpdate, saving }: {
  item: PunchItem; onUpdate: (status: PunchStatus) => void; saving: boolean
}) {
  const canClose = true // enforced by GC-only role check in page

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {STATUS_ORDER.filter(s => s !== 'closed' || canClose).map((status, i) => {
        const meta    = STATUS_FLOW[status]
        const current = STATUS_ORDER.indexOf(item.status)
        const this_i  = STATUS_ORDER.indexOf(status)
        const isDone  = this_i < current
        const isCurr  = status === item.status
        const isNext  = this_i === current + 1

        return (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {i > 0 && <div style={{ width: '20px', height: '1px', background: isDone || isCurr ? meta.color : '#e5e7eb' }} />}
            <button
              onClick={() => !isCurr && !saving && onUpdate(status)}
              disabled={saving || isCurr}
              title={meta.label}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: isCurr ? meta.color : isDone ? `${meta.color}20` : 'white',
                border: `2px solid ${isCurr || isDone ? meta.color : '#e5e7eb'}`,
                cursor: isCurr || saving ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px',
                fontWeight: 700, color: isCurr ? 'white' : isDone ? meta.color : '#9ca3af',
                transition: 'all 0.15s',
              }}
            >
              {isDone
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : i + 1
              }
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Create Punch Modal ───────────────────────────────────────────────────────

function CreatePunchModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const { activeProject } = useAuth()
  const { createItem, saving } = usePunchList()

  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([])
  const [form, setForm] = useState({
    location: '', trade: '', description: '',
    assigned_to: '', due_date: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open || !activeProject) return
    supabase
      .from('project_users')
      .select('user_id, role, profile:user_profiles(full_name)')
      .eq('project_id', activeProject.project.id)
      .then(({ data }) => {
        setMembers((data ?? [])
          .filter((m: any) => ['subcontractor', 'gc_field', 'gc_admin'].includes(m.role))
          .map((m: any) => ({ id: m.user_id, full_name: m.profile?.full_name ?? 'Unknown' }))
        )
      })
  }, [open, activeProject])

  function validate() {
    const e: Record<string, string> = {}
    if (!form.location.trim())    e.location    = 'Location is required'
    if (!form.trade.trim())       e.trade       = 'Trade is required'
    if (!form.description.trim()) e.description = 'Description is required'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    const { error } = await createItem({
      location:    form.location,
      trade:       form.trade,
      description: form.description,
      assigned_to: form.assigned_to || null,
      due_date:    form.due_date    || null,
    })
    if (error) { setErrors({ _: error }); return }
    setForm({ location: '', trade: '', description: '', assigned_to: '', due_date: '' })
    setErrors({})
    onCreated()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="New Punch Item" width={580}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Create Item →</Button>
        </>
      }
    >
      {errors._ && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>{errors._}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Location" required error={errors.location}>
          <input style={{ ...inputStyle, borderColor: errors.location ? '#fca5a5' : '#e5e7eb' }}
            placeholder="e.g. Level 2 – Unit 204" autoFocus
            value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
        </FormField>
        <FormField label="Trade Responsible" required error={errors.trade}>
          <input style={{ ...inputStyle, borderColor: errors.trade ? '#fca5a5' : '#e5e7eb' }}
            placeholder="e.g. Drywall, Electrical"
            value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} />
        </FormField>
      </div>

      <FormField label="Description" required error={errors.description}>
        <textarea style={{ ...textareaStyle, minHeight: '100px', borderColor: errors.description ? '#fca5a5' : '#e5e7eb' }}
          placeholder="Describe the deficiency clearly — what needs to be corrected and where exactly."
          value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Assign To">
          <select style={selectStyle} value={form.assigned_to}
            onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </FormField>
        <FormField label="Due Date">
          <input type="date" style={inputStyle} value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        </FormField>
      </div>
    </Modal>
  )
}

// ─── Item Detail Modal ────────────────────────────────────────────────────────

function PunchDetailModal({ item, open, onClose, onSaved }: {
  item: PunchItem | null; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const { can, activeProject, user } = useAuth()
  const { updateStatus, reassign, fetchPhotos, addPhoto, saving } = usePunchList()

  const [members,  setMembers]  = useState<{ id: string; full_name: string }[]>([])
  const [photos,   setPhotos]   = useState<any[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [newAssign, setNewAssign] = useState('')
  const [newTrade,  setNewTrade]  = useState('')
  const [photoPath, setPhotoPath] = useState('')
  const [photoCaption, setPhotoCaption] = useState('')
  const [addingPhoto, setAddingPhoto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canClose   = can('close_punch')
  const canCreate  = can('create_punch')

  useEffect(() => {
    if (!item || !open || !activeProject) return
    setNewAssign(item.assigned_to ?? '')
    setNewTrade(item.trade)
    setError(null)
    setPhotoPath(''); setPhotoCaption(''); setAddingPhoto(false)

    // Load members
    supabase
      .from('project_users')
      .select('user_id, role, profile:user_profiles(full_name)')
      .eq('project_id', activeProject.project.id)
      .then(({ data }) => {
        setMembers((data ?? [])
          .filter((m: any) => ['subcontractor', 'gc_field', 'gc_admin'].includes(m.role))
          .map((m: any) => ({ id: m.user_id, full_name: m.profile?.full_name ?? 'Unknown' }))
        )
      })

    // Load photos
    setLoadingPhotos(true)
    fetchPhotos(item.id).then(p => { setPhotos(p); setLoadingPhotos(false) })
  }, [item, open, activeProject, fetchPhotos])

  async function handleStatusChange(status: PunchStatus) {
    if (!item) return
    if (status === 'closed' && !canClose) { setError('Only GC roles can close punch items.'); return }
    setError(null)
    const { error } = await updateStatus(item.id, item.punch_number, status)
    if (error) setError(error)
    else onSaved()
  }

  async function handleReassign() {
    if (!item) return
    setError(null)
    const { error } = await reassign(item.id, newAssign || null, newTrade)
    if (error) { setError(error); return }
    onSaved()
  }

  async function handleAddPhoto() {
    if (!item || !photoPath.trim()) { setError('Dropbox path is required.'); return }
    setError(null)
    const { error } = await addPhoto(item.id, photoPath.trim(), photoCaption.trim())
    if (error) { setError(error); return }
    setPhotoPath(''); setPhotoCaption(''); setAddingPhoto(false)
    const updated = await fetchPhotos(item.id)
    setPhotos(updated)
  }

  if (!item) return null

  const meta    = STATUS_FLOW[item.status]
  const isClosed = item.status === 'closed'

  return (
    <Modal open={open} onClose={onClose}
      title={item.punch_number}
      subtitle={`${item.location} · ${item.trade}`}
      width={660}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {/* Status stepper */}
      <div style={{ padding: '16px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: '6px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Status</div>
            <StatusStepper item={item} onUpdate={handleStatusChange} saving={saving} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 600, color: meta.color }}>
              {meta.label}
            </div>
            {item.is_overdue && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#dc2626', marginTop: '3px' }}>
                ⚠ {daysOverdue(item.due_date!)}d overdue
              </div>
            )}
            {isClosed && item.closed_at && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#2d9e5f', marginTop: '3px' }}>
                Closed {fmtDate(item.closed_at.split('T')[0])} by {item.closed_by_name ?? '—'}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}

      {/* Description */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Deficiency Description</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#374151', lineHeight: 1.7, padding: '12px 14px', background: '#f9fafb', borderRadius: '4px', borderLeft: '3px solid #e8611a', whiteSpace: 'pre-wrap' }}>
          {item.description}
        </div>
      </div>

      {/* Metadata grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {[
          ['Location',   item.location],
          ['Due Date',   fmtDate(item.due_date)],
          ['Created By', item.created_by_name ?? '—'],
        ].map(([label, val]) => (
          <div key={label as string}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Reassignment (GC only, not closed) */}
      {canCreate && !isClosed && (
        <div style={{ padding: '14px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '20px' }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Reassign
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Trade</div>
              <input style={{ ...inputStyle, fontSize: '13px' }}
                value={newTrade} onChange={e => setNewTrade(e.target.value)} />
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Assigned To</div>
              <select style={{ ...selectStyle, fontSize: '13px' }}
                value={newAssign} onChange={e => setNewAssign(e.target.value)}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={handleReassign} loading={saving}>
            Save Assignment
          </Button>
        </div>
      )}

      {/* Photos */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Photos ({photos.length})
          </div>
          {!isClosed && (
            <Button size="sm" variant="ghost" onClick={() => setAddingPhoto(a => !a)}
              icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}>
              Add Photo
            </Button>
          )}
        </div>

        {/* Add photo form */}
        {addingPhoto && (
          <div style={{ padding: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', marginBottom: '12px' }}>
            <FormField label="Dropbox Path" hint="Paste the Dropbox path to the photo file">
              <input style={inputStyle} placeholder="/FieldStack/Project/Photos/PL-001-photo1.jpg"
                value={photoPath} onChange={e => setPhotoPath(e.target.value)} />
            </FormField>
            <FormField label="Caption">
              <input style={inputStyle} placeholder="Describe what the photo shows"
                value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} />
            </FormField>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="sm" onClick={handleAddPhoto} loading={saving}>Save Photo</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingPhoto(false); setPhotoPath(''); setPhotoCaption('') }}>Cancel</Button>
            </div>
          </div>
        )}

        {loadingPhotos ? (
          <Skeleton height={60} />
        ) : photos.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', background: '#f9fafb', borderRadius: '4px' }}>
            No photos attached.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {photos.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                <div style={{ width: '36px', height: '36px', background: '#e5e7eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#2d6fd4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.dropbox_path.split('/').pop()}
                  </div>
                  {p.caption && (
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      {p.caption}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', flexShrink: 0 }}>
                  {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Punch List Page ──────────────────────────────────────────────────────────

export default function PunchListPage() {
  const { activeProject, can } = useAuth()
  const {
    items, allItems, loading, saving, error,
    counts, allTrades, allAssigned,
    filters, setFilters, sortBy, sortDir, toggleSort,
    fetchItems, updateStatus, bulkUpdateStatus,
  } = usePunchList()

  const [view,         setView]        = useState<'list' | 'board'>('list')
  const [showCreate,   setShowCreate]  = useState(false)
  const [selected,     setSelected]    = useState<PunchItem | null>(null)
  const [showDetail,   setShowDetail]  = useState(false)
  const [selectedIds,  setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus,   setBulkStatus]  = useState<PunchStatus>('in_progress')

  const canCreate = can('create_punch')
  const canClose  = can('close_punch')

  // Clear selection when filter changes
  useEffect(() => { setSelectedIds(new Set()) }, [filters])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(items.map(i => i.id)))
  }

  async function handleBulkUpdate() {
    if (selectedIds.size === 0) return
    if (bulkStatus === 'closed' && !canClose) return
    await bulkUpdateStatus([...selectedIds], bulkStatus)
    setSelectedIds(new Set())
  }

  function SortTh({ label, col, style }: { label: string; col: string; style?: React.CSSProperties }) {
    const active = sortBy === col
    return (
      <th onClick={() => toggleSort(col as any)} style={{
        padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px', color: active ? '#e8611a' : '#9ca3af',
        fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase',
        textAlign: 'left', cursor: 'pointer', userSelect: 'none',
        whiteSpace: 'nowrap', background: '#fafafa', borderBottom: '1px solid #e5e7eb',
        ...style,
      }}>
        {label}{active && <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </th>
    )
  }

  if (!activeProject) {
    return <EmptyState title="No Project Selected" description="Select a project to view the punch list." />
  }

  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .punch-row{cursor:pointer;transition:background 0.1s}
        .punch-row:hover{background:#fafafa}
        .punch-row.overdue td:first-child{border-left:3px solid #dc2626}
        .board-card{cursor:pointer;transition:box-shadow 0.15s,transform 0.15s}
        .board-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.1);transform:translateY(-1px)}
        input:focus,select:focus,textarea:focus{border-color:#e8611a!important;outline:none}
      `}</style>

      <PageHeader
        title="Punch List"
        subtitle={`${counts.total} items · ${counts.open} open · ${counts.closed} closed${counts.overdue > 0 ? ` · ${counts.overdue} overdue` : ''}`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* View toggle */}
            <div style={{ display: 'flex', border: '1.5px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
              {(['list', 'board'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '7px 14px', border: 'none', cursor: 'pointer',
                  background: view === v ? '#0f1923' : 'white',
                  color: view === v ? 'white' : '#6b7280',
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                  transition: 'all 0.15s',
                }}>
                  {v === 'list' ? '≡ List' : '⊞ Board'}
                </button>
              ))}
            </div>
            {canCreate && (
              <Button onClick={() => setShowCreate(true)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}>
                New Item
              </Button>
            )}
          </div>
        }
      />

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {STATUS_ORDER.map(status => {
          const meta = STATUS_FLOW[status]
          const count = counts[status] ?? 0
          return (
            <div key={status}
              onClick={() => setFilters(f => ({ ...f, status: f.status === status ? 'all' : status }))}
              style={{ padding: '10px 16px', borderRadius: '4px', cursor: 'pointer', background: 'white', border: `1.5px solid ${filters.status === status ? meta.color : '#e5e7eb'}`, transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = meta.color}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = filters.status === status ? meta.color : '#e5e7eb'}
            >
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '28px', fontWeight: 800, color: count > 0 ? meta.color : '#d1d5db', lineHeight: 1 }}>{count}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '3px' }}>{meta.label}</div>
            </div>
          )
        })}
        {counts.overdue > 0 && (
          <div onClick={() => setFilters(f => ({ ...f, overdue_only: !f.overdue_only }))}
            style={{ padding: '10px 16px', borderRadius: '4px', cursor: 'pointer', background: 'white', border: `1.5px solid ${filters.overdue_only ? '#dc2626' : '#e5e7eb'}`, transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#dc2626'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = filters.overdue_only ? '#dc2626' : '#e5e7eb'}
          >
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '28px', fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{counts.overdue}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '3px' }}>Overdue</div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '260px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input style={{ ...inputStyle, paddingLeft: '32px' }} placeholder="Search..."
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>

        <select style={{ ...selectStyle, width: '160px' }} value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value as any }))}>
          <option value="all">All Statuses</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_FLOW[s].label}</option>)}
        </select>

        <select style={{ ...selectStyle, width: '140px' }} value={filters.trade}
          onChange={e => setFilters(f => ({ ...f, trade: e.target.value }))}>
          <option value="all">All Trades</option>
          {allTrades.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select style={{ ...selectStyle, width: '160px' }} value={filters.assigned_to}
          onChange={e => setFilters(f => ({ ...f, assigned_to: e.target.value }))}>
          <option value="all">All Assigned</option>
          {allAssigned.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        {(filters.status !== 'all' || filters.trade !== 'all' || filters.search || filters.overdue_only || filters.assigned_to !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ status: 'all', trade: 'all', assigned_to: 'all', search: '', overdue_only: false })}>
            Clear
          </Button>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', background: '#0f1923', borderRadius: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#f6f4f1' }}>
            {selectedIds.size} selected
          </span>
          <select style={{ ...selectStyle, width: '200px', background: '#1a2b3c', color: '#f6f4f1', borderColor: 'rgba(246,244,241,0.2)' }}
            value={bulkStatus} onChange={e => setBulkStatus(e.target.value as PunchStatus)}>
            {STATUS_ORDER.filter(s => s !== 'closed' || canClose).map(s => (
              <option key={s} value={s}>{STATUS_FLOW[s].label}</option>
            ))}
          </select>
          <Button size="sm" onClick={handleBulkUpdate} loading={saving}>Apply to Selected</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} style={{ color: 'rgba(246,244,241,0.5)' }}>
            Cancel
          </Button>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '0 20px' }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <Skeleton width={16} height={16} borderRadius="3px" />
                  <Skeleton width={70} height={12} />
                  <Skeleton width="35%" height={12} />
                  <Skeleton width={80} height={20} borderRadius="3px" style={{ marginLeft: 'auto' }} />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e8611a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
              title={allItems.length === 0 ? 'No Punch Items Yet' : 'No Results'}
              description={allItems.length === 0 ? 'Create the first punch item for this project.' : 'Try adjusting your filters.'}
              action={allItems.length === 0 && canCreate ? <Button onClick={() => setShowCreate(true)}>Create First Item</Button> : undefined}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '10px 14px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', width: '40px' }}>
                      <input type="checkbox"
                        checked={selectedIds.size === items.length && items.length > 0}
                        onChange={toggleSelectAll} />
                    </th>
                    <SortTh label="Item #" col="punch_number" style={{ width: '90px' }} />
                    <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb', width: '120px' }}>Location</th>
                    <SortTh label="Trade" col="trade" style={{ width: '120px' }} />
                    <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>Description</th>
                    <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb', width: '130px' }}>Status</th>
                    <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>Assigned</th>
                    <SortTh label="Due" col="due_date" style={{ width: '110px' }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className={`punch-row ${item.is_overdue ? 'overdue' : ''}`}
                      onClick={() => { setSelected(item); setShowDetail(true) }}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }} onClick={e => { e.stopPropagation(); toggleSelect(item.id) }}>
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} />
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#e8611a' }}>{item.punch_number}</span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#6b7280' }}>{item.location}</span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8b5cf6', background: '#f5f3ff', padding: '2px 7px', borderRadius: '3px' }}>{item.trade}</span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', maxWidth: '280px' }}>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#0f1923', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.description}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <StatusBadge status={item.status} size="sm" />
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151' }}>{item.assigned_to_name ?? '—'}</span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: item.is_overdue ? '#dc2626' : '#374151', fontWeight: item.is_overdue ? 600 : 400 }}>
                          {item.is_overdue ? `⚠ ${daysOverdue(item.due_date!)}d` : fmtDate(item.due_date)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── BOARD VIEW ── */}
      {view === 'board' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'start' }}>
          {STATUS_ORDER.map(status => {
            const meta       = STATUS_FLOW[status]
            const colItems   = items.filter(i => i.status === status)
            return (
              <div key={status}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '8px 12px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>
                    {meta.label}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: meta.color, background: 'white', padding: '1px 6px', borderRadius: '10px' }}>
                    {colItems.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {colItems.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#d1d5db', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', border: '1px dashed #e5e7eb', borderRadius: '4px' }}>
                      No items
                    </div>
                  ) : colItems.map(item => (
                    <div key={item.id} className="board-card"
                      onClick={() => { setSelected(item); setShowDetail(true) }}
                      style={{ padding: '12px', background: 'white', border: `1px solid ${item.is_overdue ? '#fca5a5' : '#e5e7eb'}`, borderRadius: '4px', borderLeft: `3px solid ${item.is_overdue ? '#dc2626' : meta.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 600, color: '#e8611a' }}>{item.punch_number}</span>
                        {item.is_overdue && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#dc2626' }}>⚠ OVERDUE</span>}
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#374151', marginBottom: '8px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.description}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#8b5cf6', background: '#f5f3ff', padding: '2px 6px', borderRadius: '3px' }}>{item.trade}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: '3px' }}>{item.location}</span>
                      </div>
                      {item.assigned_to_name && (
                        <div style={{ marginTop: '8px', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px', color: '#9ca3af' }}>
                          → {item.assigned_to_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CreatePunchModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchItems} />
      <PunchDetailModal item={selected} open={showDetail} onClose={() => { setShowDetail(false); setSelected(null) }} onSaved={fetchItems} />
    </>
  )
}
