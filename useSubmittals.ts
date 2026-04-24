import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PunchStatus = 'open' | 'in_progress' | 'ready_for_inspection' | 'closed'

export interface PunchItem {
  id: string
  project_id: string
  punch_number: string
  location: string
  trade: string
  description: string
  assigned_to: string | null
  assigned_to_name: string | null
  status: PunchStatus
  due_date: string | null
  closed_by: string | null
  closed_by_name: string | null
  closed_at: string | null
  linked_drawing_id: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  is_overdue: boolean
  photo_count?: number
}

export interface PunchPhoto {
  id: string
  punch_item_id: string
  dropbox_path: string
  caption: string | null
  uploaded_by: string | null
  created_at: string
}

export interface CreatePunchPayload {
  location: string
  trade: string
  description: string
  assigned_to: string | null
  due_date: string | null
}

export interface PunchFilters {
  status: PunchStatus | 'all'
  trade: string | 'all'
  assigned_to: string | 'all'
  search: string
  overdue_only: boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePunchList() {
  const { activeProject, user, activeRole } = useAuth()
  const projectId = activeProject?.project.id

  const [items,   setItems]   = useState<PunchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [filters, setFilters] = useState<PunchFilters>({
    status: 'all', trade: 'all', assigned_to: 'all',
    search: '', overdue_only: false,
  })
  const [sortBy,  setSortBy]  = useState<'punch_number' | 'due_date' | 'trade' | 'updated_at'>('punch_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('v_punch_items')
        .select('*')
        .eq('project_id', projectId)
        .order(sortBy, { ascending: sortDir === 'asc' })

      if (err) throw err

      const today = new Date().toISOString().split('T')[0]
      const mapped: PunchItem[] = (data ?? []).map((p: any) => ({
        ...p,
        is_overdue: !!(
          p.due_date &&
          p.due_date < today &&
          !['closed'].includes(p.status)
        ),
      }))

      // Sub sees only their assigned items
      const visible = activeRole === 'subcontractor'
        ? mapped.filter(p => p.assigned_to === user?.id)
        : mapped

      setItems(visible)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load punch list')
    } finally {
      setLoading(false)
    }
  }, [projectId, sortBy, sortDir, activeRole, user])

  useEffect(() => { fetchItems() }, [fetchItems])

  // ── Derived filter values ────────────────────────────────────────────────

  const allTrades  = [...new Set(items.map(i => i.trade))].sort()
  const allAssigned = [...new Set(items.filter(i => i.assigned_to).map(i => ({ id: i.assigned_to!, name: i.assigned_to_name ?? 'Unknown' })))].filter((v, i, a) => a.findIndex(x => x.id === v.id) === i)

  // ── Client filter ────────────────────────────────────────────────────────

  const filtered = items.filter(p => {
    if (filters.status !== 'all' && p.status !== filters.status) return false
    if (filters.trade  !== 'all' && p.trade  !== filters.trade)  return false
    if (filters.assigned_to !== 'all' && p.assigned_to !== filters.assigned_to) return false
    if (filters.overdue_only && !p.is_overdue) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !p.punch_number.toLowerCase().includes(q) &&
        !p.description.toLowerCase().includes(q) &&
        !p.location.toLowerCase().includes(q) &&
        !p.trade.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // ── Status counts ────────────────────────────────────────────────────────

  const counts = {
    open:                 items.filter(p => p.status === 'open').length,
    in_progress:          items.filter(p => p.status === 'in_progress').length,
    ready_for_inspection: items.filter(p => p.status === 'ready_for_inspection').length,
    closed:               items.filter(p => p.status === 'closed').length,
    overdue:              items.filter(p => p.is_overdue).length,
    total:                items.length,
  }

  // ── Create ───────────────────────────────────────────────────────────────

  const createItem = useCallback(async (
    payload: CreatePunchPayload
  ): Promise<{ error: string | null; id?: string }> => {
    if (!projectId || !user) return { error: 'No active project' }
    setSaving(true)
    try {
      const { data: num, error: cErr } = await supabase.rpc('next_project_counter', {
        p_project_id: projectId, p_counter_name: 'punch',
      })
      if (cErr) throw cErr
      const punchNumber = `PL-${String(num).padStart(3, '0')}`

      const { data, error: insertErr } = await supabase.from('punch_items').insert({
        project_id:  projectId,
        punch_number: punchNumber,
        location:     payload.location.trim(),
        trade:        payload.trade.trim(),
        description:  payload.description.trim(),
        assigned_to:  payload.assigned_to || null,
        due_date:     payload.due_date    || null,
        status:       'open',
        created_by:   user.id,
      }).select('id').single()

      if (insertErr) throw insertErr

      await supabase.from('activity_log').insert({
        project_id: projectId, user_id: user.id,
        module: 'punch_item', record_label: punchNumber, action: 'created',
      })

      await fetchItems()
      return { error: null, id: data?.id }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to create punch item' }
    } finally {
      setSaving(false)
    }
  }, [projectId, user, fetchItems])

  // ── Update status ────────────────────────────────────────────────────────

  const updateStatus = useCallback(async (
    id: string, punchNumber: string, status: PunchStatus
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }
    setSaving(true)
    try {
      const updates: any = { status }
      if (status === 'closed') {
        updates.closed_by = user.id
        updates.closed_at = new Date().toISOString()
      }

      const { error: updateErr } = await supabase
        .from('punch_items').update(updates).eq('id', id)
      if (updateErr) throw updateErr

      await supabase.from('activity_log').insert({
        project_id: activeProject?.project.id, user_id: user.id,
        module: 'punch_item', record_label: punchNumber,
        action: `status changed to ${status.replace(/_/g, ' ')}`,
      })

      await fetchItems()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to update status' }
    } finally {
      setSaving(false)
    }
  }, [user, activeProject, fetchItems])

  // ── Reassign trade / user ────────────────────────────────────────────────

  const reassign = useCallback(async (
    id: string, assignedTo: string | null, trade: string
  ): Promise<{ error: string | null }> => {
    setSaving(true)
    try {
      const { error: updateErr } = await supabase
        .from('punch_items')
        .update({ assigned_to: assignedTo || null, trade })
        .eq('id', id)
      if (updateErr) throw updateErr
      await fetchItems()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to reassign' }
    } finally {
      setSaving(false)
    }
  }, [fetchItems])

  // ── Bulk status update ───────────────────────────────────────────────────

  const bulkUpdateStatus = useCallback(async (
    ids: string[], status: PunchStatus
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }
    setSaving(true)
    try {
      const updates: any = { status }
      if (status === 'closed') {
        updates.closed_by = user.id
        updates.closed_at = new Date().toISOString()
      }
      const { error: updateErr } = await supabase
        .from('punch_items').update(updates).in('id', ids)
      if (updateErr) throw updateErr
      await fetchItems()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Bulk update failed' }
    } finally {
      setSaving(false)
    }
  }, [user, fetchItems])

  // ── Fetch photos for an item ─────────────────────────────────────────────

  const fetchPhotos = useCallback(async (itemId: string): Promise<PunchPhoto[]> => {
    const { data, error: err } = await supabase
      .from('punch_photos')
      .select('*')
      .eq('punch_item_id', itemId)
      .order('created_at', { ascending: true })
    if (err) return []
    return data ?? []
  }, [])

  // ── Add photo record ─────────────────────────────────────────────────────

  const addPhoto = useCallback(async (
    itemId: string, dropboxPath: string, caption: string
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }
    try {
      const { error: insertErr } = await supabase.from('punch_photos').insert({
        punch_item_id: itemId,
        dropbox_path:  dropboxPath,
        caption:       caption || null,
        uploaded_by:   user.id,
      })
      if (insertErr) throw insertErr
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to add photo' }
    }
  }, [user])

  // ── Sort toggle ──────────────────────────────────────────────────────────

  const toggleSort = useCallback((col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }, [sortBy])

  return {
    items: filtered, allItems: items, loading, saving, error,
    counts, allTrades, allAssigned,
    filters, setFilters, sortBy, sortDir, toggleSort,
    fetchItems, createItem, updateStatus, reassign,
    bulkUpdateStatus, fetchPhotos, addPhoto,
  }
}
