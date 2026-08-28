import { supabase } from './supabase'

export const SUPPORT_ATTACHMENTS_BUCKET = 'support-attachments'
export const MAX_SUPPORT_ATTACHMENTS = 3
export const MAX_SUPPORT_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const SUPPORT_ATTACHMENT_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

export interface SupportAttachment {
  name: string
  path: string
  mime_type: string
  size: number
}

export function validateSupportFiles(files: File[]): string | null {
  if (files.length > MAX_SUPPORT_ATTACHMENTS) {
    return `Envie no máximo ${MAX_SUPPORT_ATTACHMENTS} arquivos por mensagem.`
  }
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return 'Use apenas imagens JPG, PNG, WEBP ou arquivos PDF.'
    }
    if (file.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
      return 'Cada anexo pode ter no máximo 5 MB.'
    }
  }
  return null
}

export function appendSupportFiles(current: File[], incoming: File[]): { files: File[]; error: string | null } {
  const merged = [...current, ...incoming]
  const error = validateSupportFiles(merged)
  return error ? { files: current, error } : { files: merged, error: null }
}

function safeFilename(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return (cleaned || 'arquivo').slice(-120)
}

function uniqueObjectName(file: File): string {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  return `${nonce}-${safeFilename(file.name)}`
}

export async function uploadSupportAttachments(ownerUserId: string, ticketId: string, files: File[]): Promise<SupportAttachment[]> {
  const validationError = validateSupportFiles(files)
  if (validationError) throw new Error(validationError)
  if (!files.length) return []

  const uploadedPaths: string[] = []
  const attachments: SupportAttachment[] = []

  try {
    for (const file of files) {
      const path = `${ownerUserId}/${ticketId}/${uniqueObjectName(file)}`
      const { error } = await supabase.storage
        .from(SUPPORT_ATTACHMENTS_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        })
      if (error) throw error
      uploadedPaths.push(path)
      attachments.push({ name: file.name, path, mime_type: file.type, size: file.size })
    }
    return attachments
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from(SUPPORT_ATTACHMENTS_BUCKET).remove(uploadedPaths)
    }
    throw error
  }
}

export async function removeSupportAttachments(attachments: SupportAttachment[]): Promise<void> {
  const paths = attachments.map(item => item.path).filter(Boolean)
  if (!paths.length) return
  await supabase.storage.from(SUPPORT_ATTACHMENTS_BUCKET).remove(paths)
}

export function normalizeSupportAttachments(value: unknown): SupportAttachment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (typeof row.name !== 'string' || typeof row.path !== 'string') return []
    return [{
      name: row.name,
      path: row.path,
      mime_type: typeof row.mime_type === 'string' ? row.mime_type : 'application/octet-stream',
      size: typeof row.size === 'number' && Number.isFinite(row.size) ? row.size : 0,
    }]
  })
}

export function formatSupportAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

export async function downloadSupportAttachment(attachment: SupportAttachment): Promise<void> {
  const { data, error } = await supabase.storage
    .from(SUPPORT_ATTACHMENTS_BUCKET)
    .download(attachment.path)
  if (error || !data) throw error ?? new Error('Arquivo indisponível.')

  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.name
  link.click()
  URL.revokeObjectURL(url)
}
