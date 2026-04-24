import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RFIStatus   = 'draft' | 'open' | 'answered' | 'closed' | 'void'
export type RFIPriority = 'low' | 'medium' | 'high' | 'critical'

export interface RFI {
  id: string
  project_id: string
  rfi_number: string
  subject: string
  question: string
  status: RFIStatus
  priority: RFIPriority
  ball_in_court_id: string | null
  ball_in_court_name: string | null
  due_date: string | null
  response: string | null
  response_date: string | null
  response_by: string | null
  response_by_name: string | null
  linked_drawing_id: string | null
  linked_sheet: string | null
  linked_spec: string | null
  dropbox_folder: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  is_overdue: boolean
}

export interface RFIFilters {
  status: RFIStatus | 'all'
  priority: RFIPriority | 'all'
  ball_in_court: string | 'all'
  search: string
  overdue_only: boolean
}

export interface CreateRFIPayload {
  subject: string
  question: string
  priority: RFIPriority
  ball_in_court_id: string | null
  due_date: string | null
  linked_sheet: string | null
  linked_spec: string | null
}

export interface RespondRFIPayload {
  response: string
  status: RFIStatus
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRFIs() {
  const { activeProject, user } = useAuth()
  const projectId = activeProject?.project.id

  const [rfis,    setRFIs]    = useState<RFI[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [filters, setFilters] = useState<RFIFilters>({
    status: 'all', priority: 'all',
    ball_in_court: 'all', search: '', overdue_only: false,
  })

  const [sortBy,  setSortBy]  = useState<'rfi_number' | 'due_date' | 'priority' | 'updated_at'>('rfi_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchRFIs = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('v_rfis')
        .select('*')
        .eq('project_id', projectId)
        .order(sortBy, { ascending: sortDir === 'asc' })

      if (err) throw err

      const today = new Date().toISOString().split('T')[0]
      const mapped: RFI[] = (data ?? []).map((r: any) => ({
        ...r,
        is_overdue: !!(
          r.due_date &&
          r.due_date < today &&
          ['open', 'draft'].includes(r.status)
        ),
      }))
      setRFIs(mapped)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load RFIs')
    } finally {
      setLoading(false)
    }
  }, [projectId, sortBy, sortDir])

  useEffect(() => { fetchRFIs() }, [fetchRFIs])

  // ── Client-side filter ───────────────────────────────────────────────────

  const filtered = rfis.filter(r => {
    if (filters.status !== 'all' && r.status !== filters.status) return false
    if (filters.priority !== 'all' && r.priority !== filters.priority) return false
    if (filters.ball_in_court !== 'all' && r.ball_in_court_id !== filters.ball_in_court) return false
    if (filters.overdue_only && !r.is_overdue) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !r.rfi_number.toLowerCase().includes(q) &&
        !r.subject.toLowerCase().includes(q) &&
        !(r.linked_spec ?? '').toLowerCase().includes(q) &&
        !(r.linked_sheet ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // ── Create ───────────────────────────────────────────────────────────────

  const createRFI = useCallback(async (payload: CreateRFIPayload): Promise<{ error: string | null; id?: string }> => {
    if (!projectId || !user) return { error: 'No active project' }
    setSaving(true)
    try {
      const { data: num, error: cErr } = await supabase.rpc('next_project_counter', {
        p_project_id: projectId, p_counter_name: 'rfi',
      })
      if (cErr) throw cErr
      const rfiNumber = `RFI-${String(num).padStart(3, '0')}`

      const { data, error: insertErr } = await supabase.from('rfis').insert({
        project_id: projectId,
        rfi_number: rfiNumber,
        subject: payload.subject.trim(),
        question: payload.question.trim(),
        priority: payload.priority,
        ball_in_court_id: payload.ball_in_court_id || null,
        due_date: payload.due_date || null,
        linked_sheet: payload.linked_sheet || null,
        linked_spec: payload.linked_spec || null,
        status: 'open',
        created_by: user.id,
      }).select('id').single()

      if (insertErr) throw insertErr

      await supabase.from('activity_log').insert({
        project_id: projectId, user_id: user.id,
        module: 'rfi', record_label: rfiNumber, action: 'created',
      })

      await fetchRFIs()
      return { error: null, id: data?.id }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to create RFI' }
    } finally {
      setSaving(false)
    }
  }, [projectId, user, fetchRFIs])

  // ── Update status / respond ──────────────────────────────────────────────

  const respondRFI = useCallback(async (
    id: string, rfiNumber: string, payload: RespondRFIPayload
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }
    setSaving(true)
    try {
      const updates: any = { status: payload.status }
      if (payload.response) {
        updates.response      = payload.response.trim()
        updates.response_date = new Date().toISOString()
        updates.response_by   = user.id
      }

      const { error: updateErr } = await supabase.from('rfis').update(updates).eq('id', id)
      if (updateErr) throw updateErr

      await supabase.from('activity_log').insert({
        project_id: activeProject?.project.id, user_id: user.id,
        module: 'rfi', record_label: rfiNumber,
        action: `status changed to ${payload.status}`,
      })

      await fetchRFIs()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to update RFI' }
    } finally {
      setSaving(false)
    }
  }, [user, activeProject, fetchRFIs])

  // ── Update ball-in-court ─────────────────────────────────────────────────

  const updateBIC = useCallback(async (
    id: string, bicId: string | null
  ): Promise<{ error: string | null }> => {
    setSaving(true)
    try {
      const { error: updateErr } = await supabase
        .from('rfis').update({ ball_in_court_id: bicId }).eq('id', id)
      if (updateErr) throw updateErr
      await fetchRFIs()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to update' }
    } finally {
      setSaving(false)
    }
  }, [fetchRFIs])

  // ── Void / delete ────────────────────────────────────────────────────────

  const voidRFI = useCallback(async (
    id: string, rfiNumber: string
  ): Promise<{ error: string | null }> => {
    setSaving(true)
    try {
      const { error: updateErr } = await supabase
        .from('rfis').update({ status: 'void' }).eq('id', id)
      if (updateErr) throw updateErr

      await supabase.from('activity_log').insert({
        project_id: activeProject?.project.id, user_id: user?.id,
        module: 'rfi', record_label: rfiNumber, action: 'voided',
      })

      await fetchRFIs()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to void RFI' }
    } finally {
      setSaving(false)
    }
  }, [activeProject, user, fetchRFIs])

  // ── Sort toggle ──────────────────────────────────────────────────────────

  const toggleSort = useCallback((col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }, [sortBy])

  return {
    rfis: filtered, allRFIs: rfis, loading, saving, error,
    filters, setFilters, sortBy, sortDir, toggleSort,
    fetchRFIs, createRFI, respondRFI, updateBIC, voidRFI,
  }
}
