import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardCounts {
  openRFIs: number
  overdueRFIs: number
  pendingSubmittals: number
  openPunch: number
  overduePunch: number
  openTasks: number
  reportsThisWeek: number
  totalOverdue: number
}

export interface ActivityItem {
  id: string
  module: string
  record_label: string | null
  action: string
  user_name: string | null
  created_at: string
}

export interface OverdueItem {
  id: string
  type: 'rfi' | 'submittal' | 'punch'
  label: string
  subject: string
  due_date: string
  days_overdue: number
  assigned_to: string | null
}

export interface DashboardData {
  counts: DashboardCounts
  activity: ActivityItem[]
  overdueItems: OverdueItem[]
  loading: boolean
  error: string | null
  refresh: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboard(): DashboardData {
  const { activeProject, activeRole } = useAuth()
  const projectId = activeProject?.project.id

  const [counts, setCounts] = useState<DashboardCounts>({
    openRFIs: 0, overdueRFIs: 0, pendingSubmittals: 0,
    openPunch: 0, overduePunch: 0, openTasks: 0,
    reportsThisWeek: 0, totalOverdue: 0,
  })
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [overdueItems, setOverdueItems] = useState<OverdueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
    setLoading(true)
    setError(null)

    const today = new Date().toISOString().split('T')[0]
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekStartStr = weekStart.toISOString().split('T')[0]

    try {
      // Run all queries in parallel
      const [
        rfiOpen,
        rfiOverdue,
        submittals,
        punchOpen,
        punchOverdue,
        tasks,
        reports,
        activityFeed,
        overdueRFIs,
        overdueSubmittals,
        overduePunch,
      ] = await Promise.all([
        // Open RFIs
        supabase.from('rfis')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .in('status', ['open', 'draft']),

        // Overdue RFIs (open + past due date)
        supabase.from('rfis')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .in('status', ['open'])
          .lt('due_date', today)
          .not('due_date', 'is', null),

        // Pending submittals
        supabase.from('submittals')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .in('status', ['submitted', 'under_review']),

        // Open punch items
        supabase.from('punch_items')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .in('status', ['open', 'in_progress', 'ready_for_inspection']),

        // Overdue punch items
        supabase.from('punch_items')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .in('status', ['open', 'in_progress'])
          .lt('due_date', today)
          .not('due_date', 'is', null),

        // Open tasks (GC only)
        activeRole && ['gc_admin', 'gc_field'].includes(activeRole)
          ? supabase.from('tasks')
              .select('id', { count: 'exact', head: true })
              .eq('project_id', projectId)
              .in('status', ['todo', 'in_progress'])
          : Promise.resolve({ count: 0, error: null }),

        // Daily reports this week
        supabase.from('daily_reports')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .gte('report_date', weekStartStr),

        // Activity feed (last 25 items with user profile join)
        supabase.from('activity_log')
          .select(`
            id, module, record_label, action, created_at,
            user:user_profiles(full_name)
          `)
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(25),

        // Overdue RFI details
        supabase.from('rfis')
          .select('id, rfi_number, subject, due_date, ball_in_court:user_profiles!ball_in_court_id(full_name)')
          .eq('project_id', projectId)
          .eq('status', 'open')
          .lt('due_date', today)
          .not('due_date', 'is', null)
          .order('due_date', { ascending: true })
          .limit(5),

        // Overdue submittal details
        supabase.from('submittals')
          .select('id, submittal_number, description, required_return_date, reviewer:user_profiles!reviewer_id(full_name)')
          .eq('project_id', projectId)
          .in('status', ['submitted', 'under_review'])
          .lt('required_return_date', today)
          .not('required_return_date', 'is', null)
          .order('required_return_date', { ascending: true })
          .limit(5),

        // Overdue punch details
        supabase.from('punch_items')
          .select('id, punch_number, description, due_date, assigned:user_profiles!assigned_to(full_name)')
          .eq('project_id', projectId)
          .in('status', ['open', 'in_progress'])
          .lt('due_date', today)
          .not('due_date', 'is', null)
          .order('due_date', { ascending: true })
          .limit(5),
      ])

      // Build counts
      const overdueCount = (rfiOverdue.count ?? 0) + (punchOverdue.count ?? 0)
      setCounts({
        openRFIs: rfiOpen.count ?? 0,
        overdueRFIs: rfiOverdue.count ?? 0,
        pendingSubmittals: submittals.count ?? 0,
        openPunch: punchOpen.count ?? 0,
        overduePunch: punchOverdue.count ?? 0,
        openTasks: tasks.count ?? 0,
        reportsThisWeek: reports.count ?? 0,
        totalOverdue: overdueCount,
      })

      // Build activity feed
      const actItems: ActivityItem[] = (activityFeed.data ?? []).map((a: any) => ({
        id: a.id,
        module: a.module,
        record_label: a.record_label,
        action: a.action,
        user_name: a.user?.full_name ?? null,
        created_at: a.created_at,
      }))
      setActivity(actItems)

      // Build overdue items list
      const now = new Date()
      const overdue: OverdueItem[] = []

      ;(overdueRFIs.data ?? []).forEach((r: any) => {
        const days = Math.floor((now.getTime() - new Date(r.due_date).getTime()) / 86400000)
        overdue.push({
          id: r.id, type: 'rfi',
          label: r.rfi_number,
          subject: r.subject,
          due_date: r.due_date,
          days_overdue: days,
          assigned_to: r.ball_in_court?.full_name ?? null,
        })
      })

      ;(overdueSubmittals.data ?? []).forEach((s: any) => {
        const days = Math.floor((now.getTime() - new Date(s.required_return_date).getTime()) / 86400000)
        overdue.push({
          id: s.id, type: 'submittal',
          label: s.submittal_number,
          subject: s.description,
          due_date: s.required_return_date,
          days_overdue: days,
          assigned_to: s.reviewer?.full_name ?? null,
        })
      })

      ;(overduePunch.data ?? []).forEach((p: any) => {
        const days = Math.floor((now.getTime() - new Date(p.due_date).getTime()) / 86400000)
        overdue.push({
          id: p.id, type: 'punch',
          label: p.punch_number,
          subject: p.description,
          due_date: p.due_date,
          days_overdue: days,
          assigned_to: p.assigned?.full_name ?? null,
        })
      })

      // Sort by most overdue first
      overdue.sort((a, b) => b.days_overdue - a.days_overdue)
      setOverdueItems(overdue)

    } catch (err: any) {
      setError(err.message ?? 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [projectId, activeRole])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { counts, activity, overdueItems, loading, error, refresh: fetchAll }
}
