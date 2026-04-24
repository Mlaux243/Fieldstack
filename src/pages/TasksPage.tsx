import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  useTasks, type Task, type TaskStatus, type TaskPriority,
  TASK_STATUS_META, TASK_PRIORITY_META,
} from '../hooks/useTasks'
import {
  PageHeader, Button, Modal, FormField, StatusBadge, PriorityDot,
  EmptyState, Skeleton, SkeletonRow, inputStyle, selectStyle, textareaStyle,
} from '../components/ui'
import { supabase } from '../lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function daysOverdue(due: string) {
  return Math.max(1, Math.floor(
    (Date.now() - new Date(due + 'T12:00:00').getTime()) / 86400000
  ))
}

function daysUntil(due: string) {
  const d = Math.ceil(
    (new Date(due + 'T12:00:00').getTime() - Date.now()) / 86400000
  )
  if (d < 0)  return `${Math.abs(d)}d overdue`
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  return `Due in ${d}d`
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const m = TASK_PRIORITY_META[priority]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '3px',
      background: m.bg, color: m.color,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      <PriorityDot priority={priority} />
      {m.label}
    </span>
  )
}

// ─── Status Cycle Button ──────────────────────────────────────────────────────

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress', in_progress: 'complete', complete: 'todo',
}

function StatusCycleBtn({ task, onUpdate, saving }: {
  task: Task; onUpdate: (status: TaskStatus) => void; saving: boolean
}) {
  const meta = TASK_STATUS_META[task.status]
  const next = STATUS_CYCLE[task.status]
  const nextMeta = TASK_STATUS_META[next]

  return (
    <button
      onClick={e => { e.stopPropagation(); onUpdate(next) }}
      disabled={saving}
      title={`Mark as ${nextMeta.label}`}
      style={{
        padding: '4px 10px', border: `1.5px solid ${meta.color}40`,
        borderRadius: '4px', background: meta.bg, color: meta.color,
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
        fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
        letterSpacing: '0.5px', whiteSpace: 'nowrap',
        opacity: saving ? 0.6 : 1,
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.background = nextMeta.bg
        ;(e.currentTarget as HTMLElement).style.color = nextMeta.color
        ;(e.currentTarget as HTMLElement).style.borderColor = `${nextMeta.color}40`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.background = meta.bg
        ;(e.currentTarget as HTMLElement).style.color = meta.color
        ;(e.currentTarget as HTMLElement).style.borderColor = `${meta.color}40`
      }}
    >
      {task.status === 'complete' ? '↺ Reopen' : task.status === 'todo' ? '▶ Start' : '✓ Complete'}
    </button>
  )
}

// ─── Create / Edit Task Modal ─────────────────────────────────────────────────

function TaskModal({ task, open, onClose, onSaved }: {
  task: Task | null; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const { activeProject } = useAuth()
  const { createTask, updateTask, saving } = useTasks()

  const isEdit = !!task

  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([])
  const [form, setForm] = useState({
    title: '', description: '', assigned_to: '',
    priority: 'medium' as TaskPriority, due_date: '',
    linked_module: '', linked_record_id: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Populate form when editing
  useEffect(() => {
    if (task) {
      setForm({
        title:            task.title,
        description:      task.description ?? '',
        assigned_to:      task.assigned_to ?? '',
        priority:         task.priority,
        due_date:         task.due_date ?? '',
        linked_module:    task.linked_module ?? '',
        linked_record_id: task.linked_record_id ?? '',
      })
    } else {
      setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '', linked_module: '', linked_record_id: '' })
    }
    setErrors({})
  }, [task, open])

  // Load project members
  useEffect(() => {
    if (!open || !activeProject) return
    supabase
      .from('project_users')
      .select('user_id, profile:user_profiles(full_name)')
      .eq('project_id', activeProject.project.id)
      .in('role', ['gc_admin', 'gc_field', 'architect'])
      .then(({ data }) => {
        setMembers((data ?? []).map((m: any) => ({
          id: m.user_id, full_name: m.profile?.full_name ?? 'Unknown',
        })))
      })
  }, [open, activeProject])

  function validate() {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Title is required'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    const payload = {
      title:            form.title,
      description:      form.description,
      assigned_to:      form.assigned_to      || null,
      priority:         form.priority,
      due_date:         form.due_date          || null,
      linked_module:    form.linked_module     || null,
      linked_record_id: form.linked_record_id  || null,
    }
    const { error } = isEdit && task
      ? await updateTask(task.id, payload)
      : await createTask(payload)
    if (error) { setErrors({ _: error }); return }
    onSaved(); onClose()
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title={isEdit ? `Edit ${task?.task_number}` : 'New Task'}
      subtitle={isEdit ? task?.title : undefined}
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save Changes' : 'Create Task →'}
          </Button>
        </>
      }
    >
      {errors._ && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {errors._}
        </div>
      )}

      <FormField label="Title" required error={errors.title}>
        <input
          style={{ ...inputStyle, borderColor: errors.title ? '#fca5a5' : '#e5e7eb' }}
          placeholder="What needs to get done?"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          autoFocus
        />
      </FormField>

      <FormField label="Description">
        <textarea
          style={{ ...textareaStyle, minHeight: '80px' }}
          placeholder="Additional details, context, or acceptance criteria…"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Priority">
          <select style={selectStyle} value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}>
            {Object.entries(TASK_PRIORITY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Due Date">
          <input type="date" style={inputStyle} value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        </FormField>
      </div>

      <FormField label="Assign To">
        <select style={selectStyle} value={form.assigned_to}
          onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
          <option value="">Unassigned</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      </FormField>

      {/* Optional link to a module record */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FormField label="Linked Module" hint="Optional">
          <select style={selectStyle} value={form.linked_module}
            onChange={e => setForm(f => ({ ...f, linked_module: e.target.value, linked_record_id: '' }))}>
            <option value="">None</option>
            <option value="rfi">RFI</option>
            <option value="submittal">Submittal</option>
            <option value="punch_item">Punch Item</option>
            <option value="drawing">Drawing</option>
          </select>
        </FormField>
        <FormField label="Record ID / Label" hint="e.g. RFI-003">
          <input style={inputStyle} placeholder="RFI-003, SUB-007…"
            value={form.linked_record_id}
            onChange={e => setForm(f => ({ ...f, linked_record_id: e.target.value }))}
            disabled={!form.linked_module} />
        </FormField>
      </div>
    </Modal>
  )
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────

function TaskDetailModal({ task, open, onClose, onEdit, onDelete, onStatusChange }: {
  task: Task | null; open: boolean; onClose: () => void
  onEdit: () => void; onDelete: (id: string) => void
  onStatusChange: (status: TaskStatus) => void
}) {
  if (!task) return null
  const { can } = useAuth()
  const canManage = can('create_task')
  const statusMeta   = TASK_STATUS_META[task.status]
  const priorityMeta = TASK_PRIORITY_META[task.priority]

  return (
    <Modal open={open} onClose={onClose}
      title={task.task_number}
      subtitle={task.title}
      width={540}
      footer={
        <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
          {canManage && (
            <Button variant="danger" size="sm"
              onClick={() => { onDelete(task.id); onClose() }}
              style={{ marginRight: 'auto' }}>
              Delete
            </Button>
          )}
          {canManage && (
            <Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button>
          )}
          <StatusCycleBtn task={task} onUpdate={onStatusChange} saving={false} />
        </div>
      }
    >
      {/* Status + priority strip */}
      <div style={{
        display: 'flex', gap: '12px', padding: '12px 14px',
        background: statusMeta.bg, border: `1px solid ${statusMeta.border}`,
        borderRadius: '4px', marginBottom: '20px', flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
          fontWeight: 600, color: statusMeta.color,
          padding: '2px 8px', background: 'white', borderRadius: '3px',
          border: `1px solid ${statusMeta.color}30`,
        }}>
          {statusMeta.label}
        </span>
        <PriorityBadge priority={task.priority} />
        {task.is_overdue && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>
            ⚠ {daysOverdue(task.due_date!)}d overdue
          </span>
        )}
        {task.status === 'complete' && task.completed_at && (
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#2d9e5f' }}>
            ✓ Completed {fmtDate(task.completed_at.split('T')[0])} by {task.completed_by_name ?? '—'}
          </span>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Description</div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#374151', lineHeight: 1.7, padding: '12px 14px', background: '#f9fafb', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
            {task.description}
          </div>
        </div>
      )}

      {/* Metadata grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {[
          ['Assigned To',  task.assigned_to_name ?? 'Unassigned'],
          ['Due Date',     task.due_date ? `${fmtDate(task.due_date)} (${daysUntil(task.due_date)})` : '—'],
          ['Created By',   task.created_by_name ?? '—'],
          ['Created',      fmtDate(task.created_at.split('T')[0])],
        ].map(([label, val]) => (
          <div key={label as string}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Linked module */}
      {task.linked_module && (
        <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Linked To</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#2d9e5f', background: '#f0fdf4', padding: '2px 8px', borderRadius: '3px', textTransform: 'uppercase' }}>
              {task.linked_module.replace('_', ' ')}
            </span>
            {task.linked_record_id && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#374151', fontWeight: 600 }}>
                {task.linked_record_id}
              </span>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({ status, tasks, onTaskClick, onStatusChange, saving }: {
  status: TaskStatus; tasks: Task[]
  onTaskClick: (t: Task) => void
  onStatusChange: (id: string, number: string, status: TaskStatus) => void
  saving: boolean
}) {
  const meta = TASK_STATUS_META[status]
  return (
    <div>
      {/* Column header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
        padding: '8px 12px', background: meta.bg,
        border: `1px solid ${meta.border}`, borderRadius: '4px',
      }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>
          {meta.label}
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: meta.color, background: 'white', padding: '1px 7px', borderRadius: '10px' }}>
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#d1d5db', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', border: '1px dashed #e5e7eb', borderRadius: '4px' }}>
            No tasks
          </div>
        ) : tasks.map(task => (
          <div
            key={task.id}
            onClick={() => onTaskClick(task)}
            style={{
              padding: '12px', background: 'white',
              border: `1px solid ${task.is_overdue ? '#fca5a5' : '#e5e7eb'}`,
              borderLeft: `3px solid ${task.is_overdue ? '#dc2626' : TASK_PRIORITY_META[task.priority].color}`,
              borderRadius: '4px', cursor: 'pointer',
              transition: 'box-shadow 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none' }}
          >
            {/* Task number + priority */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 600, color: '#e8611a' }}>
                {task.task_number}
              </span>
              <PriorityBadge priority={task.priority} />
              {task.is_overdue && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#dc2626', marginLeft: 'auto' }}>⚠ OVERDUE</span>}
            </div>

            {/* Title */}
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#0f1923', fontWeight: 500, lineHeight: 1.4, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {task.title}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {task.assigned_to_name && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6b7280' }}>
                  → {task.assigned_to_name.split(' ')[0]}
                </span>
              )}
              {task.due_date && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: task.is_overdue ? '#dc2626' : '#9ca3af', marginLeft: 'auto' }}>
                  {daysUntil(task.due_date)}
                </span>
              )}
            </div>

            {/* Status cycle button */}
            <div style={{ marginTop: '8px' }} onClick={e => e.stopPropagation()}>
              <StatusCycleBtn
                task={task}
                onUpdate={s => onStatusChange(task.id, task.task_number, s)}
                saving={saving}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tasks Page ───────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { activeProject, user, can } = useAuth()
  const {
    tasks, allTasks, allAssigned, counts, loading, saving, error,
    filters, setFilters, sortBy, sortDir, toggleSort,
    fetchTasks, updateStatus, deleteTask,
  } = useTasks()

  const [view,       setView]       = useState<'list' | 'board'>('list')
  const [showCreate, setShowCreate] = useState(false)
  const [editTask,   setEditTask]   = useState<Task | null>(null)
  const [viewTask,   setViewTask]   = useState<Task | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const canCreate = can('create_task')

  // Status order for board
  const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'complete']

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
    return <EmptyState title="No Project Selected" description="Select a project to view tasks." />
  }

  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .task-row{cursor:pointer;transition:background 0.1s}
        .task-row:hover{background:#fafafa}
        .task-row.overdue td:first-child{border-left:3px solid #dc2626}
        input:focus,select:focus,textarea:focus{border-color:#e8611a!important;outline:none}
      `}</style>

      <PageHeader
        title="Tasks"
        subtitle={`${allTasks.length} total · ${counts.mine} assigned to me · ${counts.overdue > 0 ? `${counts.overdue} overdue` : 'none overdue'}`}
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
                New Task
              </Button>
            )}
          </div>
        }
      />

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'My Tasks',    val: counts.mine,        color: '#e8611a', filter: () => setFilters(f => ({ ...f, assigned_to: f.assigned_to === 'mine' ? 'all' : 'mine' })) },
          { label: 'To Do',       val: counts.todo,        color: '#6b7280', filter: () => setFilters(f => ({ ...f, status: f.status === 'todo'        ? 'all' : 'todo' })) },
          { label: 'In Progress', val: counts.in_progress, color: '#2d6fd4', filter: () => setFilters(f => ({ ...f, status: f.status === 'in_progress'  ? 'all' : 'in_progress' })) },
          { label: 'Complete',    val: counts.complete,    color: '#2d9e5f', filter: () => setFilters(f => ({ ...f, status: f.status === 'complete'      ? 'all' : 'complete' })) },
          ...(counts.overdue > 0 ? [{ label: 'Overdue', val: counts.overdue, color: '#dc2626', filter: () => setFilters(f => ({ ...f, overdue_only: !f.overdue_only })) }] : []),
        ].map(s => (
          <div key={s.label} onClick={s.filter} style={{ padding: '10px 16px', borderRadius: '4px', cursor: 'pointer', background: 'white', border: '1.5px solid #e5e7eb', transition: 'border-color 0.15s' }}
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
        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '260px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input style={{ ...inputStyle, paddingLeft: '32px' }} placeholder="Search tasks…"
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>

        <select style={{ ...selectStyle, width: '150px' }} value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value as any }))}>
          <option value="all">All Statuses</option>
          {Object.entries(TASK_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select style={{ ...selectStyle, width: '140px' }} value={filters.priority}
          onChange={e => setFilters(f => ({ ...f, priority: e.target.value as any }))}>
          <option value="all">All Priorities</option>
          {Object.entries(TASK_PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select style={{ ...selectStyle, width: '150px' }} value={filters.assigned_to}
          onChange={e => setFilters(f => ({ ...f, assigned_to: e.target.value }))}>
          <option value="all">All Assigned</option>
          <option value="mine">Assigned to Me</option>
          {allAssigned.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: filters.overdue_only ? '#dc2626' : '#6b7280', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={filters.overdue_only} onChange={e => setFilters(f => ({ ...f, overdue_only: e.target.checked }))} />
          Overdue only
        </label>

        {(filters.status !== 'all' || filters.priority !== 'all' || filters.search || filters.overdue_only || filters.assigned_to === 'mine') && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ status: 'all', priority: 'all', assigned_to: 'all', search: '', overdue_only: false })}>
            Clear
          </Button>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '0 20px' }}>{[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}</div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
              title={allTasks.length === 0 ? 'No Tasks Yet' : 'No Results'}
              description={allTasks.length === 0 ? 'Create the first task for this project.' : 'Try adjusting your filters.'}
              action={allTasks.length === 0 && canCreate ? <Button onClick={() => setShowCreate(true)}>Create First Task</Button> : undefined}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <SortTh label="Task #"    col="task_number" style={{ width: '90px' }} />
                    <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>Title</th>
                    <SortTh label="Priority"  col="priority"    style={{ width: '110px' }} />
                    <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb', width: '120px' }}>Status</th>
                    <th style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>Assigned To</th>
                    <SortTh label="Due Date"  col="due_date"    style={{ width: '120px' }} />
                    <SortTh label="Updated"   col="updated_at"  style={{ width: '90px' }} />
                    <th style={{ padding: '10px 14px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', width: '100px' }} />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.id} className={`task-row ${task.is_overdue ? 'overdue' : ''}`}
                      onClick={() => { setViewTask(task); setShowDetail(true) }}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#8b5cf6' }}>
                          {task.task_number}
                        </span>
                        {task.is_mine && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#e8611a', marginTop: '2px' }}>Mine</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', maxWidth: '280px' }}>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#0f1923', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.title}
                        </div>
                        {task.linked_module && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#2d9e5f', marginTop: '2px' }}>
                            ↗ {task.linked_module.replace('_', ' ')} {task.linked_record_id}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <StatusBadge status={task.status} size="sm" />
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151' }}>
                          {task.assigned_to_name ?? '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                        {task.due_date ? (
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: task.is_overdue ? '#dc2626' : '#374151', fontWeight: task.is_overdue ? 600 : 400 }}>
                            {task.is_overdue ? `⚠ ${daysOverdue(task.due_date)}d late` : fmtDate(task.due_date)}
                          </span>
                        ) : (
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#d1d5db' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
                          {timeAgo(task.updated_at)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }} onClick={e => e.stopPropagation()}>
                        <StatusCycleBtn
                          task={task}
                          onUpdate={s => updateStatus(task.id, task.task_number, s)}
                          saving={saving}
                        />
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
        loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[1,2,3].map(i => <Skeleton key={i} height={200} borderRadius="6px" />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {STATUS_ORDER.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasks.filter(t => t.status === status)}
                onTaskClick={t => { setViewTask(t); setShowDetail(true) }}
                onStatusChange={(id, num, s) => updateStatus(id, num, s)}
                saving={saving}
              />
            ))}
          </div>
        )
      )}

      {/* Modals */}
      <TaskModal
        task={null}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={fetchTasks}
      />
      <TaskModal
        task={editTask}
        open={!!editTask}
        onClose={() => setEditTask(null)}
        onSaved={fetchTasks}
      />
      <TaskDetailModal
        task={viewTask}
        open={showDetail}
        onClose={() => { setShowDetail(false); setViewTask(null) }}
        onEdit={() => { setShowDetail(false); setEditTask(viewTask) }}
        onDelete={async id => { await deleteTask(id); setShowDetail(false); setViewTask(null) }}
        onStatusChange={async s => {
          if (viewTask) {
            await updateStatus(viewTask.id, viewTask.task_number, s)
            setViewTask(prev => prev ? { ...prev, status: s } : null)
          }
        }}
      />
    </>
  )
}
