import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubmittalStatus =
  | 'draft' | 'submitted' | 'under_review'
  | 'approved' | 'approved_as_noted'
  | 'revise_and_resubmit' | 'rejected'

export interface Submittal {
  id: string
  project_id: string
  submittal_number: string
  spec_section: string
  spec_title: string | null
  description: string
  subcontractor_id: string | null
  subcontractor_name: string | null
  reviewer_id: string | null
  reviewer_name: string | null
  status: SubmittalStatus
  submitted_date: string | null
  required_return_date: string | null
  returned_date: string | null
  current_revision: number
  dropbox_folder: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  is_overdue: boolean
}

export interface SubmittalRevision {
  id: string
  submittal_id: string
  revision_number: number
  status: SubmittalStatus
  notes: string | null
  dropbox_path: string | null
  submitted_by_name: string | null
  returned_by_name: string | null
  submitted_at: string | null
  returned_at: string | null
  created_at: string
}

export interface CreateSubmittalPayload {
  spec_section: string
  spec_title: string
  description: string
  subcontractor_id: string | null
  reviewer_id: string | null
  submitted_date: string | null
  required_return_date: string | null
}

export interface ReviewSubmittalPayload {
  status: SubmittalStatus
  notes: string
  dropbox_path: string
}

export interface SubmittalFilters {
  status: SubmittalStatus | 'all'
  search: string
  overdue_only: boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSubmittals() {
  const { activeProject, user } = useAuth()
  const projectId = activeProject?.project.id

  const [submittals, setSubmittals] = useState<Submittal[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const [filters, setFilters] = useState<SubmittalFilters>({
    status: 'all', search: '', overdue_only: false,
  })
  const [sortBy,  setSortBy]  = useState<'submittal_number' | 'required_return_date' | 'updated_at'>('submittal_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchSubmittals = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('v_submittals')
        .select('*')
        .eq('project_id', projectId)
        .order(sortBy, { ascending: sortDir === 'asc' })

      if (err) throw err

      const today = new Date().toISOString().split('T')[0]
      const mapped: Submittal[] = (data ?? []).map((s: any) => ({
        ...s,
        is_overdue: !!(
          s.required_return_date &&
          s.required_return_date < today &&
          ['submitted', 'under_review'].includes(s.status)
        ),
      }))
      setSubmittals(mapped)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load submittals')
    } finally {
      setLoading(false)
    }
  }, [projectId, sortBy, sortDir])

  useEffect(() => { fetchSubmittals() }, [fetchSubmittals])

  // ── Client filter ────────────────────────────────────────────────────────

  const filtered = submittals.filter(s => {
    if (filters.status !== 'all' && s.status !== filters.status) return false
    if (filters.overdue_only && !s.is_overdue) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !s.submittal_number.toLowerCase().includes(q) &&
        !s.description.toLowerCase().includes(q) &&
        !s.spec_section.toLowerCase().includes(q) &&
        !(s.spec_title ?? '').toLowerCase().includes(q) &&
        !(s.subcontractor_name ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // ── Create ───────────────────────────────────────────────────────────────

  const createSubmittal = useCallback(async (
    payload: CreateSubmittalPayload
  ): Promise<{ error: string | null; id?: string }> => {
    if (!projectId || !user) return { error: 'No active project' }
    setSaving(true)
    try {
      const { data: num, error: cErr } = await supabase.rpc('next_project_counter', {
        p_project_id: projectId, p_counter_name: 'submittal',
      })
      if (cErr) throw cErr
      const submittalNumber = `SUB-${String(num).padStart(3, '0')}`

      const { data, error: insertErr } = await supabase.from('submittals').insert({
        project_id:           projectId,
        submittal_number:     submittalNumber,
        spec_section:         payload.spec_section.trim(),
        spec_title:           payload.spec_title.trim() || null,
        description:          payload.description.trim(),
        subcontractor_id:     payload.subcontractor_id || null,
        reviewer_id:          payload.reviewer_id || null,
        status:               payload.submitted_date ? 'submitted' : 'draft',
        submitted_date:       payload.submitted_date || null,
        required_return_date: payload.required_return_date || null,
        current_revision:     0,
        created_by:           user.id,
      }).select('id').single()

      if (insertErr) throw insertErr

      // Create revision 0
      await supabase.from('submittal_revisions').insert({
        submittal_id:     data.id,
        revision_number:  0,
        status:           payload.submitted_date ? 'submitted' : 'draft',
        submitted_by:     user.id,
        submitted_at:     payload.submitted_date ? new Date().toISOString() : null,
      })

      await supabase.from('activity_log').insert({
        project_id: projectId, user_id: user.id,
        module: 'submittal', record_label: submittalNumber, action: 'created',
      })

      await fetchSubmittals()
      return { error: null, id: data.id }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to create submittal' }
    } finally {
      setSaving(false)
    }
  }, [projectId, user, fetchSubmittals])

  // ── Review / return submittal ────────────────────────────────────────────

  const reviewSubmittal = useCallback(async (
    id: string,
    submittalNumber: string,
    currentRevision: number,
    payload: ReviewSubmittalPayload
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }
    setSaving(true)
    try {
      const returnedDate = new Date().toISOString()

      // Update parent submittal
      const { error: updateErr } = await supabase.from('submittals').update({
        status:        payload.status,
        returned_date: returnedDate.split('T')[0],
        reviewer_id:   user.id,
      }).eq('id', id)
      if (updateErr) throw updateErr

      // Update current revision
      await supabase.from('submittal_revisions').update({
        status:       payload.status,
        notes:        payload.notes || null,
        dropbox_path: payload.dropbox_path || null,
        returned_by:  user.id,
        returned_at:  returnedDate,
      }).eq('submittal_id', id).eq('revision_number', currentRevision)

      await supabase.from('activity_log').insert({
        project_id: activeProject?.project.id, user_id: user.id,
        module: 'submittal', record_label: submittalNumber,
        action: `returned as ${payload.status.replace(/_/g, ' ')}`,
      })

      await fetchSubmittals()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to update submittal' }
    } finally {
      setSaving(false)
    }
  }, [user, activeProject, fetchSubmittals])

  // ── Resubmit (creates new revision) ─────────────────────────────────────

  const resubmit = useCallback(async (
    id: string,
    submittalNumber: string,
    currentRevision: number,
    notes: string
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }
    setSaving(true)
    try {
      const nextRev = currentRevision + 1

      const { error: updateErr } = await supabase.from('submittals').update({
        status:           'submitted',
        current_revision: nextRev,
        submitted_date:   new Date().toISOString().split('T')[0],
        returned_date:    null,
      }).eq('id', id)
      if (updateErr) throw updateErr

      await supabase.from('submittal_revisions').insert({
        submittal_id:    id,
        revision_number: nextRev,
        status:          'submitted',
        notes:           notes || null,
        submitted_by:    user.id,
        submitted_at:    new Date().toISOString(),
      })

      await supabase.from('activity_log').insert({
        project_id: activeProject?.project.id, user_id: user.id,
        module: 'submittal', record_label: submittalNumber,
        action: `resubmitted as Rev ${nextRev}`,
      })

      await fetchSubmittals()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to resubmit' }
    } finally {
      setSaving(false)
    }
  }, [user, activeProject, fetchSubmittals])

  // ── Fetch revisions for a submittal ─────────────────────────────────────

  const fetchRevisions = useCallback(async (submittalId: string): Promise<SubmittalRevision[]> => {
    const { data, error: err } = await supabase
      .from('submittal_revisions')
      .select(`
        id, submittal_id, revision_number, status, notes, dropbox_path, submitted_at, returned_at, created_at,
        submitted_by:user_profiles!submitted_by(full_name),
        returned_by:user_profiles!returned_by(full_name)
      `)
      .eq('submittal_id', submittalId)
      .order('revision_number', { ascending: false })

    if (err) return []
    return (data ?? []).map((r: any) => ({
      ...r,
      submitted_by_name: r.submitted_by?.full_name ?? null,
      returned_by_name:  r.returned_by?.full_name  ?? null,
    }))
  }, [])

  // ── Sort toggle ──────────────────────────────────────────────────────────

  const toggleSort = useCallback((col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }, [sortBy])

  return {
    submittals: filtered, allSubmittals: submittals,
    loading, saving, error,
    filters, setFilters, sortBy, sortDir, toggleSort,
    fetchSubmittals, createSubmittal,
    reviewSubmittal, resubmit, fetchRevisions,
  }
}
