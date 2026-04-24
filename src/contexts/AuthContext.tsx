import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, type UserRole, type Permission, ROLE_PERMISSIONS } from '../lib/supabase'

export type { UserRole } from '../lib/supabase'

interface ProjectMembership {
  project: { id: string; name: string; project_number: string | null; is_active: boolean }
  role: UserRole
  company: string | null
  trade: string | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: { id: string; full_name: string; phone: string | null } | null
  loading: boolean
  projects: ProjectMembership[]
  activeProject: ProjectMembership | null
  activeRole: UserRole | null
  setActiveProject: (id: string) => void
  can: (action: Permission) => boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [projects, setProjects] = useState<ProjectMembership[]>([])
  const [activeProject, setActiveProjectState] = useState<ProjectMembership | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUserData = useCallback(async (userId: string) => {
    try {
      const [profileRes, memberRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', userId).single(),
        supabase.from('project_users')
          .select('role, company, trade, project:projects(id,name,project_number,is_active)')
          .eq('user_id', userId)
      ])
      if (profileRes.data) setProfile(profileRes.data)
      const memberships: ProjectMembership[] = ((memberRes.data ?? []) as any[])
        .filter(m => m.project?.is_active)
        .map(m => ({ project: m.project, role: m.role, company: m.company, trade: m.trade }))
      setProjects(memberships)
      setActiveProjectState(memberships[0] ?? null)
    } catch (err) {
      console.error('loadUserData error:', err)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserData(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) await loadUserData(session.user.id)
      else { setProfile(null); setProjects([]); setActiveProjectState(null) }
    })
    return () => subscription.unsubscribe()
  }, [loadUserData])

  const setActiveProject = useCallback((id: string) => {
    const m = projects.find(p => p.project.id === id)
    if (m) setActiveProjectState(m)
  }, [projects])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null); setProjects([]); setActiveProjectState(null)
  }, [])

  const can = useCallback((action: Permission) => {
    const role = activeProject?.role ?? null
    if (!role) return false
    return ROLE_PERMISSIONS[role]?.includes(action) ?? false
  }, [activeProject])

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading,
      projects, activeProject, activeRole: activeProject?.role ?? null,
      setActiveProject, can, signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}