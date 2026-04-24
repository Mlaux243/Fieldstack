import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  useSubmittals, type Submittal, type SubmittalStatus, type SubmittalRevision,
} from '../hooks/useSubmittals'
import {
  PageHeader, Button, Modal, FormField, StatusBadge,
  EmptyState, Skeleton, SkeletonRow, inputStyle, selectStyle, textareaStyle,
} from '../components/ui'
import { supabase } from '../lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

// ─── Status meta ──────────────────────────────────────────────────────────────

const STATUS_META: Record<SubmittalStatus, { label: string; color: string; bg: string; next: SubmittalStatus[] }> = {
  draft:               { label: 'Draft',                color: '#6b7280', bg: '#f3f4f6', next: ['submitted'] },
  submitted:           { label: 'Submitted',            color: '#2d6fd4', bg: '#eff6ff', next: ['under_review', 'approved', 'approved_as_noted', 'revise_and_resubmit', 'rejected'] },
  under_review:        { label: 'Under Review',         color: '#ca8a04', bg: '#fefce8', next: ['approved', 'approved_as_noted', 'revise_and_resubmit', 'rejected'] },
  approved:            { label: 'Approved',             color: '#2d9e5f', bg: '#f0fdf4', next: [] },
  approved_as_noted:   { label: 'Approved as Noted',    color: '#15803d', bg: '#f0fdf4', next: [] },
  revise_and_resubmit: { label: 'Revise & Resubmit',   color: '#c2410c', bg: '#fff7ed', next: [] },
  rejected:            { label: 'Rejected',             color: '#dc2626', bg: '#fef2f2', next: [] },
}

const REVIEWER_STATUSES: SubmittalStatus[] = [
  'approved', 'approved_as_noted', 'revise_and_resubmit', 'rejected',
]

// ─── Sortable header ──────────────────────────────────────────────────────────

function SortTh({ label, col, sortBy, sortDir, onSort, style }: {
  label: string; col: string; sortBy: string; sortDir: string
  onSort: () => void; style?: React.CSSProperties
}) {
  const active = sortBy === col
  return (
    <th onClick={onSort} style={{
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

// ─── Revision timeline ────────────────────────────────────────────────────────

function RevisionTimeline({ revisions }: { revisions: SubmittalRevision[] }) {
  if (revisions.length === 0) return null

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '14px' }}>
        Revision History
      </div>
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: '15px', top: '20px', bottom: '20px', width: '1px', background: '#e5e7eb' }} />

        {revisions.map((rev, i) => {
          const meta = STATUS_META[rev.status]
          return (
            <div key={rev.id} style={{ display: 'flex', gap: '14px', marginBottom: '16px', position: 'relative' }}>
              {/* Dot */}
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                background: i === 0 ? meta.color : '#e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px',
                fontWeight: 800, color: i === 0 ? 'white' : '#9ca3af',
                border: `2px solid ${i === 0 ? meta.color : '#e5e7eb'}`,
                position: 'relative', zIndex: 1,
              }}>
                {rev.revision_number}
              </div>

              {/* Content */}
              <div style={{
                flex: 1, padding: '10px 14px',
                background: i === 0 ? meta.bg : '#fafafa',
                border: `1px solid ${i === 0 ? `${meta.color}40` : '#e5e7eb'}`,
                borderRadius: '4px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                    fontWeight: 600, color: meta.color,
                    background: meta.bg, padding: '2px 8px', borderRadius: '3px',
                  }}>
                    {meta.label}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>
                    Rev {rev.revision_number}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {rev.submitted_at && (
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase' }}>Submitted</div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#374151' }}>
                        {fmtDate(rev.submitted_at.split('T')[0])} {rev.submitted_by_name && `by ${rev.submitted_by_name}`}
                      </div>
                    </div>
                  )}
                  {rev.returned_at && (
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase' }}>Returned</div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#374151' }}>
                        {fmtDate(rev.returned_at.split('T')[0])} {rev.returned_by_name && `by ${rev.returned_by_name}`}
                      </div>
                    </div>
                  )}
                </div>

                {rev.notes && (
                  <div style={{ marginTop: '8px', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{rev.notes}"
                  </div>
                )}

                {rev.dropbox_path && (
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#2d6fd4', background: '#eff6ff', padding: '2px 8px', borderRadius: '3px' }}>
                      📎 {rev.dropbox_path.split('/').pop()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Create Submittal Modal ───────────────────────────────────────────────────

function CreateSubmittalModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const { activeProject } = useAuth()
  const { createSubmittal, saving } = useSubmittals()
  const [members, setMembers] = useState<{ id: string; full_name: string; role: string }[]>([])
  const [form, setForm] = useState({
    spec_section: '', spec_title: '', description: '',
    subcontractor_id: '', reviewer_id: '',
    submitted_date: '', required_return_date: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open || !activeProject) return
    supabase
      .from('project_users')
      .select('user_id, role, profile:user_profiles(full_name)')
      .eq('project_id', activeProject.project.id)
      .then(({ data }) => {
        setMembers((data ?? []).map((m: any) => ({
          id: m.user_id, full_name: m.profile?.full_name ?? 'Unknown', role: m.role,
        })))
      })
  }, [open, activeProject])

  function validate() {
    const e: Record<string, string> = {}
    if (!form.spec_section.trim()) e.spec_section = 'Spec section is required'
    if (!form.description.trim())  e.description  = 'Description is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    const { error } = await createSubmittal({
      spec_section:         form.spec_section,
      spec_title:           form.spec_title,
      description:          form.description,
      subcontractor_id:     form.subcontractor_id  || null,
      reviewer_id:          form.reviewer_id       || null,
      submitted_date:       form.submitted_date     || null,
      required_return_date: form.required_return_date || null,
    })
    if (error) { setErrors({ _: error }); return }
    setForm({ spec_section: '', spec_title: '', description: '', subcontractor_id: '', reviewer_id: '', submitted_date: '', required_return_date: '' })
    setErrors({})
    onCreated()
    onClose()
  }

  const subs = members.filter(m => ['subcontractor', 'gc_field', 'gc_admin'].includes(m.role))
  const reviewers = members.filter(m => ['architect', 'gc_admin'].includes(m.role))

  return (
    <Modal open={open} onClose={onClose} title="New Submittal" width={620}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Create Submittal →</Button>
        </>
      }
    >
      {errors._ && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>{errors._}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
        <FormField label="Spec Section" required error={errors.spec_section}>
          <input style={{ ...inputStyle, borderColor: errors.spec_section ? '#fca5a5' : '#e5e7eb' }}
            placeholder="07 92 00" value={form.spec_section}
            onChange={e => setForm(f => ({ ...f, spec_section: e.target.value }))} autoFocus />
        </FormField>
        <FormField label="Spec Title">
          <input style={inputStyle} placeholder="Joint Sealants"
            value={form.spec_title} onChange={e => setForm(f => ({ ...f, spec_title: e.target.value }))} />
        </FormField>
      </div>

      <FormField label="Description" required error={errors.description}>
        <input style={{ ...inputStyle, borderColor: errors.description ? '#fca5a5' : '#e5e7eb' }}
          placeholder="e.g. Waterproof membrane product data and installation instructions"
          value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Submitted By (Subcontractor)">
          <select style={selectStyle} value={form.subcontractor_id}
            onChange={e => setForm(f => ({ ...f, subcontractor_id: e.target.value }))}>
            <option value="">Select...</option>
            {subs.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </FormField>
        <FormField label="Reviewer (Architect / GC)">
          <select style={selectStyle} value={form.reviewer_id}
            onChange={e => setForm(f => ({ ...f, reviewer_id: e.target.value }))}>
            <option value="">Select...</option>
            {reviewers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </FormField>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Date Submitted">
          <input type="date" style={inputStyle} value={form.submitted_date}
            onChange={e => setForm(f => ({ ...f, submitted_date: e.target.value }))} />
        </FormField>
        <FormField label="Required Return Date">
          <input type="date" style={inputStyle} value={form.required_return_date}
            onChange={e => setForm(f => ({ ...f, required_return_date: e.target.value }))} />
        </FormField>
      </div>

      <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#166534' }}>
        💡 Leave "Date Submitted" blank to save as <strong>Draft</strong>. Fill it in to mark as <strong>Submitted</strong>.
      </div>
    </Modal>
  )
}

// ─── Detail / Review Modal ────────────────────────────────────────────────────

function SubmittalDetailModal({ submittal, open, onClose, onSaved }: {
  submittal: Submittal | null; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const { can } = useAuth()
  const { reviewSubmittal, resubmit, saving } = useSubmittals()

  const [revisions, setRevisions]     = useState<SubmittalRevision[]>([])
  const [loadingRevs, setLoadingRevs] = useState(false)
  const [activeTab, setActiveTab]     = useState<'detail' | 'review' | 'resubmit'>('detail')
  const [reviewForm, setReviewForm]   = useState({ status: 'approved' as SubmittalStatus, notes: '', dropbox_path: '' })
  const [resubmitNotes, setResubmitNotes] = useState('')
  const [error, setError]             = useState<string | null>(null)

  const { fetchRevisions } = useSubmittals()

  useEffect(() => {
    if (!submittal || !open) return
    setActiveTab('detail'); setError(null)
    setReviewForm({ status: 'approved', notes: '', dropbox_path: '' })
    setResubmitNotes('')
    setLoadingRevs(true)
    fetchRevisions(submittal.id).then(revs => {
      setRevisions(revs); setLoadingRevs(false)
    })
  }, [submittal, open, fetchRevisions])

  const canReview    = can('approve_submittal')
  const canResubmit  = can('create_submittal') &&
    submittal?.status === 'revise_and_resubmit'
  const inReview     = submittal && ['submitted', 'under_review'].includes(submittal.status)

  async function handleReview() {
    if (!submittal) return
    setError(null)
    const { error } = await reviewSubmittal(
      submittal.id, submittal.submittal_number,
      submittal.current_revision, reviewForm
    )
    if (error) { setError(error); return }
    onSaved(); onClose()
  }

  async function handleResubmit() {
    if (!submittal) return
    setError(null)
    const { error } = await resubmit(
      submittal.id, submittal.submittal_number,
      submittal.current_revision, resubmitNotes
    )
    if (error) { setError(error); return }
    onSaved(); onClose()
  }

  if (!submittal) return null

  const meta = STATUS_META[submittal.status]

  const Tab = ({ id, label }: { id: typeof activeTab; label: string }) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding: '8px 16px', border: 'none', cursor: 'pointer',
      background: activeTab === id ? 'white' : 'transparent',
      color: activeTab === id ? '#0f1923' : '#6b7280',
      fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
      fontWeight: activeTab === id ? 700 : 400,
      textTransform: 'uppercase', letterSpacing: '0.5px', borderRadius: '4px',
      transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )

  return (
    <Modal open={open} onClose={onClose}
      title={submittal.submittal_number}
      subtitle={`${submittal.spec_section}${submittal.spec_title ? ` · ${submittal.spec_title}` : ''}`}
      width={680}
      footer={
        activeTab === 'review' && canReview && inReview ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleReview} loading={saving}>Submit Review</Button>
          </>
        ) : activeTab === 'resubmit' && canResubmit ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleResubmit} loading={saving}>Resubmit →</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>Close</Button>
        )
      }
    >
      {/* Status strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
        background: meta.bg, borderRadius: '4px', marginBottom: '16px', flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 600, color: meta.color, padding: '3px 10px', background: 'white', borderRadius: '3px', border: `1px solid ${meta.color}40` }}>
          {meta.label}
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>
          Rev {submittal.current_revision}
        </span>
        {submittal.is_overdue && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>
            ⚠ Overdue
          </span>
        )}
      </div>

      {/* Tabs — only show if action available */}
      {(canReview && inReview) || canResubmit ? (
        <div style={{ display: 'flex', gap: '4px', padding: '4px', background: '#f3f4f6', borderRadius: '6px', marginBottom: '20px' }}>
          <Tab id="detail"   label="Details" />
          {canReview && inReview  && <Tab id="review"   label="Record Review" />}
          {canResubmit            && <Tab id="resubmit" label="Resubmit" />}
        </div>
      ) : null}

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}

      {/* ── Detail Tab ── */}
      {activeTab === 'detail' && (
        <>
          {/* Metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {[
              ['Description',      submittal.description],
              ['Subcontractor',    submittal.subcontractor_name ?? '—'],
              ['Reviewer',         submittal.reviewer_name ?? '—'],
              ['Date Submitted',   fmtDate(submittal.submitted_date)],
              ['Required Return',  fmtDate(submittal.required_return_date)],
              ['Returned',         fmtDate(submittal.returned_date)],
            ].map(([label, val]) => (
              <div key={label as string}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {label}
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151' }}>
                  {val}
                </div>
              </div>
            ))}
          </div>

          {/* Revision history */}
          {loadingRevs ? (
            <div style={{ padding: '16px 0' }}>
              {[1,2].map(i => <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}><Skeleton width={30} height={30} borderRadius="50%" /><Skeleton height={60} style={{ flex: 1 }} /></div>)}
            </div>
          ) : (
            <RevisionTimeline revisions={revisions} />
          )}
        </>
      )}

      {/* ── Review Tab ── */}
      {activeTab === 'review' && (
        <>
          <FormField label="Review Decision" required>
            <select style={selectStyle} value={reviewForm.status}
              onChange={e => setReviewForm(f => ({ ...f, status: e.target.value as SubmittalStatus }))}>
              {REVIEWER_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </FormField>

          {/* Decision preview */}
          <div style={{
            padding: '10px 12px', borderRadius: '4px', marginBottom: '18px',
            background: STATUS_META[reviewForm.status].bg,
            border: `1px solid ${STATUS_META[reviewForm.status].color}30`,
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px',
            color: STATUS_META[reviewForm.status].color,
          }}>
            {reviewForm.status === 'approved'            && '✓ Submittal is accepted as submitted. Work may proceed.'}
            {reviewForm.status === 'approved_as_noted'   && '✓ Submittal is accepted with minor comments noted. Review comments carefully before proceeding.'}
            {reviewForm.status === 'revise_and_resubmit' && '↺ Submittal requires revisions. Subcontractor must correct and resubmit before proceeding.'}
            {reviewForm.status === 'rejected'            && '✕ Submittal is not acceptable. New submittal required.'}
          </div>

          <FormField label="Review Notes / Comments">
            <textarea style={{ ...textareaStyle, minHeight: '120px' }}
              placeholder="Enter any review comments, conditions, or clarifications..."
              value={reviewForm.notes}
              onChange={e => setReviewForm(f => ({ ...f, notes: e.target.value }))} />
          </FormField>

          <FormField label="Dropbox File Path (stamped PDF)" hint="Paste the Dropbox path to the stamped/returned submittal document">
            <input style={inputStyle}
              placeholder="/FieldStack/ProjectName/Submittals/SUB-001-Rev0-Approved.pdf"
              value={reviewForm.dropbox_path}
              onChange={e => setReviewForm(f => ({ ...f, dropbox_path: e.target.value }))} />
          </FormField>
        </>
      )}

      {/* ── Resubmit Tab ── */}
      {activeTab === 'resubmit' && (
        <>
          <div style={{
            padding: '12px 14px', background: '#fff7ed', border: '1px solid #fed7aa',
            borderRadius: '4px', marginBottom: '20px',
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#92400e', lineHeight: 1.6,
          }}>
            <strong>Revise & Resubmit</strong> — This will create Revision {submittal.current_revision + 1} of this submittal and set the status back to Submitted.
          </div>

          <FormField label="Revision Notes" hint="Describe what was changed in this resubmission">
            <textarea style={{ ...textareaStyle, minHeight: '120px' }}
              placeholder="e.g. Updated product data per architect comment. Substituted manufacturer from Rev 0."
              value={resubmitNotes}
              onChange={e => setResubmitNotes(e.target.value)} />
          </FormField>
        </>
      )}
    </Modal>
  )
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportSubmittalPDF(s: Submittal, projectName: string) {
  const meta = STATUS_META[s.status]
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:0;padding:32px}
  .header{border-bottom:3px solid #2d6fd4;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end}
  .brand{font-size:22px;font-weight:800;color:#2d6fd4;letter-spacing:2px;text-transform:uppercase}
  .sub-num{font-size:28px;font-weight:800;color:#0f1923}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:14px;background:#f5f5f5;border-radius:4px;margin-bottom:20px}
  .meta-label{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
  .meta-val{font-size:12px;font-weight:600;color:#222}
  .status-badge{display:inline-block;padding:4px 12px;border-radius:3px;font-size:11px;font-weight:700;text-transform:uppercase;background:${meta.bg};color:${meta.color}}
  .footer{margin-top:40px;border-top:1px solid #ddd;padding-top:12px;color:#999;font-size:10px;display:flex;justify-content:space-between}
</style></head><body>
<div class="header">
  <div>
    <div class="brand">FieldStack</div>
    <div style="color:#666;font-size:11px">${projectName}</div>
  </div>
  <div style="text-align:right">
    <div class="sub-num">${s.submittal_number}</div>
    <div style="color:#666;font-size:11px">Submittal — Rev ${s.current_revision}</div>
  </div>
</div>
<div style="font-size:18px;font-weight:800;color:#0f1923;margin-bottom:6px">${s.description}</div>
<div style="margin-bottom:20px"><span class="status-badge">${meta.label}</span></div>
<div class="meta-grid">
  <div><div class="meta-label">Spec Section</div><div class="meta-val">${s.spec_section}</div></div>
  <div><div class="meta-label">Spec Title</div><div class="meta-val">${s.spec_title ?? '—'}</div></div>
  <div><div class="meta-label">Revision</div><div class="meta-val">Rev ${s.current_revision}</div></div>
  <div><div class="meta-label">Subcontractor</div><div class="meta-val">${s.subcontractor_name ?? '—'}</div></div>
  <div><div class="meta-label">Reviewer</div><div class="meta-val">${s.reviewer_name ?? '—'}</div></div>
  <div><div class="meta-label">Date Submitted</div><div class="meta-val">${fmtDate(s.submitted_date)}</div></div>
  <div><div class="meta-label">Required Return</div><div class="meta-val">${fmtDate(s.required_return_date)}</div></div>
  <div><div class="meta-label">Returned</div><div class="meta-val">${fmtDate(s.returned_date)}</div></div>
</div>
<div class="footer">
  <span>Generated by FieldStack · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
  <span>${s.submittal_number} · ${projectName}</span>
</div>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html); win.document.close(); win.focus()
  setTimeout(() => win.print(), 400)
}

// ─── Submittals Page ──────────────────────────────────────────────────────────

export default function SubmittalsPage() {
  const { activeProject, can } = useAuth()
  const {
    submittals, allSubmittals, loading, error,
    filters, setFilters, sortBy, sortDir, toggleSort, fetchSubmittals,
  } = useSubmittals()

  const [showCreate,  setShowCreate]  = useState(false)
  const [selected,    setSelected]    = useState<Submittal | null>(null)
  const [showDetail,  setShowDetail]  = useState(false)

  const canCreate = can('create_submittal')

  // Status distribution for stats bar
  const stats = {
    submitted:    allSubmittals.filter(s => s.status === 'submitted').length,
    under_review: allSubmittals.filter(s => s.status === 'under_review').length,
    approved:     allSubmittals.filter(s => ['approved','approved_as_noted'].includes(s.status)).length,
    revise:       allSubmittals.filter(s => s.status === 'revise_and_resubmit').length,
    overdue:      allSubmittals.filter(s => s.is_overdue).length,
  }

  if (!activeProject) {
    return <EmptyState title="No Project Selected" description="Select a project to view submittals." />
  }

  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .sub-row{cursor:pointer;transition:background 0.1s}
        .sub-row:hover{background:#fafafa}
        .sub-row.overdue td:first-child{border-left:3px solid #dc2626}
        input:focus,select:focus,textarea:focus{border-color:#e8611a!important;outline:none}
      `}</style>

      <PageHeader
        title="Submittals"
        subtitle={`${allSubmittals.length} total · ${stats.submitted + stats.under_review} pending review · ${stats.approved} approved`}
        actions={canCreate ? (
          <Button onClick={() => setShowCreate(true)}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}>
            New Submittal
          </Button>
        ) : undefined}
      />

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Submitted',    val: stats.submitted,    color: '#2d6fd4', filter: 'submitted' as SubmittalStatus },
          { label: 'Under Review', val: stats.under_review, color: '#ca8a04', filter: 'under_review' as SubmittalStatus },
          { label: 'Approved',     val: stats.approved,     color: '#2d9e5f', filter: 'approved' as SubmittalStatus },
          { label: 'Revise',       val: stats.revise,       color: '#c2410c', filter: 'revise_and_resubmit' as SubmittalStatus },
          { label: 'Overdue',      val: stats.overdue,      color: '#dc2626', filter: 'submitted' as SubmittalStatus },
        ].map(s => (
          <div key={s.label}
            onClick={() => setFilters(f => ({ ...f, status: f.status === s.filter ? 'all' : s.filter, overdue_only: s.label === 'Overdue' ? !f.overdue_only : false }))}
            style={{ padding: '10px 16px', borderRadius: '4px', cursor: 'pointer', background: 'white', border: '1.5px solid #e5e7eb', transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = s.color}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'}
          >
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '28px', fontWeight: 800, color: s.val > 0 ? s.color : '#d1d5db', lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '3px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '300px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input style={{ ...inputStyle, paddingLeft: '32px' }} placeholder="Search submittals..."
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>

        <select style={{ ...selectStyle, width: '180px' }} value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value as any }))}>
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="approved_as_noted">Approved as Noted</option>
          <option value="revise_and_resubmit">Revise & Resubmit</option>
          <option value="rejected">Rejected</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: filters.overdue_only ? '#dc2626' : '#6b7280', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={filters.overdue_only} onChange={e => setFilters(f => ({ ...f, overdue_only: e.target.checked }))} />
          Overdue only
        </label>

        {(filters.status !== 'all' || filters.search || filters.overdue_only) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ status: 'all', search: '', overdue_only: false })}>
            Clear filters
          </Button>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
          {submittals.length} result{submittals.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '0 20px' }}>{[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}</div>
        ) : submittals.length === 0 ? (
          <EmptyState
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d6fd4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            title={allSubmittals.length === 0 ? 'No Submittals Yet' : 'No Results'}
            description={allSubmittals.length === 0 ? 'Create the first submittal for this project.' : 'Try adjusting your filters.'}
            action={allSubmittals.length === 0 && canCreate ? <Button onClick={() => setShowCreate(true)}>Create First Submittal</Button> : undefined}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <SortTh label="Sub #"       col="submittal_number"   sortBy={sortBy} sortDir={sortDir} onSort={() => toggleSort('submittal_number')}   style={{ width: '100px' }} />
                  <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb', width: '90px' }}>Spec</th>
                  <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>Description</th>
                  <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb', width: '130px' }}>Status</th>
                  <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb', width: '60px' }}>Rev</th>
                  <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>Subcontractor</th>
                  <SortTh label="Return By"   col="required_return_date" sortBy={sortBy} sortDir={sortDir} onSort={() => toggleSort('required_return_date')} style={{ width: '120px' }} />
                  <SortTh label="Updated"     col="updated_at"          sortBy={sortBy} sortDir={sortDir} onSort={() => toggleSort('updated_at')}          style={{ width: '100px' }} />
                  <th style={{ padding: '10px 14px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', width: '50px' }} />
                </tr>
              </thead>
              <tbody>
                {submittals.map(s => (
                  <tr key={s.id} className={`sub-row ${s.is_overdue ? 'overdue' : ''}`}
                    onClick={() => { setSelected(s); setShowDetail(true) }}>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#2d6fd4' }}>{s.submittal_number}</span>
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8b5cf6', background: '#f5f3ff', padding: '2px 7px', borderRadius: '3px' }}>{s.spec_section}</span>
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6', maxWidth: '260px' }}>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#0f1923', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</div>
                      {s.spec_title && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>{s.spec_title}</div>}
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <StatusBadge status={s.status} size="sm" />
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#374151' }}>Rev {s.current_revision}</span>
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151' }}>{s.subcontractor_name ?? '—'}</span>
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: s.is_overdue ? '#dc2626' : '#374151', fontWeight: s.is_overdue ? 600 : 400 }}>
                        {s.is_overdue ? `⚠ Overdue` : fmtDate(s.required_return_date)}
                      </span>
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>{timeAgo(s.updated_at)}</span>
                    </td>
                    <td style={{ padding: '13px 14px', borderBottom: '1px solid #f3f4f6' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => exportSubmittalPDF(s, activeProject.project.name)}
                        title="Export PDF"
                        style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2d6fd4'; (e.currentTarget as HTMLElement).style.color = '#2d6fd4' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateSubmittalModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchSubmittals} />
      <SubmittalDetailModal submittal={selected} open={showDetail} onClose={() => { setShowDetail(false); setSelected(null) }} onSaved={fetchSubmittals} />
    </>
  )
}
