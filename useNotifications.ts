import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WeatherCondition = 'clear' | 'partly_cloudy' | 'overcast' | 'rain' | 'wind' | 'snow' | 'fog'

export interface DailyReport {
  id: string
  project_id: string
  report_date: string
  submitted_by: string
  submitted_by_name: string | null
  submitted_by_company: string | null
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
  updated_at: string
}

export interface ManpowerRow {
  id?: string
  trade: string
  foreman_name: string
  worker_count: number
  hours_worked: number | null
}

export interface EquipmentRow {
  id?: string
  equipment_type: string
  unit_id: string
  hours_used: number | null
}

export interface DeliveryRow {
  id?: string
  material: string
  supplier: string
  quantity: string
  po_reference: string
}

export interface ReportPhoto {
  id?: string
  dropbox_path: string
  caption: string
  sort_order: number
}

export interface FullReport extends DailyReport {
  manpower: ManpowerRow[]
  equipment: EquipmentRow[]
  deliveries: DeliveryRow[]
  photos: ReportPhoto[]
}

export interface ReportFilters {
  search: string
  date_from: string
  date_to: string
  trade: string | 'all'
  incident_only: boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDailyReports() {
  const { activeProject, user, activeRole } = useAuth()
  const projectId = activeProject?.project.id

  const [reports,  setReports]  = useState<DailyReport[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const [filters, setFilters] = useState<ReportFilters>({
    search: '', date_from: '', date_to: '', trade: 'all', incident_only: false,
  })

  // ── Fetch list ───────────────────────────────────────────────────────────

  const fetchReports = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      let query = supabase
        .from('v_daily_reports')
        .select('*')
        .eq('project_id', projectId)
        .order('report_date', { ascending: false })
        .order('created_at',  { ascending: false })

      // Subs only see their own
      if (activeRole === 'subcontractor') {
        query = query.eq('submitted_by', user?.id)
      }

      const { data, error: err } = await query
      if (err) throw err
      setReports(data ?? [])
    } catch (err: any) {
      setError(err.message ?? 'Failed to load daily reports')
    } finally {
      setLoading(false)
    }
  }, [projectId, activeRole, user])

  useEffect(() => { fetchReports() }, [fetchReports])

  // ── Client filter ────────────────────────────────────────────────────────

  const allTrades = [...new Set(reports.map(r => r.trade).filter(Boolean) as string[])].sort()

  const filtered = reports.filter(r => {
    if (filters.trade !== 'all' && r.trade !== filters.trade) return false
    if (filters.incident_only && !r.has_safety_incident) return false
    if (filters.date_from && r.report_date < filters.date_from) return false
    if (filters.date_to   && r.report_date > filters.date_to)   return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !(r.submitted_by_name  ?? '').toLowerCase().includes(q) &&
        !(r.trade              ?? '').toLowerCase().includes(q) &&
        !(r.work_performed     ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // ── Fetch full report (with all child records) ───────────────────────────

  const fetchFullReport = useCallback(async (reportId: string): Promise<FullReport | null> => {
    try {
      const [reportRes, manRes, eqRes, delRes, photoRes] = await Promise.all([
        supabase.from('v_daily_reports').select('*').eq('id', reportId).single(),
        supabase.from('daily_report_manpower').select('*').eq('report_id', reportId).order('created_at'),
        supabase.from('daily_report_equipment').select('*').eq('report_id', reportId).order('created_at'),
        supabase.from('daily_report_deliveries').select('*').eq('report_id', reportId).order('created_at'),
        supabase.from('daily_report_photos').select('*').eq('report_id', reportId).order('sort_order'),
      ])

      if (reportRes.error) throw reportRes.error

      return {
        ...reportRes.data,
        manpower:  manRes.data  ?? [],
        equipment: eqRes.data   ?? [],
        deliveries:delRes.data  ?? [],
        photos:    photoRes.data ?? [],
      }
    } catch (err) {
      return null
    }
  }, [])

  // ── Save full report (upsert pattern) ────────────────────────────────────

  const saveReport = useCallback(async (
    reportData: Omit<DailyReport, 'id' | 'project_id' | 'submitted_by' | 'created_at' | 'updated_at' | 'submitted_by_name' | 'submitted_by_company'>,
    manpower: ManpowerRow[],
    equipment: EquipmentRow[],
    deliveries: DeliveryRow[],
    photos: ReportPhoto[],
    existingId?: string
  ): Promise<{ error: string | null; id?: string }> => {
    if (!projectId || !user) return { error: 'No active project' }
    setSaving(true)
    try {
      let reportId = existingId

      const reportPayload = {
        project_id:          projectId,
        submitted_by:        user.id,
        report_date:         reportData.report_date,
        trade:               reportData.trade    || null,
        temp_high:           reportData.temp_high ?? null,
        temp_low:            reportData.temp_low  ?? null,
        weather_condition:   reportData.weather_condition || null,
        site_conditions:     reportData.site_conditions  || null,
        work_performed:      reportData.work_performed   || null,
        safety_observations: reportData.safety_observations || null,
        has_safety_incident: reportData.has_safety_incident ?? false,
        notes:               reportData.notes || null,
        signed_name:         reportData.signed_name || null,
        signed_at:           reportData.signed_name ? new Date().toISOString() : null,
      }

      if (existingId) {
        const { error: updateErr } = await supabase
          .from('daily_reports').update(reportPayload).eq('id', existingId)
        if (updateErr) throw updateErr
      } else {
        const { data, error: insertErr } = await supabase
          .from('daily_reports').insert(reportPayload).select('id').single()
        if (insertErr) throw insertErr
        reportId = data.id
      }

      if (!reportId) throw new Error('Report ID missing')

      // Replace child records — delete then re-insert
      await Promise.all([
        supabase.from('daily_report_manpower').delete().eq('report_id', reportId),
        supabase.from('daily_report_equipment').delete().eq('report_id', reportId),
        supabase.from('daily_report_deliveries').delete().eq('report_id', reportId),
        supabase.from('daily_report_photos').delete().eq('report_id', reportId),
      ])

      const inserts: Promise<any>[] = []

      if (manpower.filter(r => r.trade.trim()).length > 0) {
        inserts.push(supabase.from('daily_report_manpower').insert(
          manpower.filter(r => r.trade.trim()).map(r => ({
            report_id:    reportId,
            trade:        r.trade,
            foreman_name: r.foreman_name || null,
            worker_count: r.worker_count ?? 0,
            hours_worked: r.hours_worked ?? null,
          }))
        ))
      }

      if (equipment.filter(r => r.equipment_type.trim()).length > 0) {
        inserts.push(supabase.from('daily_report_equipment').insert(
          equipment.filter(r => r.equipment_type.trim()).map(r => ({
            report_id:      reportId,
            equipment_type: r.equipment_type,
            unit_id:        r.unit_id || null,
            hours_used:     r.hours_used ?? null,
          }))
        ))
      }

      if (deliveries.filter(r => r.material.trim()).length > 0) {
        inserts.push(supabase.from('daily_report_deliveries').insert(
          deliveries.filter(r => r.material.trim()).map(r => ({
            report_id:    reportId,
            material:     r.material,
            supplier:     r.supplier     || null,
            quantity:     r.quantity     || null,
            po_reference: r.po_reference || null,
          }))
        ))
      }

      if (photos.filter(r => r.dropbox_path.trim()).length > 0) {
        inserts.push(supabase.from('daily_report_photos').insert(
          photos.filter(r => r.dropbox_path.trim()).map((r, i) => ({
            report_id:    reportId,
            dropbox_path: r.dropbox_path,
            caption:      r.caption || null,
            sort_order:   i,
            uploaded_by:  user.id,
          }))
        ))
      }

      await Promise.all(inserts)

      await supabase.from('activity_log').insert({
        project_id: projectId, user_id: user.id,
        module: 'daily_report',
        record_label: `Report ${reportData.report_date}`,
        action: existingId ? 'updated' : 'submitted',
      })

      await fetchReports()
      return { error: null, id: reportId }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to save report' }
    } finally {
      setSaving(false)
    }
  }, [projectId, user, fetchReports])

  return {
    reports: filtered, allReports: reports, allTrades,
    loading, saving, error,
    filters, setFilters,
    fetchReports, fetchFullReport, saveReport,
  }
}
