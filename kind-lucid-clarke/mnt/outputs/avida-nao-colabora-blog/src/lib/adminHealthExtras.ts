import { supabase } from './supabase'
import type { HealthCheckResult } from './systemHealth'

const TIMEOUT_MS = 5000

async function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms)),
  ])
}

/**
 * Verificação não destrutiva do Supabase Storage.
 * Lista no máximo 1 objeto do bucket público `media`; não cria nem remove arquivo.
 * Uma falha de permissão/bucket é reportada como erro, nunca convertida em "OK".
 */
export async function checkStorage(): Promise<HealthCheckResult> {
  const startedAt = Date.now()
  try {
    const result = await withTimeout(
      Promise.resolve(supabase.storage.from('media').list('', { limit: 1, sortBy: { column: 'name', order: 'asc' } })),
    )
    const ms = Date.now() - startedAt
    if (result.error) {
      return {
        checkKey: 'storage_media',
        checkName: 'Storage de mídia',
        category: 'storage',
        status: 'error',
        errorMessage: result.error.message,
        responseTimeMs: ms,
        severity: 'high',
        details: { bucket: 'media', operation: 'list', destructive: false },
      }
    }
    return {
      checkKey: 'storage_media',
      checkName: 'Storage de mídia',
      category: 'storage',
      status: ms > 3000 ? 'warning' : 'ok',
      responseTimeMs: ms,
      severity: ms > 3000 ? 'medium' : 'info',
      details: { bucket: 'media', operation: 'list', objectsVisible: result.data?.length ?? 0, destructive: false },
    }
  } catch (error) {
    return {
      checkKey: 'storage_media',
      checkName: 'Storage de mídia',
      category: 'storage',
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
      responseTimeMs: Date.now() - startedAt,
      severity: 'high',
      details: { bucket: 'media', operation: 'list', destructive: false },
    }
  }
}
