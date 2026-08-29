import { supabase } from './supabase'
import { trackEvent } from './analytics'

export type RetentionAnalyticsEvent =
  | 'checkin_complete'
  | 'diary_entry'
  | 'diary_pattern_view'
  | 'discovery_view'
  | 'discovery_open'
  | 'weekly_focus_saved'
  | 'weekly_focus_reflected'
  | 'small_action_accepted'
  | 'small_action_completed'

export type RetentionSurface = 'home' | 'diary'
export type RetentionStatus = 'forming' | 'confirmed'
export type RetentionSource = 'history' | 'general'

interface RetentionMetadata {
  surface?: RetentionSurface
  status?: RetentionStatus
  source?: RetentionSource
}

interface RetentionTrackOptions {
  userId?: string | null
  dedupeKey?: string
  metadata?: RetentionMetadata
}

const RETENTION_METADATA_KEYS = new Set(['surface', 'status', 'source'])
const seenRetentionEvents = new Set<string>()

function safeRetentionMetadata(metadata: RetentionMetadata = {}): Record<string, string> {
  const safe: Record<string, string> = { analytics_scope: 'retention' }
  for (const [key, value] of Object.entries(metadata)) {
    if (!RETENTION_METADATA_KEYS.has(key) || typeof value !== 'string') continue
    safe[key] = value
  }
  return safe
}

async function currentUserId(explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

/**
 * Eventos de continuidade usam um contrato menor que o analytics genérico.
 * Só tipo da ação, horário, sessão e três metadados categóricos podem sair daqui.
 * Nunca recebe texto do Diário, humor, intensidade, marcadores, títulos ou respostas.
 */
export function trackRetentionEvent(event: RetentionAnalyticsEvent, options: RetentionTrackOptions = {}): void {
  const localKey = options.dedupeKey ? `${event}:${options.dedupeKey}` : ''
  if (localKey && seenRetentionEvents.has(localKey)) return
  if (localKey) seenRetentionEvents.add(localKey)

  void (async () => {
    const userId = await currentUserId(options.userId)
    if (!userId) return
    trackEvent(event, {
      user_id: userId,
      metadata: safeRetentionMetadata(options.metadata),
    })
  })()
}
