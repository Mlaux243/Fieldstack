import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  uploadFile, getSharedLink, deleteFile,
  projectFolderPath, formatFileSize,
  type FolderCategory,
} from '../lib/dropbox'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Document {
  id: string
  project_id: string
  name: string
  file_type: string | null
  file_size_bytes: number | null
  file_size_label: string
  dropbox_path: string
  dropbox_url: string | null
  folder_category: FolderCategory
  tags: string[]
  description: string | null
  linked_module: string | null
  linked_record_id: string | null
  uploaded_by: string | null
  uploaded_by_name: string | null
  created_at: string
}

export interface UploadPayload {
  file: File
  folder_category: FolderCategory
  description: string
  tags: string[]
  linked_module: string | null
  linked_record_id: string | null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDocuments() {
  const { activeProject, user } = useAuth()
  const projectId = activeProject?.project.id

  const [documents,  setDocuments]  = useState<Document[]>([])
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [uploadPct,  setUploadPct]  = useState(0)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [searchStr,  setSearchStr]  = useState('')
  const [category,   setCategory]   = useState<FolderCategory | 'all'>('all')
  const [activeTag,  setActiveTag]  = useState<string | 'all'>('all')

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('documents')
        .select('*, uploader:user_profiles!uploaded_by(full_name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (err) throw err

      const mapped: Document[] = (data ?? []).map((d: any) => ({
        ...d,
        file_size_label: d.file_size_bytes ? formatFileSize(d.file_size_bytes) : '—',
        uploaded_by_name: d.uploader?.full_name ?? null,
        tags: d.tags ?? [],
      }))
      setDocuments(mapped)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  // ── Derived ──────────────────────────────────────────────────────────────

  const allTags = [...new Set(documents.flatMap(d => d.tags))].sort()

  const categoryCounts = documents.reduce((acc, d) => {
    acc[d.folder_category] = (acc[d.folder_category] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filtered = documents.filter(d => {
    if (category !== 'all' && d.folder_category !== category) return false
    if (activeTag !== 'all' && !d.tags.includes(activeTag))   return false
    if (searchStr.trim()) {
      const q = searchStr.toLowerCase()
      if (
        !d.name.toLowerCase().includes(q) &&
        !(d.description ?? '').toLowerCase().includes(q) &&
        !d.tags.some(t => t.toLowerCase().includes(q))
      ) return false
    }
    return true
  })

  // ── Upload ───────────────────────────────────────────────────────────────

  const uploadDocument = useCallback(async (
    payload: UploadPayload
  ): Promise<{ error: string | null }> => {
    if (!projectId || !user || !activeProject) return { error: 'No active project' }
    setUploading(true); setUploadPct(0); setError(null)
    try {
      const base = projectFolderPath(activeProject.project.name)
      const dest = `${base}/${payload.folder_category}/${payload.file.name}`

      const { result, error: uploadErr } = await uploadFile(
        payload.file, dest, pct => setUploadPct(pct)
      )
      if (uploadErr) throw new Error(uploadErr)
      if (!result)   throw new Error('Upload returned no result')

      const { url } = await getSharedLink(result.path_display)

      const { error: insertErr } = await supabase.from('documents').insert({
        project_id:       projectId,
        name:             result.name,
        file_type:        payload.file.type || null,
        file_size_bytes:  result.size,
        dropbox_path:     result.path_display,
        dropbox_url:      url,
        folder_category:  payload.folder_category,
        tags:             payload.tags.filter(Boolean),
        description:      payload.description || null,
        linked_module:    payload.linked_module || null,
        linked_record_id: payload.linked_record_id || null,
        uploaded_by:      user.id,
      })
      if (insertErr) throw insertErr

      await supabase.from('activity_log').insert({
        project_id: projectId, user_id: user.id,
        module: 'document', record_label: result.name, action: 'uploaded',
      })

      await fetchDocuments()
      return { error: null }
    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
      return { error: err.message ?? 'Upload failed' }
    } finally {
      setUploading(false); setUploadPct(0)
    }
  }, [projectId, user, activeProject, fetchDocuments])

  // ── Delete ───────────────────────────────────────────────────────────────

  const deleteDocument = useCallback(async (
    doc: Document
  ): Promise<{ error: string | null }> => {
    setDeleting(doc.id)
    try {
      await deleteFile(doc.dropbox_path)
      const { error: deleteErr } = await supabase
        .from('documents').delete().eq('id', doc.id)
      if (deleteErr) throw deleteErr
      await fetchDocuments()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Delete failed' }
    } finally {
      setDeleting(null)
    }
  }, [fetchDocuments])

  // ── Update metadata ──────────────────────────────────────────────────────

  const updateDocument = useCallback(async (
    id: string, patch: { tags?: string[]; description?: string }
  ): Promise<{ error: string | null }> => {
    try {
      const { error: updateErr } = await supabase
        .from('documents').update(patch).eq('id', id)
      if (updateErr) throw updateErr
      await fetchDocuments()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Update failed' }
    }
  }, [fetchDocuments])

  return {
    documents: filtered, allDocuments: documents, allTags, categoryCounts,
    loading, uploading, uploadPct, deleting, error,
    searchStr, setSearchStr, category, setCategory, activeTag, setActiveTag,
    fetchDocuments, uploadDocument, deleteDocument, updateDocument,
  }
}
