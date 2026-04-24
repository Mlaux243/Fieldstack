import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type UserRole = 'gc_admin' | 'gc_field' | 'owner' | 'subcontractor' | 'architect'

export interface UserProfile {
  id: string
  full_name: string
  company: string | null
  phone: string | null
  avatar_url: string | null
  is_active: boolean
}

export interface ProjectUser {
  id: string
  project_id: string
  user_id: string
  role: UserRole
  company: string | null
  trade: string | null
}

export interface Project {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  project_number: string | null
  owner_name: string | null
  architect_name: string | null
  contract_value: number | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
}

export type Permission =
  | 'create_rfi' | 'respond_rfi'
  | 'create_submittal' | 'approve_submittal'
  | 'create_punch' | 'close_punch'
  | 'create_task' | 'create_daily_report'
  | 'view_all_daily_reports'
  | 'annotate_drawings' | 'upload_drawings'
  | 'manage_users' | 'upload_documents'

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  gc_admin: [
    'create_rfi','respond_rfi','create_submittal','approve_submittal',
    'create_punch','close_punch','create_task','create_daily_report',
