import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  user_id: string
  project_id: string | null
  title: string
  body: string
  module: string | null
  record_id: string | null
  record_label: string | null
  is_read: boolean
  channel: 'in_app' | 'email' | 'sms'
  sent_at: string
  read_at: string | null
  project_name?: string | null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const { user, activeProject } = useAuth()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]        = useState(true)
  const [unreadCount,   setUnreadCount]    = useState(0)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, project:projects(name)')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(60)

      if (error) throw error

      const mapped: Notification[] = (data ?? []).map((n: any) => ({
        ...n,
        project_name: n.project?.name ?? null,
      }))

      setNotifications(mapped)
      setUnreadCount(mapped.filter(n => !n.is_read).length)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  // ── Real-time subscription ───────────────────────────────────────────────

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        payload => {
          const n = payload.new as Notification
          setNotifications(prev => [n, ...prev])
          setUnreadCount(c => c + 1)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // ── Mark single as read ──────────────────────────────────────────────────

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
    )
    setUnreadCount(c => Math.max(0, c - 1))
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
  }, [])

  // ── Mark all as read ─────────────────────────────────────────────────────

  const markAllRead = useCallback(async () => {
    if (!user) return
    const now = new Date().toISOString()
    setNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true, read_at: now }))
    )
    setUnreadCount(0)
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: now })
      .eq('user_id', user.id)
      .eq('is_read', false)
  }, [user])

  // ── Send notification (helper for client-side triggers) ──────────────────
  // In production, critical notifications are sent from Supabase Edge Functions.
  // This client-side helper handles in-app + queues email/SMS via the DB trigger.

  const sendNotification = useCallback(async (payload: {
    user_id: string
    project_id?: string
    title: string
    body: string
    module?: string
    record_id?: string
    record_label?: string
    channel?: 'in_app' | 'email' | 'sms'
  }): Promise<void> => {
    try {
      await supabase.from('notifications').insert({
        user_id:      payload.user_id,
        project_id:   payload.project_id   ?? null,
        title:        payload.title,
        body:         payload.body,
        module:       payload.module        ?? null,
        record_id:    payload.record_id     ?? null,
        record_label: payload.record_label  ?? null,
        channel:      payload.channel       ?? 'in_app',
        is_read:      false,
        sent_at:      new Date().toISOString(),
      })
    } catch (err) {
      console.error('Failed to send notification:', err)
    }
  }, [])

  // ── Notify project members with a role ───────────────────────────────────

  const notifyRole = useCallback(async (
    projectId: string,
    roles: string[],
    title: string,
    body: string,
    opts?: { module?: string; record_id?: string; record_label?: string; channel?: 'in_app' | 'email' | 'sms' }
  ): Promise<void> => {
    try {
      // Get members with matching roles
      const { data: members } = await supabase
        .from('project_users')
        .select('user_id')
        .eq('project_id', projectId)
        .in('role', roles)

      if (!members || members.length === 0) return

      const now = new Date().toISOString()
      await supabase.from('notifications').insert(
        members.map((m: any) => ({
          user_id:      m.user_id,
          project_id:   projectId,
          title,
          body,
          module:       opts?.module       ?? null,
          record_id:    opts?.record_id    ?? null,
          record_label: opts?.record_label ?? null,
          channel:      opts?.channel      ?? 'in_app',
          is_read:      false,
          sent_at:      now,
        }))
      )
    } catch (err) {
      console.error('notifyRole failed:', err)
    }
  }, [])

  // ── Notify specific user ─────────────────────────────────────────────────

  const notifyUser = useCallback(async (
    userId: string,
    projectId: string,
    title: string,
    body: string,
    opts?: { module?: string; record_id?: string; record_label?: string; channel?: 'in_app' | 'email' | 'sms' }
  ): Promise<void> => {
    await sendNotification({
      user_id:      userId,
      project_id:   projectId,
      title,
      body,
      ...opts,
    })
  }, [sendNotification])

  return {
    notifications, loading, unreadCount,
    fetchNotifications, markRead, markAllRead,
    sendNotification, notifyRole, notifyUser,
  }
}
