import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { uploadFile, getSharedLink, projectFolderPath } from '../lib/dropbox'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrawingDiscipline =
  | 'architectural' | 'structural' | 'civil'
  | 'mechanical' | 'electrical' | 'plumbing'
  | 'landscape' | 'other'

export type IssueType =
  | 'cd' | 'permit' | 'construction' | 'asi' | 'bulletin' | 'for_review' | 'other'

export interface Drawing {
  id: string
  project_id: string
  sheet_number: string
  sheet_name: string
  discipline: DrawingDiscipline
  current_version: number
  dropbox_folder: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // latest version info joined
  latest_dropbox_path: string | null
  latest_dropbox_url: string | null
  latest_revision_label: string | null
  latest_issue_type: IssueType | null
  latest_issued_date: string | null
  latest_version_id: string | null
}

export interface DrawingVersion {
  id: string
  drawing_id: string
  version_number: number
  revision_label: string | null
  issue_type: IssueType
  issued_date: string | null
  dropbox_path: string
  dropbox_url: string | null
  file_name: string | null
  file_size_bytes: number | null
  uploaded_by: string | null
  uploaded_by_name: string | null
  created_at: string
}

export interface CreateDrawingPayload {
  sheet_number: string
  sheet_name: string
  discipline: DrawingDiscipline
  file: File
  revision_label: string
  issue_type: IssueType
  issued_date: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DISCIPLINE_META: Record<DrawingDiscipline, { label: string; abbr: string; color: string; bg: string }> = {
  architectural: { label: 'Architectural', abbr: 'A',  color: '#e8611a', bg: '#fef3ec' },
  structural:    { label: 'Structural',    abbr: 'S',  color: '#2d6fd4', bg: '#eff6ff' },
  civil:         { label: 'Civil',         abbr: 'C',  color: '#166534', bg: '#f0fdf4' },
  mechanical:    { label: 'Mechanical',    abbr: 'M',  color: '#ca8a04', bg: '#fefce8' },
  electrical:    { label: 'Electrical',    abbr: 'E',  color: '#7c3aed', bg: '#f5f3ff' },
  plumbing:      { label: 'Plumbing',      abbr: 'P',  color: '#0891b2', bg: '#ecfeff' },
  landscape:     { label: 'Landscape',     abbr: 'L',  color: '#15803d', bg: '#f0fdf4' },
  other:         { label: 'Other',         abbr: 'O',  color: '#6b7280', bg: '#f3f4f6' },
}

export const ISSUE_TYPE_META: Record<IssueType, { label: string; color: string }> = {
  cd:           { label: 'Construction Documents', color: '#374151' },
  permit:       { label: 'Permit Set',             color: '#2d6fd4' },
  construction: { label: 'For Construction',       color: '#2d9e5f' },
  asi:          { label: 'ASI',                    color: '#e8611a' },
  bulletin:     { label: 'Bulletin',               color: '#8b5cf6' },
  for_review:   { label: 'For Review',             color: '#ca8a04' },
  other:        { label: 'Other',                  color: '#6b7280' },
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDrawings() {
  const { activeProject, user } = useAuth()
  const projectId = activeProject?.project.id

  const [drawings,   setDrawings]   = useState<Drawing[]>([])
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [uploadPct,  setUploadPct]  = useState(0)
  const [error,      setError]      = useState<string | null>(null)
  const [discipline, setDiscipline] = useState<DrawingDiscipline | 'all'>('all')
  const [searchStr,  setSearchStr]  = useState('')

  // ── Fetch drawings with latest version joined ────────────────────────────

  const fetchDrawings = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      // Get all drawings
      const { data: drawingData, error: drawErr } = await supabase
        .from('drawings')
        .select('*')
        .eq('project_id', projectId)
        .order('sheet_number', { ascending: true })

      if (drawErr) throw drawErr
      if (!drawingData || drawingData.length === 0) {
        setDrawings([]); setLoading(false); return
      }

      // Get latest version for each drawing
      const drawingIds = drawingData.map((d: any) => d.id)
      const { data: versionData, error: verErr } = await supabase
        .from('drawing_versions')
        .select('*, uploader:user_profiles!uploaded_by(full_name)')
        .in('drawing_id', drawingIds)
        .order('version_number', { ascending: false })

      if (verErr) throw verErr

      // Map latest version onto each drawing
      const latestByDrawing: Record<string, any> = {}
      ;(versionData ?? []).forEach((v: any) => {
        if (!latestByDrawing[v.drawing_id]) latestByDrawing[v.drawing_id] = v
      })

      const mapped: Drawing[] = drawingData.map((d: any) => {
        const latest = latestByDrawing[d.id]
        return {
          ...d,
          latest_dropbox_path:   latest?.dropbox_path   ?? null,
          latest_dropbox_url:    latest?.dropbox_url     ?? null,
          latest_revision_label: latest?.revision_label  ?? null,
          latest_issue_type:     latest?.issue_type      ?? null,
          latest_issued_date:    latest?.issued_date      ?? null,
          latest_version_id:     latest?.id               ?? null,
        }
      })

      setDrawings(mapped)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load drawings')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchDrawings() }, [fetchDrawings])

  // ── Derived ──────────────────────────────────────────────────────────────

  const disciplines = [...new Set(drawings.map(d => d.discipline))] as DrawingDiscipline[]

  const disciplineCounts = drawings.reduce((acc, d) => {
    acc[d.discipline] = (acc[d.discipline] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filtered = drawings.filter(d => {
    if (discipline !== 'all' && d.discipline !== discipline) return false
    if (searchStr.trim()) {
      const q = searchStr.toLowerCase()
      if (
        !d.sheet_number.toLowerCase().includes(q) &&
        !d.sheet_name.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // ── Fetch versions for a single drawing ──────────────────────────────────

  const fetchVersions = useCallback(async (drawingId: string): Promise<DrawingVersion[]> => {
    const { data, error: err } = await supabase
      .from('drawing_versions')
      .select('*, uploader:user_profiles!uploaded_by(full_name)')
      .eq('drawing_id', drawingId)
      .order('version_number', { ascending: false })

    if (err) return []
    return (data ?? []).map((v: any) => ({
      ...v,
      uploaded_by_name: v.uploader?.full_name ?? null,
      dropbox_url: v.dropbox_url ?? null,
    }))
  }, [])

  // ── Upload new drawing (creates drawing + version 1) ─────────────────────

  const createDrawing = useCallback(async (
    payload: CreateDrawingPayload
  ): Promise<{ error: string | null; id?: string }> => {
    if (!projectId || !user || !activeProject) return { error: 'No active project' }

    // Validate sheet number unique
    const existing = drawings.find(
      d => d.sheet_number.toLowerCase() === payload.sheet_number.toLowerCase()
    )
    if (existing) return { error: `Sheet number ${payload.sheet_number} already exists.` }

    setUploading(true); setUploadPct(0); setError(null)
    try {
      const base = projectFolderPath(activeProject.project.name)
      const dest = `${base}/Drawings/${payload.sheet_number}_${payload.file.name}`

      const { result, error: upErr } = await uploadFile(
        payload.file, dest, p => setUploadPct(p)
      )
      if (upErr || !result) throw new Error(upErr ?? 'Upload failed')

      const { url } = await getSharedLink(result.path_display)

      // Create drawing record
      const { data: drawingRecord, error: drawErr } = await supabase
        .from('drawings')
        .insert({
          project_id:      projectId,
          sheet_number:    payload.sheet_number.trim().toUpperCase(),
          sheet_name:      payload.sheet_name.trim(),
          discipline:      payload.discipline,
          current_version: 1,
          dropbox_folder:  `${base}/Drawings`,
          created_by:      user.id,
        })
        .select('id')
        .single()

      if (drawErr) throw drawErr

      // Create version 1
      const { error: verErr } = await supabase
        .from('drawing_versions')
        .insert({
          drawing_id:      drawingRecord.id,
          version_number:  1,
          revision_label:  payload.revision_label  || null,
          issue_type:      payload.issue_type,
          issued_date:     payload.issued_date      || null,
          dropbox_path:    result.path_display,
          dropbox_url:     url,
          file_name:       result.name,
          file_size_bytes: result.size,
          uploaded_by:     user.id,
        })

      if (verErr) throw verErr

      await supabase.from('activity_log').insert({
        project_id: projectId, user_id: user.id,
        module: 'drawing',
        record_label: payload.sheet_number,
        action: 'uploaded Rev 1',
      })

      await fetchDrawings()
      return { error: null, id: drawingRecord.id }
    } catch (err: any) {
      setError(err.message ?? 'Failed to create drawing')
      return { error: err.message ?? 'Failed to create drawing' }
    } finally {
      setUploading(false); setUploadPct(0)
    }
  }, [projectId, user, activeProject, drawings, fetchDrawings])

  // ── Upload new version of existing drawing ────────────────────────────────

  const addVersion = useCallback(async (
    drawing: Drawing,
    file: File,
    revisionLabel: string,
    issueType: IssueType,
    issuedDate: string,
  ): Promise<{ error: string | null }> => {
    if (!projectId || !user || !activeProject) return { error: 'No active project' }
    setUploading(true); setUploadPct(0)
    try {
      const nextVer = drawing.current_version + 1
      const base    = projectFolderPath(activeProject.project.name)
      const dest    = `${base}/Drawings/${drawing.sheet_number}_v${nextVer}_${file.name}`

      const { result, error: upErr } = await uploadFile(
        file, dest, p => setUploadPct(p)
      )
      if (upErr || !result) throw new Error(upErr ?? 'Upload failed')

      const { url } = await getSharedLink(result.path_display)

      // Insert new version
      const { error: verErr } = await supabase
        .from('drawing_versions')
        .insert({
          drawing_id:      drawing.id,
          version_number:  nextVer,
          revision_label:  revisionLabel  || null,
          issue_type:      issueType,
          issued_date:     issuedDate      || null,
          dropbox_path:    result.path_display,
          dropbox_url:     url,
          file_name:       result.name,
          file_size_bytes: result.size,
          uploaded_by:     user.id,
        })
      if (verErr) throw verErr

      // Update drawing current_version
      const { error: drawErr } = await supabase
        .from('drawings')
        .update({ current_version: nextVer })
        .eq('id', drawing.id)
      if (drawErr) throw drawErr

      await supabase.from('activity_log').insert({
        project_id: projectId, user_id: user.id,
        module: 'drawing',
        record_label: drawing.sheet_number,
        action: `uploaded Rev ${nextVer} (${revisionLabel || issueType})`,
      })

      await fetchDrawings()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to add version' }
    } finally {
      setUploading(false); setUploadPct(0)
    }
  }, [projectId, user, activeProject, fetchDrawings])

  return {
    drawings: filtered, allDrawings: drawings,
    disciplines, disciplineCounts,
    loading, uploading, uploadPct, error,
    searchStr, setSearchStr, discipline, setDiscipline,
    fetchDrawings, fetchVersions, createDrawing, addVersion,
  }
}
