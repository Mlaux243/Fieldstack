import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRFIs, type RFI, type RFIPriority, type RFIStatus } from '../hooks/useRFIs'
import {
  PageHeader, Button, Modal, FormField, StatusBadge, PriorityDot,
  EmptyState, Skeleton, SkeletonRow, inputStyle, selectStyle, textareaStyle,
} from '../components/ui'
import { supabase } from '../lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysOverdue(dueDate: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000))
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

// ─── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY_META: Record<RFIPriority, { color: string; bg: string }> = {
  low:      { color: '#2d9e5f', bg: '#f0fdf4' },
  medium:   { color: '#2d6fd4', bg: '#eff6ff' },
  high:     { color: '#e8a020', bg: '#fff7ed' },
  critical: { color: '#dc2626', bg: '#fef2f2' },
}

function PriorityBadge({ priority }: { priority: RFIPriority }) {
  const m = PRIORITY_META[priority]
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '3px', background: m.bg, color: m.color,
      fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
      fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
    }}>
      {priority}
    </span>
  )
}

// ─── Sort header ─────────────────────────────────────────────────────────────

function SortTh({
  label, col, sortBy, sortDir, onSort, style,
}: {
  label: string; col: string; sortBy: string; sortDir: string
  onSort: () => void; style?: React.CSSProperties
}) {
  const active = sortBy === col
  return (
    <th
      onClick={onSort}
      style={{
        padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px', color: active ? '#e8611a' : '#9ca3af',
        fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase',
        textAlign: 'left', cursor: 'pointer', userSelect: 'none',
        whiteSpace: 'nowrap', background: '#fafafa',
        borderBottom: '1px solid #e5e7eb',
        ...style,
      }}
    >
      {label}
      {active && <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

// ─── Create RFI Modal ─────────────────────────────────────────────────────────

function CreateRFIModal({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { activeProject } = useAuth()
  const { createRFI, saving } = useRFIs()

  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([])
  const [form, setForm] = useState({
    subject: '', question: '', priority: 'medium' as RFIPriority,
    ball_in_court_id: '', due_date: '', linked_spec: '', linked_sheet: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open || !activeProject) return
    supabase
      .from('project_users')
      .select('user_id, profile:user_profiles(full_name)')
      .eq('project_id', activeProject.project.id)
      .then(({ data }) => {
        setMembers((data ?? []).map((m: any) => ({
          id: m.user_id, full_name: m.profile?.full_name ?? 'Unknown',
        })))
      })
  }, [open, activeProject])

  function validate() {
    const e: Record<string, string> = {}
    if (!form.subject.trim()) e.subject = 'Subject is required'
    if (!form.question.trim()) e.question = 'Question is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    const { error, id } = await createRFI({
      subject: form.subject,
      question: form.question,
      priority: form.priority,
      ball_in_court_id: form.ball_in_court_id || null,
      due_date: form.due_date || null,
      linked_sheet: form.linked_sheet || null,
      linked_spec: form.linked_spec || null,
    })
    if (error) { setErrors({ _: error }); return }
    setForm({ subject: '', question: '', priority: 'medium', ball_in_court_id: '', due_date: '', linked_spec: '', linked_sheet: '' })
    setErrors({})
    if (id) onCreated(id)
    onClose()
  }

  const F = (key: string, label: string, required = false, children: React.ReactNode) => (
    <FormField label={label} required={required} error={errors[key]}>
      {children}
    </FormField>
  )

  return (
    <Modal open={open} onClose={onClose} title="New RFI" subtitle="Request for Information" width={600}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Create RFI →</Button>
        </>
      }
    >
      {errors._ && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>{errors._}</div>}

      {F('subject', 'Subject', true,
        <input style={{ ...inputStyle, borderColor: errors.subject ? '#fca5a5' : '#e5e7eb' }}
          placeholder="Brief description of the question"
          value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} autoFocus />
      )}

      {F('question', 'Question', true,
        <textarea style={{ ...textareaStyle, minHeight: '120px', borderColor: errors.question ? '#fca5a5' : '#e5e7eb' }}
          placeholder="Provide full detail — reference spec sections, drawing numbers, or conditions as applicable."
          value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {F('priority', 'Priority', false,
          <select style={selectStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as RFIPriority }))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        )}
        {F('due_date', 'Response Due Date', false,
          <input type="date" style={inputStyle} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        )}
      </div>

      {F('ball_in_court_id', 'Ball in Court (Assigned To)', false,
        <select style={selectStyle} value={form.ball_in_court_id} onChange={e => setForm(f => ({ ...f, ball_in_court_id: e.target.value }))}>
          <option value="">Unassigned</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {F('linked_sheet', 'Drawing / Sheet No.', false,
          <input style={inputStyle} placeholder="e.g. A2.01" value={form.linked_sheet} onChange={e => setForm(f => ({ ...f, linked_sheet: e.target.value }))} />
        )}
        {F('linked_spec', 'Spec Section', false,
          <input style={inputStyle} placeholder="e.g. 07 92 00" value={form.linked_spec} onChange={e => setForm(f => ({ ...f, linked_spec: e.target.value }))} />
        )}
      </div>
    </Modal>
  )
}

// ─── Respond Modal ────────────────────────────────────────────────────────────

function RespondModal({
  rfi, open, onClose, onSaved,
}: { rfi: RFI | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const { can } = useAuth()
  const { respondRFI, saving } = useRFIs()
  const [response, setResponse] = useState('')
  const [status,   setStatus]   = useState<RFIStatus>('answered')
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (rfi) { setResponse(rfi.response ?? ''); setStatus(rfi.status === 'open' || rfi.status === 'draft' ? 'answered' : rfi.status); setError(null) }
  }, [rfi])

  const canRespond = can('respond_rfi')

  async function handleSave() {
    if (!rfi) return
    if (!response.trim()) { setError('Response text is required.'); return }
    const { error } = await respondRFI(rfi.id, rfi.rfi_number, { response, status })
    if (error) { setError(error); return }
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={rfi?.rfi_number ?? ''} subtitle={rfi?.subject} width={640}
      footer={canRespond ? (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Response</Button>
        </>
      ) : (
        <Button variant="secondary" onClick={onClose}>Close</Button>
      )}
    >
      {rfi && (
        <>
          {/* Metadata strip */}
          <div style={{ display: 'flex', gap: '20px', padding: '12px 14px', background: '#f9fafb', borderRadius: '4px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              ['Priority',  <PriorityBadge priority={rfi.priority} />],
              ['Status',    <StatusBadge status={rfi.status} size="sm" />],
              ['Due',       <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: rfi.is_overdue ? '#dc2626' : '#374151' }}>{fmtDate(rfi.due_date)}</span>],
              ['Ball in Court', <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#374151' }}>{rfi.ball_in_court_name ?? '—'}</span>],
            ].map(([lbl, val]) => (
              <div key={lbl as string}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>{lbl}</div>
                {val}
              </div>
            ))}
          </div>

          {/* Question */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Question</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', padding: '12px 14px', background: '#f9fafb', borderRadius: '4px', borderLeft: '3px solid #e8611a' }}>
              {rfi.question}
            </div>
          </div>

          {/* Linked refs */}
          {(rfi.linked_sheet || rfi.linked_spec) && (
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              {rfi.linked_sheet && (
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Drawing</div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#2d6fd4', background: '#eff6ff', padding: '2px 8px', borderRadius: '3px' }}>{rfi.linked_sheet}</span>
                </div>
              )}
              {rfi.linked_spec && (
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Spec Section</div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#8b5cf6', background: '#f5f3ff', padding: '2px 8px', borderRadius: '3px' }}>{rfi.linked_spec}</span>
                </div>
              )}
            </div>
          )}

          {/* Response */}
          {canRespond ? (
            <>
              {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>{error}</div>}
              <FormField label="Response" required>
                <textarea
                  style={{ ...textareaStyle, minHeight: '140px' }}
                  placeholder="Provide a formal response to this RFI..."
                  value={response}
                  onChange={e => setResponse(e.target.value)}
                />
              </FormField>
              <FormField label="Update Status">
                <select style={selectStyle} value={status} onChange={e => setStatus(e.target.value as RFIStatus)}>
                  <option value="answered">Answered</option>
                  <option value="closed">Closed</option>
                  <option value="open">Keep Open</option>
                </select>
              </FormField>
            </>
          ) : rfi.response ? (
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Response — {fmtDate(rfi.response_date)} by {rfi.response_by_name ?? '—'}
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', padding: '12px 14px', background: '#f0fdf4', borderRadius: '4px', borderLeft: '3px solid #2d9e5f' }}>
                {rfi.response}
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px' }}>
              No response yet.
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportRFIPDF(rfi: RFI, projectName: string) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:0;padding:32px}
  .header{border-bottom:3px solid #e8611a;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end}
  .brand{font-size:22px;font-weight:800;color:#e8611a;letter-spacing:2px;text-transform:uppercase}
  .rfi-num{font-size:28px;font-weight:800;color:#0f1923}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;padding:14px;background:#f5f5f5;border-radius:4px;margin-bottom:20px}
  .meta-label{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
  .meta-val{font-size:12px;font-weight:600;color:#222}
  .section-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;margin-top:20px}
  .box{padding:14px;border-left:3px solid #e8611a;background:#fef9f7;border-radius:0 4px 4px 0;line-height:1.7;white-space:pre-wrap}
  .response-box{border-left-color:#2d9e5f;background:#f0fdf4}
  .footer{margin-top:40px;border-top:1px solid #ddd;padding-top:12px;color:#999;font-size:10px;display:flex;justify-content:space-between}
  .badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;text-transform:uppercase}
  .priority-critical{background:#fef2f2;color:#dc2626}
  .priority-high{background:#fff7ed;color:#c2410c}
  .priority-medium{background:#eff6ff;color:#2d6fd4}
  .priority-low{background:#f0fdf4;color:#2d9e5f}
</style></head><body>
<div class="header">
  <div>
    <div class="brand">FieldStack</div>
    <div style="color:#666;font-size:11px">${projectName}</div>
  </div>
  <div style="text-align:right">
    <div class="rfi-num">${rfi.rfi_number}</div>
    <div style="color:#666;font-size:11px">Request for Information</div>
  </div>
</div>

<div style="font-size:18px;font-weight:800;color:#0f1923;margin-bottom:16px">${rfi.subject}</div>

<div class="meta-grid">
  <div><div class="meta-label">Status</div><div class="meta-val">${rfi.status.toUpperCase()}</div></div>
  <div><div class="meta-label">Priority</div><div><span class="badge priority-${rfi.priority}">${rfi.priority}</span></div></div>
  <div><div class="meta-label">Due Date</div><div class="meta-val">${fmtDate(rfi.due_date)}</div></div>
  <div><div class="meta-label">Ball in Court</div><div class="meta-val">${rfi.ball_in_court_name ?? '—'}</div></div>
  <div><div class="meta-label">Created By</div><div class="meta-val">${rfi.created_by_name ?? '—'}</div></div>
  <div><div class="meta-label">Created</div><div class="meta-val">${fmtDate(rfi.created_at)}</div></div>
  <div><div class="meta-label">Drawing / Sheet</div><div class="meta-val">${rfi.linked_sheet ?? '—'}</div></div>
  <div><div class="meta-label">Spec Section</div><div class="meta-val">${rfi.linked_spec ?? '—'}</div></div>
</div>

<div class="section-label">Question</div>
<div class="box">${rfi.question}</div>

${rfi.response ? `
<div class="section-label">Response — ${fmtDate(rfi.response_date)} by ${rfi.response_by_name ?? '—'}</div>
<div class="box response-box">${rfi.response}</div>
` : '<div class="section-label">Response</div><div style="color:#999;font-style:italic;padding:12px">No response recorded.</div>'}

<div class="footer">
  <span>Generated by FieldStack · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
  <span>${rfi.rfi_number} · ${projectName}</span>
</div>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

// ─── RFI Page ─────────────────────────────────────────────────────────────────

export default function RFIsPage() {
  const { activeProject, can } = useAuth()
  const {
    rfis, allRFIs, loading, error,
    filters, setFilters, sortBy, sortDir, toggleSort,
    fetchRFIs, voidRFI, saving,
  } = useRFIs()

  const [showCreate,  setShowCreate]  = useState(false)
  const [selectedRFI, setSelectedRFI] = useState<RFI | null>(null)
  const [showRespond, setShowRespond] = useState(false)

  const canCreate   = can('create_rfi')
  const canRespond  = can('respond_rfi')

  // Stats bar
  const stats = {
    open:     allRFIs.filter(r => r.status === 'open').length,
    answered: allRFIs.filter(r => r.status === 'answered').length,
    overdue:  allRFIs.filter(r => r.is_overdue).length,
    closed:   allRFIs.filter(r => r.status === 'closed').length,
  }

  if (!activeProject) {
    return <EmptyState title="No Project Selected" description="Select a project to view RFIs." />
  }

  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .rfi-row{cursor:pointer;transition:background 0.1s}
        .rfi-row:hover{background:#fafafa}
        .rfi-row.overdue td:first-child{border-left:3px solid #dc2626}
        .rfi-row.critical-row td:first-child{border-left:3px solid #dc2626}
        input:focus,select:focus,textarea:focus{border-color:#e8611a!important;outline:none}
      `}</style>

      <PageHeader
        title="RFIs"
        subtitle={`${allRFIs.length} total · ${stats.open} open · ${stats.overdue > 0 ? `${stats.overdue} overdue` : 'none overdue'}`}
        actions={
          canCreate ? (
            <Button
              onClick={() => setShowCreate(true)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
            >
              New RFI
            </Button>
          ) : undefined
        }
      />

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Open',     val: stats.open,     color: '#e8611a', filter: 'open' as const },
          { label: 'Answered', val: stats.answered, color: '#2d6fd4', filter: 'answered' as const },
          { label: 'Overdue',  val: stats.overdue,  color: '#dc2626', filter: 'open' as const },
          { label: 'Closed',   val: stats.closed,   color: '#2d9e5f', filter: 'closed' as const },
        ].map(s => (
          <div
            key={s.label}
            onClick={() => setFilters(f => ({ ...f, status: f.status === s.filter ? 'all' : s.filter, overdue_only: s.label === 'Overdue' ? !f.overdue_only : false }))}
            style={{
              padding: '10px 18px', borderRadius: '4px', cursor: 'pointer',
              background: 'white', border: `1.5px solid #e5e7eb`,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = s.color}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'}
          >
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '28px', fontWeight: 800, color: s.val > 0 ? s.color : '#d1d5db', lineHeight: 1 }}>
              {s.val}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '3px' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '300px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input style={{ ...inputStyle, paddingLeft: '32px' }} placeholder="Search RFIs..."
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>

        <select style={{ ...selectStyle, width: '140px' }} value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value as any }))}>
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="answered">Answered</option>
          <option value="closed">Closed</option>
          <option value="void">Void</option>
        </select>

        <select style={{ ...selectStyle, width: '140px' }} value={filters.priority}
          onChange={e => setFilters(f => ({ ...f, priority: e.target.value as any }))}>
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: filters.overdue_only ? '#dc2626' : '#6b7280', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={filters.overdue_only} onChange={e => setFilters(f => ({ ...f, overdue_only: e.target.checked }))} />
          Overdue only
        </label>

        {(filters.status !== 'all' || filters.priority !== 'all' || filters.search || filters.overdue_only) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ status: 'all', priority: 'all', ball_in_court: 'all', search: '', overdue_only: false })}>
            Clear filters
          </Button>
        )}

        <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
          {rfis.length} result{rfis.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '0 20px' }}>
            {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : rfis.length === 0 ? (
          <EmptyState
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e8611a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            title={allRFIs.length === 0 ? 'No RFIs Yet' : 'No Results'}
            description={allRFIs.length === 0 ? 'Create the first RFI for this project.' : 'Try adjusting your filters.'}
            action={allRFIs.length === 0 && canCreate ? <Button onClick={() => setShowCreate(true)}>Create First RFI</Button> : undefined}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <SortTh label="RFI #"      col="rfi_number" sortBy={sortBy} sortDir={sortDir} onSort={() => toggleSort('rfi_number')} style={{ width: '100px' }} />
                  <SortTh label="Subject"    col="rfi_number" sortBy={sortBy} sortDir={sortDir} onSort={() => toggleSort('rfi_number')} />
                  <SortTh label="Priority"   col="priority"   sortBy={sortBy} sortDir={sortDir} onSort={() => toggleSort('priority')} style={{ width: '110px' }} />
                  <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb', width: '120px' }}>Status</th>
                  <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>Ball in Court</th>
                  <SortTh label="Due Date"   col="due_date"   sortBy={sortBy} sortDir={sortDir} onSort={() => toggleSort('due_date')} style={{ width: '120px' }} />
                  <SortTh label="Updated"    col="updated_at" sortBy={sortBy} sortDir={sortDir} onSort={() => toggleSort('updated_at')} style={{ width: '100px' }} />
                  <th style={{ padding: '10px 14px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', width: '80px' }} />
                </tr>
              </thead>
              <tbody>
                {rfis.map(rfi => (
                  <tr
                    key={rfi.id}
                    className={`rfi-row ${rfi.is_overdue ? 'overdue' : ''} ${rfi.priority === 'critical' ? 'critical-row' : ''}`}
                    onClick={() => { setSelectedRFI(rfi); setShowRespond(true) }}
                  >
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#e8611a' }}>
                        {rfi.rfi_number}
                      </span>
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6', maxWidth: '280px' }}>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#0f1923', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rfi.subject}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                        {rfi.linked_sheet && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#2d6fd4' }}>{rfi.linked_sheet}</span>}
                        {rfi.linked_spec  && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#8b5cf6' }}>{rfi.linked_spec}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <PriorityBadge priority={rfi.priority} />
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <StatusBadge status={rfi.status} size="sm" />
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151' }}>
                        {rfi.ball_in_court_name ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                      {rfi.due_date ? (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: rfi.is_overdue ? '#dc2626' : '#374151', fontWeight: rfi.is_overdue ? 600 : 400 }}>
                          {rfi.is_overdue ? `⚠ ${daysOverdue(rfi.due_date)}d late` : fmtDate(rfi.due_date)}
                        </span>
                      ) : (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#d1d5db' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
                        {timeAgo(rfi.updated_at)}
                      </span>
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => exportRFIPDF(rfi, activeProject.project.name)}
                          title="Export PDF"
                          style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2d6fd4'; (e.currentTarget as HTMLElement).style.color = '#2d6fd4' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
                          </svg>
                        </button>
                        {rfi.status !== 'void' && rfi.status !== 'closed' && can('respond_rfi') && (
                          <button
                            onClick={async () => { if (window.confirm(`Void ${rfi.rfi_number}?`)) await voidRFI(rfi.id, rfi.rfi_number) }}
                            title="Void RFI"
                            style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#dc2626'; (e.currentTarget as HTMLElement).style.color = '#dc2626' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateRFIModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={id => { fetchRFIs() }}
      />
      <RespondModal
        rfi={selectedRFI}
        open={showRespond}
        onClose={() => { setShowRespond(false); setSelectedRFI(null) }}
        onSaved={fetchRFIs}
      />
    </>
  )
}
