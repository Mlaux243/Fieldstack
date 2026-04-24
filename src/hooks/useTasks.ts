import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus   = 'todo' | 'in_progress' | 'complete'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Task {
  id: string
  project_id: string
  task_number: string
  title: string
  description: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  linked_module: string | null
  linked_record_id: string | null
  completed_by: string | null
  completed_by_name: string | null
  completed_at: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  is_overdue: boolean
  is_mine: boolean
}

export interface CreateTaskPayload {
  title: string
  description: string
  assigned_to: string | null
  priority: TaskPriority
  due_date: string | null
  linked_module: string | null
  linked_record_id: string | null
}

export interface TaskFilters {
  status: TaskStatus | 'all'
  priority: TaskPriority | 'all'
  assigned_to: string | 'all' | 'mine'
  search: string
  overdue_only: boolean
}

// ─── Status meta ──────────────────────────────────────────────────────────────

export const TASK_STATUS_META: Record<TaskStatus, {
  label: string; color: string; bg: string; border: string
}> = {
  todo:        { label: 'To Do',       color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
  in_progress: { label: 'In Progress', color: '#2d6fd4', bg: '#eff6ff', border: '#bfdbfe' },
  complete:    { label: 'Complete',    color: '#2d9e5f', bg: '#f0fdf4', border: '#bbf7d0' },
}

export const TASK_PRIORITY_META: Record<TaskPriority, {
  label: string; color: string; bg: string
}> = {
  low:      { label: 'Low',      color: '#2d9e5f', bg: '#f0fdf4' },
  medium:   { label: 'Medium',   color: '#2d6fd4', bg: '#eff6ff' },
  high:     { label: 'High',     color: '#e8a020', bg: '#fff7ed' },
  critical: { label: 'Critical', color: '#dc2626', bg: '#fef2f2' },
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTasks() {
  const { activeProject, user, activeRole } = useAuth()
  const projectId = activeProject?.project.id

  const [tasks,   setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all', priority: 'all',
    assigned_to: 'mine', search: '', overdue_only: false,
  })
  const [sortBy,  setSortBy]  = useState<'task_number' | 'due_date' | 'priority' | 'updated_at'>('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned:user_profiles!assigned_to(full_name),
          completed:user_profiles!completed_by(full_name),
          creator:user_profiles!created_by(full_name)
        `)
        .eq('project_id', projectId)
        .order(sortBy, { ascending: sortDir === 'asc' })

      if (err) throw err

      const today = new Date().toISOString().split('T')[0]
      const mapped: Task[] = (data ?? []).map((t: any) => ({
        ...t,
        assigned_to_name:  t.assigned?.full_name  ?? null,
        completed_by_name: t.completed?.full_name ?? null,
        created_by_name:   t.creator?.full_name   ?? null,
        is_overdue: !!(
          t.due_date &&
          t.due_date < today &&
          t.status !== 'complete'
        ),
        is_mine: t.assigned_to === user?.id,
      }))

      setTasks(mapped)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [projectId, sortBy, sortDir, user])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // ── Derived ──────────────────────────────────────────────────────────────

  const allAssigned = [...new Set(
    tasks.filter(t => t.assigned_to)
      .map(t => ({ id: t.assigned_to!, name: t.assigned_to_name ?? 'Unknown' }))
  )].filter((v, i, a) => a.findIndex(x => x.id === v.id) === i)

  const filtered = tasks.filter(t => {
    if (filters.status !== 'all' && t.status !== filters.status)       return false
    if (filters.priority !== 'all' && t.priority !== filters.priority) return false
    if (filters.overdue_only && !t.is_overdue)                         return false
    if (filters.assigned_to === 'mine' && t.assigned_to !== user?.id)  return false
    if (filters.assigned_to !== 'all' && filters.assigned_to !== 'mine' && t.assigned_to !== filters.assigned_to) return false
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      if (
        !t.title.toLowerCase().includes(q) &&
        !(t.description ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const counts = {
    todo:        tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    complete:    tasks.filter(t => t.status === 'complete').length,
    overdue:     tasks.filter(t => t.is_overdue).length,
    mine:        tasks.filter(t => t.is_mine && t.status !== 'complete').length,
  }

  // ── Create ───────────────────────────────────────────────────────────────

  const createTask = useCallback(async (
    payload: CreateTaskPayload
  ): Promise<{ error: string | null }> => {
    if (!projectId || !user) return { error: 'No active project' }
    setSaving(true)
    try {
      const { data: num, error: cErr } = await supabase.rpc('next_project_counter', {
        p_project_id: projectId, p_counter_name: 'task',
      })
      if (cErr) throw cErr
      const taskNumber = `TSK-${String(num).padStart(3, '0')}`

      const { error: insertErr } = await supabase.from('tasks').insert({
        project_id:       projectId,
        task_number:      taskNumber,
        title:            payload.title.trim(),
        description:      payload.description.trim() || null,
        assigned_to:      payload.assigned_to       || null,
        priority:         payload.priority,
        due_date:         payload.due_date           || null,
        linked_module:    payload.linked_module      || null,
        linked_record_id: payload.linked_record_id   || null,
        status:           'todo',
        created_by:       user.id,
      })
      if (insertErr) throw insertErr

      // Notify assigned user
      if (payload.assigned_to && payload.assigned_to !== user.id) {
        await supabase.from('notifications').insert({
          user_id:      payload.assigned_to,
          project_id:   projectId,
          title:        'Task Assigned to You',
          body:         `${taskNumber}: ${payload.title}`,
          module:       'task',
          record_label: taskNumber,
          channel:      'email',
          is_read:      false,
          sent_at:      new Date().toISOString(),
        })
      }

      await supabase.from('activity_log').insert({
        project_id: projectId, user_id: user.id,
        module: 'task', record_label: taskNumber, action: 'created',
      })

      await fetchTasks()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to create task' }
    } finally {
      setSaving(false)
    }
  }, [projectId, user, fetchTasks])

  // ── Update status ────────────────────────────────────────────────────────

  const updateStatus = useCallback(async (
    id: string, taskNumber: string, status: TaskStatus
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }
    setSaving(true)
    try {
      const updates: any = { status }
      if (status === 'complete') {
        updates.completed_by = user.id
        updates.completed_at = new Date().toISOString()
      } else {
        updates.completed_by = null
        updates.completed_at = null
      }
      const { error: updateErr } = await supabase
        .from('tasks').update(updates).eq('id', id)
      if (updateErr) throw updateErr

      await supabase.from('activity_log').insert({
        project_id: activeProject?.project.id, user_id: user.id,
        module: 'task', record_label: taskNumber,
        action: `status changed to ${status}`,
      })

      await fetchTasks()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to update task' }
    } finally {
      setSaving(false)
    }
  }, [user, activeProject, fetchTasks])

  // ── Update full task ─────────────────────────────────────────────────────

  const updateTask = useCallback(async (
    id: string,
    patch: Partial<CreateTaskPayload>
  ): Promise<{ error: string | null }> => {
    setSaving(true)
    try {
      const { error: updateErr } = await supabase
        .from('tasks').update({
          ...patch,
          assigned_to:      patch.assigned_to      || null,
          due_date:         patch.due_date          || null,
          linked_module:    patch.linked_module     || null,
          linked_record_id: patch.linked_record_id  || null,
        }).eq('id', id)
      if (updateErr) throw updateErr
      await fetchTasks()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to update task' }
    } finally {
      setSaving(false)
    }
  }, [fetchTasks])

  // ── Delete ───────────────────────────────────────────────────────────────

  const deleteTask = useCallback(async (
    id: string
  ): Promise<{ error: string | null }> => {
    setSaving(true)
    try {
      const { error: deleteErr } = await supabase
        .from('tasks').delete().eq('id', id)
      if (deleteErr) throw deleteErr
      await fetchTasks()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to delete task' }
    } finally {
      setSaving(false)
    }
  }, [fetchTasks])

  // ── Sort toggle ──────────────────────────────────────────────────────────

  const toggleSort = useCallback((col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }, [sortBy])

  return {
    tasks: filtered, allTasks: tasks, allAssigned, counts,
    loading, saving, error,
    filters, setFilters, sortBy, sortDir, toggleSort,
    fetchTasks, createTask, updateStatus, updateTask, deleteTask,
  }
}
