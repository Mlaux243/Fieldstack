import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnnotationType = 'pen' | 'arrow' | 'text' | 'rect' | 'cloud' | 'pin'
export type LinkedModule   = 'rfi' | 'punch_item' | null

export interface Point { x: number; y: number }

export interface PenData    { points: Point[]; color: string; weight: number }
export interface ArrowData  { from: Point; to: Point; color: string; weight: number }
export interface TextData   { origin: Point; text: string; color: string; fontSize: number }
export interface RectData   { from: Point; to: Point; color: string; weight: number; style: 'rect' | 'cloud' }
export interface PinData    { center: Point; number: number; color: string }

export type AnnotationData = PenData | ArrowData | TextData | RectData | PinData

export interface Annotation {
  id: string
  layer_id: string
  drawing_version_id: string
  type: AnnotationType
  data: AnnotationData
  pin_number: number | null
  linked_module: LinkedModule
  linked_record_id: string | null
  linked_record_label: string | null   // e.g. "RFI-003"
  photo_dropbox_path: string | null
  created_by: string | null
  created_at: string
}

export interface AnnotationLayer {
  id: string
  drawing_version_id: string
  name: string
  role_scope: string | null
  user_id: string | null
  is_visible: boolean
}

export interface MarkupSet {
  id: string
  drawing_version_id: string
  name: string
  description: string | null
  layer_ids: string[]
  created_by: string | null
  created_at: string
}

// ─── Tool state ───────────────────────────────────────────────────────────────

export type Tool = 'select' | 'pen' | 'arrow' | 'text' | 'rect' | 'cloud' | 'pin'

export interface ToolState {
  active: Tool
  color: string
  weight: number
  fontSize: number
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnnotations(drawingVersionId: string | null) {
  const { user, activeRole } = useAuth()

  const [layers,      setLayers]      = useState<AnnotationLayer[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [markupSets,  setMarkupSets]  = useState<MarkupSet[]>([])
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const [toolState, setToolState] = useState<ToolState>({
    active: 'select', color: '#e8611a', weight: 2, fontSize: 14,
  })

  // ── Fetch layers + annotations ───────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!drawingVersionId || !user) return
    setLoading(true); setError(null)
    try {
      const [layerRes, annoRes, setRes] = await Promise.all([
        supabase.from('annotation_layers')
          .select('*')
          .eq('drawing_version_id', drawingVersionId)
          .order('created_at'),

        supabase.from('annotations')
          .select('*')
          .eq('drawing_version_id', drawingVersionId)
          .order('created_at'),

        supabase.from('markup_sets')
          .select('*')
          .eq('drawing_version_id', drawingVersionId)
          .order('created_at'),
      ])

      if (layerRes.error) throw layerRes.error
      if (annoRes.error)  throw annoRes.error

      setLayers(layerRes.data ?? [])
      setAnnotations((annoRes.data ?? []).map((a: any) => ({
        ...a,
        data: typeof a.data === 'string' ? JSON.parse(a.data) : a.data,
      })))
      setMarkupSets(setRes.data ?? [])
    } catch (err: any) {
      setError(err.message ?? 'Failed to load annotations')
    } finally {
      setLoading(false)
    }
  }, [drawingVersionId, user])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Ensure user has a personal layer ────────────────────────────────────

  const ensureUserLayer = useCallback(async (): Promise<string | null> => {
    if (!drawingVersionId || !user) return null

    // Check if user already has a layer for this version
    const existing = layers.find(l => l.user_id === user.id)
    if (existing) return existing.id

    // Create one
    const roleLabel = activeRole === 'gc_admin'  ? 'GC Admin'
      : activeRole === 'gc_field'                ? 'GC Field'
      : activeRole === 'architect'               ? 'A/E'
      : activeRole === 'owner'                   ? 'Owner'
      : 'Sub'

    const { data, error: insertErr } = await supabase
      .from('annotation_layers')
      .insert({
        drawing_version_id: drawingVersionId,
        name:               `${roleLabel} Layer`,
        role_scope:         activeRole,
        user_id:            user.id,
        is_visible:         true,
      })
      .select('id')
      .single()

    if (insertErr || !data) return null

    await fetchAll()
    return data.id
  }, [drawingVersionId, user, activeRole, layers, fetchAll])

  // ── Save annotation ──────────────────────────────────────────────────────

  const saveAnnotation = useCallback(async (
    type: AnnotationType,
    data: AnnotationData,
    pinNumber?: number,
    linkedModule?: LinkedModule,
    linkedRecordId?: string,
    linkedRecordLabel?: string,
  ): Promise<{ error: string | null; id?: string }> => {
    if (!drawingVersionId) return { error: 'No drawing version' }
    setSaving(true)
    try {
      const layerId = await ensureUserLayer()
      if (!layerId) throw new Error('Could not get annotation layer')

      const { data: inserted, error: insertErr } = await supabase
        .from('annotations')
        .insert({
          layer_id:            layerId,
          drawing_version_id:  drawingVersionId,
          type,
          data:                JSON.stringify(data),
          pin_number:          pinNumber   ?? null,
          linked_module:       linkedModule ?? null,
          linked_record_id:    linkedRecordId   ?? null,
          created_by:          user?.id,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr

      // Refetch to get linked labels etc.
      await fetchAll()
      return { error: null, id: inserted?.id }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to save annotation' }
    } finally {
      setSaving(false)
    }
  }, [drawingVersionId, user, ensureUserLayer, fetchAll])

  // ── Delete annotation ────────────────────────────────────────────────────

  const deleteAnnotation = useCallback(async (id: string): Promise<{ error: string | null }> => {
    try {
      const { error: deleteErr } = await supabase
        .from('annotations').delete().eq('id', id)
      if (deleteErr) throw deleteErr
      setAnnotations(prev => prev.filter(a => a.id !== id))
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to delete' }
    }
  }, [])

  // ── Toggle layer visibility ──────────────────────────────────────────────

  const toggleLayer = useCallback((layerId: string) => {
    setLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, is_visible: !l.is_visible } : l
    ))
    // Persist visibility (fire and forget)
    supabase.from('annotation_layers')
      .update({ is_visible: !layers.find(l => l.id === layerId)?.is_visible })
      .eq('id', layerId)
  }, [layers])

  // ── Save markup set ──────────────────────────────────────────────────────

  const saveMarkupSet = useCallback(async (
    name: string, description: string
  ): Promise<{ error: string | null }> => {
    if (!drawingVersionId || !user) return { error: 'No context' }
    const visibleLayerIds = layers.filter(l => l.is_visible).map(l => l.id)
    try {
      const { error: insertErr } = await supabase.from('markup_sets').insert({
        drawing_version_id: drawingVersionId,
        name,
        description: description || null,
        layer_ids:   visibleLayerIds,
        created_by:  user.id,
      })
      if (insertErr) throw insertErr
      await fetchAll()
      return { error: null }
    } catch (err: any) {
      return { error: err.message ?? 'Failed to save markup set' }
    }
  }, [drawingVersionId, user, layers, fetchAll])

  // ── Visible annotations (respects layer visibility) ──────────────────────

  const visibleAnnotations = annotations.filter(a => {
    const layer = layers.find(l => l.id === a.layer_id)
    return layer?.is_visible !== false
  })

  // ── Next pin number ──────────────────────────────────────────────────────

  const nextPinNumber = Math.max(0, ...annotations
    .filter(a => a.pin_number != null)
    .map(a => a.pin_number!)) + 1

  return {
    layers, annotations: visibleAnnotations, allAnnotations: annotations,
    markupSets, loading, saving, error,
    toolState, setToolState,
    fetchAll, saveAnnotation, deleteAnnotation, toggleLayer,
    saveMarkupSet, nextPinNumber,
  }
}
