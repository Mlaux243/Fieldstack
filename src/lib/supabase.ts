import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserRole =
  | 'gc_admin' | 'gc_field' | 'owner' | 'subcontractor' | 'architect'

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
    'view_all_daily_reports','annotate_drawings','upload_drawings',
    'manage_users','upload_documents',
  ],
  gc_field: [
    'create_rfi','create_submittal','create_punch','close_punch',
    'create_task','create_daily_report','view_all_daily_reports',
    'annotate_drawings','upload_drawings','upload_documents',
  ],
  owner:         ['create_rfi','view_all_daily_reports'],
  subcontractor: ['create_rfi','create_submittal','create_daily_report','upload_documents'],
  architect:     ['create_rfi','respond_rfi','create_submittal','approve_submittal','annotate_drawings','upload_drawings','upload_documents'],
}
