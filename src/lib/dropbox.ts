// ─── Dropbox API Service ─────────────────────────────────────────────────────

const DROPBOX_API = 'https://api.dropboxapi.com/2'
const DROPBOX_CONTENT_API = 'https://content.dropboxapi.com/2'

function getToken(): string {
  return import.meta.env.VITE_DROPBOX_ACCESS_TOKEN ?? ''
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DropboxEntry {
  '.tag': 'file' | 'folder'
  id: string
  name: string
  path_lower: string
  path_display: string
  size?: number
  client_modified?: string
  server_modified?: string
}

export interface DropboxUploadResult {
  id: string
  name: string
  path_display: string
  size: number
}

export function projectFolderPath(projectName: string): string {
  const safe = projectName.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim()
  return `/FieldStack/${safe}`
}

export const FOLDER_CATEGORIES = [
  { key: 'Drawings',     label: 'Drawings',         icon: '📐' },
  { key: 'Submittals',   label: 'Submittals',        icon: '📦' },
  { key: 'RFIs',         label: 'RFIs',              icon: 'ℹ️'  },
  { key: 'DailyReports', label: 'Daily Reports',     icon: '📝' },
  { key: 'Photos',       label: 'Photos',            icon: '📸' },
  { key: 'Contracts',    label: 'Contracts & Legal', icon: '📋' },
  { key: 'Specs',        label: 'Specifications',    icon: '📄' },
  { key: 'General',      label: 'General',           icon: '🗂️' },
] as const

export type FolderCategory = typeof FOLDER_CATEGORIES[number]['key']

export async function createProjectFolders(projectName: string): Promise<{ error: string | null }> {
  const base = projectFolderPath(projectName)
  const folders = FOLDER_CATEGORIES.map(c => `${base}/${c.key}`)
  try {
    await fetch(`${DROPBOX_API}/files/create_folder_batch`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ paths: folders, autorename: false }),
    })
    return { error: null }
  } catch (err: any) {
    return { error: err.message ?? 'Failed to create folders' }
  }
}

export async function listFolder(path: string): Promise<{ entries: DropboxEntry[]; error: string | null }> {
  try {
    const res = await fetch(`${DROPBOX_API}/files/list_folder`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ path, recursive: false, limit: 200 }),
    })
    if (!res.ok) throw new Error(`Dropbox error: ${res.status}`)
    const data = await res.json()
    return { entries: data.entries ?? [], error: null }
  } catch (err: any) {
    return { entries: [], error: err.message ?? 'Failed to list folder' }
  }
}

export async function uploadFile(
  file: File,
  destinationPath: string,
  onProgress?: (pct: number) => void
): Promise<{ result: DropboxUploadResult | null; error: string | null }> {
  try {
    const res = await fetch(`${DROPBOX_CONTENT_API}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: destinationPath,
          mode: 'add',
          autorename: true,
          mute: false,
        }),
      },
      body: file,
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err?.error_summary ?? `Upload failed: ${res.status}`)
    }
    const data = await res.json()
    onProgress?.(100)
    return { result: data, error: null }
  } catch (err: any) {
    return { result: null, error: err.message ?? 'Upload failed' }
  }
}

export async function getSharedLink(path: string): Promise<{ url: string | null; error: string | null }> {
  try {
    const res = await fetch(`${DROPBOX_API}/sharing/create_shared_link_with_settings`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        path,
        settings: { requested_visibility: 'public', access: 'viewer' },
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const url = data.url?.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '')
      return { url, error: null }
    }
    const errData = await res.json()
    const existing = errData?.error?.shared_link_already_exists?.metadata?.url
    if (existing) {
      const url = existing.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '')
      return { url, error: null }
    }
    return { url: null, error: 'Could not get shared link' }
  } catch (err: any) {
    return { url: null, error: err.message ?? 'Failed to get link' }
  }
}

export async function deleteFile(path: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${DROPBOX_API}/files/delete_v2`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ path }),
    })
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
    return { error: null }
  } catch (err: any) {
    return { error: err.message ?? 'Delete failed' }
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export function fileTypeInfo(name: string): { ext: string; color: string; isPreviewable: boolean } {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, { color: string; isPreviewable: boolean }> = {
    pdf:  { color: '#dc2626', isPreviewable: true  },
    jpg:  { color: '#2d9e5f', isPreviewable: true  },
    jpeg: { color: '#2d9e5f', isPreviewable: true  },
    png:  { color: '#2d9e5f', isPreviewable: true  },
    gif:  { color: '#2d9e5f', isPreviewable: true  },
    webp: { color: '#2d9e5f', isPreviewable: true  },
    dwg:  { color: '#e8611a', isPreviewable: false },
    xlsx: { color: '#166534', isPreviewable: false },
    docx: { color: '#2d6fd4', isPreviewable: false },
    zip:  { color: '#6b7280', isPreviewable: false },
  }
  return { ext: ext.toUpperCase(), ...(map[ext] ?? { color: '#6b7280', isPreviewable: false }) }
}