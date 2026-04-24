import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export type WeatherCondition = 'clear' | 'partly_cloudy' | 'overcast' | 'rain' | 'wind' | 'snow' | 'fog'

export interface DailyReport {
  id: string
  project_id: string
  report_date: string
  submitted_by: string
  submitted_by_name: string | null
  trade: string | null
  temp_high: number | null
  temp_low: number | null
  weather_condition: WeatherCondition | null
  site_conditions: string | null
  work_performed: string | null
  safety_observations: string | null
  has_safety_incident: boolean
  notes: string | null
  signed_name: string | null
  signed_at: string | null
  created_at: string
}

export interface ManpowerRow {
  trade: string
  foreman_name: string
  worker_count: string
  hours_worked: string
}

export interface EquipmentRow {
  equipment_type: string
  unit_id: string
  hours_used: string
}

export interface DeliveryRow {
  material: string
  supplier: string
  quantity: string
  po_reference: string
}

export interface PhotoRow {
  dropbox_path: string
  caption: string
}

export interface FullReport extends DailyReport {
  manpower: any[]
  equipment: any[]
  deliveries: any[]
  photos: any[]
}

export function useDailyReports() {
  const { activeProject, user, activeRole } = useAuth()
  const projectId = activeProject?.project.id

  const [reports,   setReports]   = useState<DailyReport[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [searchStr, setSearchStr] = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')

  const fetchReports = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      let q = supabase
        .from('daily_reports')
        .select('*, submitter:user_profiles!submitted_by(full_name, company)')
        .eq('project_id', projectId)
        .order('report_date', { ascending: false })

      const canViewAll = activeRole === 'gc_admin' || activeRole === 'gc_field' || activeRole === 'owner' || activeRole === 'architect'
      if (!canViewAll && user) {
        q = q.eq('submitted_by', user.id)
      }

      const { data, error: err } = await q
      if (err) throw err

      setReports((data ?? []).map((r: any) => ({
        ...r,
        submitted_by_name: r.submitter?.full_name ?? null,
      })))
    } catch (err: any) {
      setError(err.message ?? 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [projectId, activeRole, user])

  useEffect(() => { fetchReports() }, [fetchReports])

  const filtered = reports.filter(r => {
    if (dateFrom && r.report_date < dateFrom) return false
    if (dateTo   && r.report_date > dateTo)   return false
    if (searchStr.trim()) {
      const q = searchStr.toLowerCase()
      if (
        !(r.work_performed ?? '').toLowerCase().includes(q) &&
        !(r.trade ?? '').toLowerCase().includes(q) &&
        !(r.submitted_by_name ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const fetchFullReport = useCallback(async (id: string): Promise<FullReport | null> => {
    try {
      const [reportRes, manpowerRes, equipRes, delivRes, photoRes] = await Promise.all([
        supabase.from('daily_reports').select('*, submitter:user_profiles!submitted_by(full_name)').eq('id', id).single(),
        supabase.from('daily_report_manpower').select('*').eq('report_id', id),
        supabase.from('daily_report_equipment').select('*').eq('report_id', id),
        supabase.from('daily_report_deliveries').select('*').eq('report_id', id),
        supabase.from('daily_report_photos').select('*').eq('report_id', id).order('sort_order'),
      ])
      if (reportRes.error) throw reportRes.error
      return {
        ...reportRes.data,
        submitted_by_name: (reportRes.data as any).submitter?.full_name ?? null,
        manpower:  manpowerRes.data  ?? [],
        equipment: equipRes.data     ?? [],
        deliveries: delivRes.data    ?? [],
        photos:    photoRes.data     ?? [],
      } as FullReport
    } catch {
      return null
    }
  }, [])

  const submitReport = useCallback(async (payload: {
    report_date: string
    trade: string
    weather_condition: WeatherCondition
    temp_high: number | null
    temp_low: number | null
    site_conditions: string
    work_performed: string
    safety_observations: string
    has_safety_incident: boolean
    notes: string
    signed_name: string
    signed_at: string
    manpower: ManpowerRow[]
    equipment: EquipmentRow[]
    deliveries: DeliveryRow[]
    photos: PhotoRow[]
  }): Promise<{ error: string | null; id?: string }> => {
    if (!projectId || !user) return { error: 'No active project' }
    setSaving(true)
    try {
      const { data: report, error: reportErr } = await supabase
        .from('daily_reports')
        .insert({
          project_id:          projectId,
          submitted_by:        user.id,
          report_date:         payload.report_date,
          trade:               payload.trade               || null,
          weather_condition:   payload.weather_condition,
          temp_high:           payload.temp_high,
          temp_low:            payload.temp_low,
          site_conditions:     payload.site_conditions     || null,
          work_performed:      payload.work_performed      || null,
          safety_observations: payload.safety_observations || null,
          has_safety_incident: payload.has_safety_incident,
          notes:               payload.notes               || null,
          signed_name:         payload.signed_name         || null,
          signed_at:           payload.signed_at           || null,
        })
        .select('id')
        .single()

      if (reportErr) throw reportErr
      const reportId = report.id

      const inserts: Promise<any>[] = []

      if (payload.manpower.filter(r => r.trade.trim()).length > 0) {
        inserts.push(
          supabase.from('daily_report_manpower').insert(
            payload.manpower.filter(r => r.trade.trim()).map(r => ({
              report_id:    reportId,
              trade:        r.trade,
              foreman_name: r.foreman_name || null,
              worker_count: parseInt(r.worker_count) || 0,
              hours_worked: r.hours_worked ? parseFloat(r.hours_worked) : null,
            }))
          ) as any
        )
      }

      if (payload.equipment.filter(r => r.equipment_type.trim()).length > 0) {
        inserts.push(
          supabase.from('daily_report_equipment').insert(
            payload.equipment.filter(r => r.equipment_type.trim()).map(r => ({
              report_id:      reportId,
              equipment_type: r.equipment_type,
              unit_id:        r.unit_id || null,
              hours_used:     r.hours_used ? parseFloat(r.hours_used) : null,
            }))
          ) as any
        )
      }

      if (payload.deliveries.filter(r => r.material.trim()).length > 0) {
        inserts.push(
          supabase.from('daily_report_deliveries').insert(
            payload.deliveries.filter(r => r.material.trim()).map(r => ({
              report_id:    reportId,
              material:     r.material,
              supplier:     r.supplier     || null,
              quantity:     r.quantity     || null,
              po_reference: r.po_reference || null,
            }))
          ) as any
        )
      }

      if (payload.photos.filter(r => r.dropbox_path.trim()).length > 0) {
        inserts.push(
          supabase.from('daily_report_photos').insert(
            payload.photos.filter(r => r.dropbox_path.trim()).map((r, i) => ({
              report_id:    reportId,
              dropbox_path: r.dropbox_path,
              caption:      r.caption || null,
              sort_order:   i,
              uploaded_by:  user.id,
            }))
          ) as any
        )
      }

      await Promise.all(inserts)

      await supabase.from('activity_log').insert({
        project_id:   projectId,
        user_id:      user.id,
        module:       'daily_report',
        record_label: `Report ${payload.report_date}`,
        action:       'submitted',
      })

      await fetchReports()
      return { error: null, id: reportId }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to submit report' }
    } finally {
      setSaving(false)
    }
  }, [projectId, user, fetchReports])

  return {
    reports: filtered, allReports: reports,
    loading, saving, error,
    searchStr, setSearchStr,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    clearFilters: () => { setSearchStr(''); setDateFrom(''); setDateTo('') },
    fetchReports, fetchFullReport, submitReport,
  }
}