import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, type UserProfile, type UserRole, type Project } from '../lib/supabase'
export type { UserRole } from '../lib/supabase'
// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectMembership {
  project: Project
  role: UserRole
  company: string | null
  trade: string | null
}

interface AuthContextValue {
  // Auth state
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean

  // Project state
  projects: ProjectMembership[]
  activeProject: ProjectMembership | null
  activeRole: UserRole | null
  setActiveProject: (projectId: string) => void

  // Permissions
  can: (action: Permission) => boolean

  // Actions
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export type Permission =
  | 'create_rfi'
  | 'respond_rfi'
  | 'create_submittal'
  | 'approve_submittal'
  | 'create_punch'
  | 'close_punch'
  | 'create_task'
  | 'create_daily_report'
  | 'view_all_daily_reports'
  | 'annotate_drawings'
  | 'upload_drawings'
  | 'manage_users'
  | 'manage_project'
  | 'upload_documents'
  | 'view_financials'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  gc_admin: [
    'create_rfi', 'respond_rfi', 'create_submittal', 'approve_submittal',
    'create_punch', 'close_punch', 'create_task', 'create_daily_report',
    'view_all_daily_reports', 'annotate_drawings', 'upload_drawings',
    'manage_users', 'manage_project', 'upload_documents', 'view_financials',
  ],
  gc_field: [
    'create_rfi', 'create_submittal', 'create_punch', 'close_punch',
    'create_task', 'create_daily_report', 'view_all_daily_reports',
    'annotate_drawings', 'upload_drawings', 'upload_documents',
  ],
  owner: [
    'create_rfi', 'view_all_daily_reports', 'view_financials',
  ],
  subcontractor: [
    'create_rfi', 'create_submittal', 'create_daily_report', 'upload_documents',
  ],
  architect: [
    'create_rfi', 'respond_rfi', 'create_submittal', 'approve_submittal',
    'annotate_drawings', 'upload_drawings', 'upload_documents',
  ],
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [projects, setProjects] = useState<ProjectMembership[]>([])
  const [activeProject, setActiveProjectState] = useState<ProjectMembership | null>(null)
  const [loading, setLoading] = useState(true)

  // Load user profile + project memberships
  const loadUserData = useCallback(async (userId: string) => {
    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError
      setProfile(profileData)

      // Load project memberships with project details
      const { data: membershipData, error: membershipError } = await supabase
        .from('project_users')
        .select(`
          role, company, trade,
          project:projects (
            id, name, address, city, state, zip,
            project_number, owner_name, architect_name,
            contract_value, start_date, end_date, is_active
          )
        `)
        .eq('user_id', userId)
        .eq('projects.is_active', true)

      if (membershipError) throw membershipError

      const memberships: ProjectMembership[] = (membershipData || [])
        .filter((m: any) => m.project)
        .map((m: any) => ({
          project: m.project,
          role: m.role,
          company: m.company,
          trade: m.trade,
        }))

      setProjects(memberships)

      // Restore last active project from localStorage
      const savedProjectId = localStorage.getItem('fieldstack_active_project')
      const savedProject = memberships.find(m => m.project.id === savedProjectId)
      setActiveProjectState(savedProject || memberships[0] || null)

    } catch (err) {
      console.error('Error loading user data:', err)
    }
  }, [])

  // Refresh profile only
  const refreshProfile = useCallback(async () => {
    if (!user) return
    await loadUserData(user.id)
  }, [user, loadUserData])

  // Set active project
  const setActiveProject = useCallback((projectId: string) => {
    const membership = projects.find(m => m.project.id === projectId)
    if (membership) {
      setActiveProjectState(membership)
      localStorage.setItem('fieldstack_active_project', projectId)
    }
  }, [projects])

  // Permission check
  const can = useCallback((action: Permission): boolean => {
    if (!activeProject?.role) return false
    return ROLE_PERMISSIONS[activeProject.role]?.includes(action) ?? false
  }, [activeProject])

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }, [])

  // Sign out
  const signOut = useCallback(async () => {
    localStorage.removeItem('fieldstack_active_project')
    await supabase.auth.signOut()
    setProfile(null)
    setProjects([])
    setActiveProjectState(null)
  }, [])

  // Listen to auth state changes
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadUserData(session.user.id)
        } else {
          setProfile(null)
          setProjects([])
          setActiveProjectState(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadUserData])

  const value: AuthContextValue = {
    session, user, profile, loading,
    projects, activeProject, activeRole: activeProject?.role ?? null,
    setActiveProject,
    can, signIn, signOut, refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function usePermission(action: Permission) {
  const { can } = useAuth()
  return can(action)
}
