import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { uploadFile, getSharedLink, deleteFile, projectFolderPath } from '../lib/dropbox'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Photo {
  id: string
  project_id: string
  dropbox_path: string
  dropbox_url: string | null
  caption: string | null
  location_tag: string | null
  trade: string | null
  linked_module: string | null
  linked_record_id: string | null
  taken_at: string
  uploaded_by: string | null
  uploaded_by_name: string | null
  created_at: string
}

export interface UploadPhotoPayload {
  file: File
  caption: string
  location_tag: string
  trade: string
  linked_module: string | null
  linked_record_id: string | null
}

export function usePhotos() {
  const { activeProject, user } = useAuth()
  const projectId = activeProject?.project.id

  const [photos,     setPhotos]    = useState<Photo[]>([])
  const [loading,    setLoading]   = useState(true)
  const [uploading,  setUploading] = useState(false)
  const [uploadPct,  setUploadPct] = useState(0)
  const [deleting,   setDeleting]  = useState<string | null>(null)
  const [error,      setError]     = useState<string | null>(null)
  const [searchStr,  setSearchStr] = useState('')
  const [location,   setLocation]  = useState<string>('all')
  const [trade,      setTrade]     = useState<string>('all')
  const [dateFrom,   setDateFrom]  = useState('')
  const [dateTo,     setDateTo]    = useState('')

  const fetchPhotos = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('photos')
        .select('*, uploader:user_profiles!uploaded_by(full_name)')
        .eq('project_id', projectId)
        .order('taken_at', { ascending: false })
      if (err) throw err
      setPhotos((data ?? []).map((p: any) => ({
        ...p, uploaded_by_name: p.uploader?.full_name ?? null,
      })))
    } catch (err: any) {
      setError(err.message ?? 'Failed to load photos')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchPhotos() }, [fetchPhotos])

  const allLocations = [...new Set(photos.map(p => p.location_tag).filter(Boolean) as string[])].sort()
  const allTrades    = [...new Set(photos.map(p => p.trade).filter(Boolean) as string[])].sort()

  const filtered = photos.filter(p => {
    if (location !== 'all' && p.location_tag !== location) return false
    if (trade    !== 'all' && p.trade         !== trade)   return false
    if (dateFrom && p.taken_at.slice(0,10) < dateFrom)     return false
    if (dateTo   && p.taken_at.slice(0,10) > dateTo)       return false
    if (searchStr.trim()) {
      const q = searchStr.toLowerCase()
      if (
        !(p.caption ?? '').toLowerCase().includes(q) &&
        !(p.location_tag ?? '').toLowerCase().includes(q) &&
        !(p.trade ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const uploadPhoto = useCallback(async (
    payload: UploadPhotoPayload
  ): Promise<{ error: string | null }> => {
    if (!projectId || !user || !activeProject) return { error: 'No active project' }
    setUploading(true); setUploadPct(0); setError(null)
    try {
      const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const safe = payload.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const dest = `${projectFolderPath(activeProject.project.name)}/Photos/${ts}_${safe}`

      const { result, error: upErr } = await uploadFile(payload.file, dest, p => setUploadPct(p))
      if (upErr || !result) throw new Error(upErr ?? 'Upload failed')

      const { url } = await getSharedLink(result.path_display)

      const { error: insertErr } = await supabase.from('photos').insert({
        project_id:       projectId,
        dropbox_path:     result.path_display,
        dropbox_url:      url,
        caption:          payload.caption      || null,
        location_tag:     payload.location_tag || null,
        trade:            payload.trade        || null,
        linked_module:    payload.linked_module    || null,
        linked_record_id: payload.linked_record_id || null,
        taken_at:         new Date().toISOString(),
        uploaded_by:      user.id,
      })
      if (insertErr) throw insertErr

      await supabase.from('activity_log').insert({
        project_id: projectId, user_id: user.id,
        module: 'photo', record_label: payload.caption || result.name, action: 'uploaded',
      })

      await fetchPhotos()
      return { error: null }
    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
      return { error: err.message ?? 'Upload failed' }
    } finally {
      setUploading(false); setUploadPct(0)
    }
  }, [projectId, user, activeProject, fetchPhotos])

  const uploadBatch = useCallback(async (
    files: File[], defaults: Omit<UploadPhotoPayload, 'file'>
  ): Promise<{ uploaded: number; errors: string[] }> => {
    let uploaded = 0; const errors: string[] = []
    for (const file of files) {
      const { error } = await uploadPhoto({ ...defaults, file })
      if (error) errors.push(`${file.name}: ${error}`)
      else uploaded++
    }
    return { uploaded, errors }
  }, [uploadPhoto])

  const deletePhoto = useCallback(async (photo: Photo): Promise<{ error: string | null }> => {
    setDeleting(photo.id)
    try {
      await deleteFile(photo.dropbox_path)
      const { error: deleteErr } = await supabase.from('photos').delete().eq('id', photo.id)
      if (deleteErr) throw deleteErr
      await fetchPhotos()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Delete failed' }
    } finally {
      setDeleting(null)
    }
  }, [fetchPhotos])

  const updatePhoto = useCallback(async (
    id: string, patch: { caption?: string; location_tag?: string; trade?: string }
  ): Promise<{ error: string | null }> => {
    try {
      const { error: updateErr } = await supabase.from('photos').update(patch).eq('id', id)
      if (updateErr) throw updateErr
      await fetchPhotos()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Update failed' }
    }
  }, [fetchPhotos])

  return {
    photos: filtered, allPhotos: photos, allLocations, allTrades,
    loading, uploading, uploadPct, deleting, error,
    searchStr, setSearchStr, location, setLocation,
    trade, setTrade, dateFrom, setDateFrom, dateTo, setDateTo,
    clearFilters: () => { setSearchStr(''); setLocation('all'); setTrade('all'); setDateFrom(''); setDateTo('') },
    fetchPhotos, uploadPhoto, uploadBatch, deletePhoto, updatePhoto,
  }
}
