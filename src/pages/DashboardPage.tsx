import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDashboard } from '../hooks/useDashboard'
import {
  StatusBadge, Skeleton, SkeletonCard, EmptyState,
  Button, Modal, FormField, inputStyle, selectStyle, textareaStyle,
} from '../components/ui'
import { supabase } from '../lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const MODULE_COLORS: Record<string, string> = {
  rfi: '#e8611a', submittal: '#2d6fd4', punch_item: '#dc2626',
  task: '#8b5cf6', daily_report: '#2d9e5f', drawing: '#0891b2',
  document: '#6b7280', photo: '#ca8a04',
}

const MODULE_LABELS: Record<string, string> = {
  rfi: 'RFI', submittal: 'Submittal', punch_item: 'Punch',
  task: 'Task', daily_report: 'Report', drawing: 'Drawing',
  document: 'Doc', photo: 'Photo',
}

// ─── Quick Create: RFI ────────────────────────────────────────────────────────

function QuickCreateRFI({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { activeProject, user } = useAuth()
  const [form, setForm] = useState({ subject: '', question: '', priority: 'medium', due_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!activeProject || !user) return
    if (!form.subject.trim() || !form.question.trim()) {
      setError('Subject and question are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Get next RFI number
      const { data: counterData, error: cErr } = await supabase
        .rpc('next_project_counter', {
          p_project_id: activeProject.project.id,
          p_counter_name: 'rfi',
        })
      if (cErr) throw cErr
      const num = String(counterData).padStart(3, '0')
      const rfiNumber = `RFI-${num}`

      const { error: insertErr } = await supabase.from('rfis').insert({
        project_id: activeProject.project.id,
        rfi_number: rfiNumber,
        subject: form.subject.trim(),
        question: form.question.trim(),
        priority: form.priority,
        due_date: form.due_date || null,
        status: 'open',
        created_by: user.id,
        ball_in_court_id: user.id,
      })
      if (insertErr) throw insertErr

      // Log activity
      await supabase.from('activity_log').insert({
        project_id: activeProject.project.id,
        user_id: user.id,
        module: 'rfi',
        record_label: rfiNumber,
        action: 'created',
      })

      setForm({ subject: '', question: '', priority: 'medium', due_date: '' })
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to create RFI')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title="New RFI"
      subtitle="Request for Information"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Create RFI</Button>
        </>
      }
    >
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}
      <FormField label="Subject" required>
        <input style={inputStyle} placeholder="e.g. Clarification on waterproofing membrane spec" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
      </FormField>
      <FormField label="Question" required>
        <textarea style={textareaStyle} placeholder="Describe the question in detail..." value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} />
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Priority">
          <select style={selectStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </FormField>
        <FormField label="Due Date">
          <input type="date" style={inputStyle} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        </FormField>
      </div>
    </Modal>
  )
}

// ─── Quick Create: Punch Item ─────────────────────────────────────────────────

function QuickCreatePunch({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { activeProject, user } = useAuth()
  const [form, setForm] = useState({ location: '', trade: '', description: '', due_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!activeProject || !user) return
    if (!form.location.trim() || !form.description.trim() || !form.trade.trim()) {
      setError('Location, trade, and description are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { data: counterData, error: cErr } = await supabase
        .rpc('next_project_counter', { p_project_id: activeProject.project.id, p_counter_name: 'punch' })
      if (cErr) throw cErr
      const punchNumber = `PL-${String(counterData).padStart(3, '0')}`

      const { error: insertErr } = await supabase.from('punch_items').insert({
        project_id: activeProject.project.id,
        punch_number: punchNumber,
        location: form.location.trim(),
        trade: form.trade.trim(),
        description: form.description.trim(),
        due_date: form.due_date || null,
        status: 'open',
        created_by: user.id,
      })
      if (insertErr) throw insertErr

      await supabase.from('activity_log').insert({
        project_id: activeProject.project.id,
        user_id: user.id,
        module: 'punch_item',
        record_label: punchNumber,
        action: 'created',
      })

      setForm({ location: '', trade: '', description: '', due_date: '' })
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to create punch item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title="New Punch Item"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Create Item</Button>
        </>
      }
    >
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Location" required>
          <input style={inputStyle} placeholder="e.g. Level 2, Unit 204" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
        </FormField>
        <FormField label="Trade Responsible" required>
          <input style={inputStyle} placeholder="e.g. Drywall" value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} />
        </FormField>
      </div>
      <FormField label="Description" required>
        <textarea style={textareaStyle} placeholder="Describe the deficiency..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </FormField>
      <FormField label="Due Date">
        <input type="date" style={inputStyle} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
      </FormField>
    </Modal>
  )
}

// ─── Quick Create: Daily Report ───────────────────────────────────────────────

function QuickCreateDaily({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { activeProject, user, activeProject: ap } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ report_date: today, trade: ap?.trade ?? '', weather_condition: 'clear', temp_high: '', temp_low: '', work_performed: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!activeProject || !user) return
    if (!form.work_performed.trim()) { setError('Work performed is required.'); return }
    setSaving(true)
    setError(null)
    try {
      const { error: insertErr } = await supabase.from('daily_reports').insert({
        project_id: activeProject.project.id,
        report_date: form.report_date,
        submitted_by: user.id,
        trade: form.trade || null,
        weather_condition: form.weather_condition,
        temp_high: form.temp_high ? parseInt(form.temp_high) : null,
        temp_low: form.temp_low ? parseInt(form.temp_low) : null,
        work_performed: form.work_performed.trim(),
      })
      if (insertErr) throw insertErr

      await supabase.from('activity_log').insert({
        project_id: activeProject.project.id,
        user_id: user.id,
        module: 'daily_report',
        record_label: `Report ${form.report_date}`,
        action: 'submitted',
      })

      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to create daily report')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title="New Daily Report"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Submit Report</Button>
        </>
      }
    >
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Report Date" required>
          <input type="date" style={inputStyle} value={form.report_date} onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))} />
        </FormField>
        <FormField label="Trade / Company">
          <input style={inputStyle} placeholder="e.g. Framing" value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} />
        </FormField>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
        <FormField label="Weather">
          <select style={selectStyle} value={form.weather_condition} onChange={e => setForm(f => ({ ...f, weather_condition: e.target.value }))}>
            <option value="clear">Clear</option>
            <option value="partly_cloudy">Partly Cloudy</option>
            <option value="overcast">Overcast</option>
            <option value="rain">Rain</option>
            <option value="wind">Wind</option>
            <option value="snow">Snow</option>
            <option value="fog">Fog</option>
          </select>
        </FormField>
        <FormField label="High °F">
          <input type="number" style={inputStyle} placeholder="72" value={form.temp_high} onChange={e => setForm(f => ({ ...f, temp_high: e.target.value }))} />
        </FormField>
        <FormField label="Low °F">
          <input type="number" style={inputStyle} placeholder="55" value={form.temp_low} onChange={e => setForm(f => ({ ...f, temp_low: e.target.value }))} />
        </FormField>
      </div>
      <FormField label="Work Performed Today" required>
        <textarea style={{ ...textareaStyle, minHeight: '120px' }} placeholder="Describe work completed today..." value={form.work_performed} onChange={e => setForm(f => ({ ...f, work_performed: e.target.value }))} />
      </FormField>
    </Modal>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile, activeProject, activeRole, can } = useAuth()
  const { counts, activity, overdueItems, loading, refresh } = useDashboard()

  const [showRFI,   setShowRFI]   = useState(false)
  const [showPunch, setShowPunch] = useState(false)
  const [showDaily, setShowDaily] = useState(false)

  if (!activeProject) {
    return (
      <EmptyState
        icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e8611a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>}
        title="No Project Assigned"
        description="Contact your GC Administrator to be added to a project."
      />
    )
  }

  const summaryCards = [
    {
      label: 'Open RFIs',
      value: counts.openRFIs,
      sub: counts.overdueRFIs > 0 ? `${counts.overdueRFIs} overdue` : null,
      subColor: '#dc2626',
      accent: '#e8611a',
    },
    {
      label: 'Pending Submittals',
      value: counts.pendingSubmittals,
      sub: null, subColor: '', accent: '#2d6fd4',
    },
    {
      label: 'Open Punch Items',
      value: counts.openPunch,
      sub: counts.overduePunch > 0 ? `${counts.overduePunch} overdue` : null,
      subColor: '#dc2626',
      accent: '#dc2626',
    },
    ...(activeRole && ['gc_admin', 'gc_field'].includes(activeRole) ? [{
      label: 'Open Tasks',
      value: counts.openTasks,
      sub: null, subColor: '', accent: '#8b5cf6',
    }] : []),
    {
      label: 'Reports This Week',
      value: counts.reportsThisWeek,
      sub: null, subColor: '', accent: '#2d9e5f',
    },
  ]

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .card-hover { transition: box-shadow 0.15s, transform 0.15s; }
        .card-hover:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .activity-row:hover { background: #fafafa; }
        .overdue-row:hover { background: #fef9f7; }
      `}</style>

      {/* Welcome + Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '34px', fontWeight: 800, color: '#0f1923', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.1, margin: 0 }}>
            {profile?.full_name?.split(' ')[0] ?? 'Welcome'}
          </h1>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
            {activeProject.project.name}
            {activeProject.project.project_number && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', marginLeft: '8px', color: '#9ca3af' }}>
                #{activeProject.project.project_number}
              </span>
            )}
          </div>
        </div>

        {/* Quick create buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {can('create_rfi') && (
            <Button size="sm" onClick={() => setShowRFI(true)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
            >
              New RFI
            </Button>
          )}
          {can('create_punch') && (
            <Button size="sm" variant="secondary" onClick={() => setShowPunch(true)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
            >
              New Punch
            </Button>
          )}
          {can('create_daily_report') && (
            <Button size="sm" variant="secondary" onClick={() => setShowDaily(true)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
            >
              Daily Report
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={refresh}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : summaryCards.map(card => (
            <div key={card.label} className="card-hover" style={{
              background: 'white', border: '1px solid #e5e7eb',
              borderRadius: '6px', padding: '20px',
              borderTop: `3px solid ${card.accent}`,
              cursor: 'default',
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>
                {card.label}
              </div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '44px', fontWeight: 800, color: card.value > 0 ? card.accent : '#d1d5db', lineHeight: 1 }}>
                {card.value}
              </div>
              {card.sub && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: card.subColor, marginTop: '6px' }}>
                  ⚠ {card.sub}
                </div>
              )}
            </div>
          ))
        }
      </div>

      {/* Two-column: Overdue + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '20px' }}>

        {/* Overdue Items */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px', fontWeight: 700, color: '#0f1923', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Overdue Items
              </div>
              {counts.totalOverdue > 0 && (
                <span style={{ background: '#fef2f2', color: '#dc2626', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', padding: '1px 7px', borderRadius: '10px' }}>
                  {counts.totalOverdue}
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '16px 20px' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <Skeleton width={50} height={11} />
                  <div style={{ flex: 1 }}><Skeleton height={11} /></div>
                </div>
              ))}
            </div>
          ) : overdueItems.length === 0 ? (
            <EmptyState
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d9e5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              title="All Clear"
              description="No overdue items. Great work."
            />
          ) : (
            <div>
              {overdueItems.map(item => (
                <div key={item.id} className="overdue-row" style={{ padding: '12px 20px', borderBottom: '1px solid #f9fafb', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                      color: MODULE_COLORS[item.type] ?? '#6b7280',
                      background: `${MODULE_COLORS[item.type] ?? '#6b7280'}15`,
                      padding: '2px 6px', borderRadius: '3px', flexShrink: 0,
                    }}>
                      {MODULE_LABELS[item.type] ?? item.type}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#374151', fontWeight: 500 }}>
                          {item.label}
                        </span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#dc2626' }}>
                          {item.days_overdue}d overdue
                        </span>
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.subject}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '3px' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>
                          Due {formatDate(item.due_date)}
                        </span>
                        {item.assigned_to && (
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>
                            → {item.assigned_to}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px', fontWeight: 700, color: '#0f1923', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Recent Activity
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '0 20px' }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ display: 'flex', gap: '12px', padding: '14px 0', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
                  <Skeleton width={40} height={11} />
                  <div style={{ flex: 1 }}><Skeleton height={11} width="70%" /></div>
                  <Skeleton width={40} height={11} />
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <EmptyState
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e8611a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              title="No Activity Yet"
              description="Activity will appear here as records are created and updated."
            />
          ) : (
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {activity.map(item => (
                <div key={item.id} className="activity-row" style={{ padding: '12px 20px', borderBottom: '1px solid #f9fafb', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  {/* Module dot */}
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    background: `${MODULE_COLORS[item.module] ?? '#6b7280'}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: '1px',
                  }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: MODULE_COLORS[item.module] ?? '#6b7280', fontWeight: 600, letterSpacing: '0.5px' }}>
                      {MODULE_LABELS[item.module]?.slice(0,3) ?? '—'}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151', lineHeight: 1.4 }}>
                      {item.user_name && (
                        <span style={{ fontWeight: 500 }}>{item.user_name} </span>
                      )}
                      <span style={{ color: '#6b7280' }}>{item.action}</span>
                      {item.record_label && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: MODULE_COLORS[item.module] ?? '#6b7280', marginLeft: '5px' }}>
                          {item.record_label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', marginTop: '3px' }}>
                      {timeAgo(item.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Create Modals */}
      <QuickCreateRFI   open={showRFI}   onClose={() => setShowRFI(false)}   onCreated={refresh} />
      <QuickCreatePunch open={showPunch} onClose={() => setShowPunch(false)} onCreated={refresh} />
      <QuickCreateDaily open={showDaily} onClose={() => setShowDaily(false)} onCreated={refresh} />
    </>
  )
}
