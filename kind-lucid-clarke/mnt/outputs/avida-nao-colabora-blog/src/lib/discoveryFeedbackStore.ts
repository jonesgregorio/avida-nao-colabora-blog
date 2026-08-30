import { supabase } from './supabase'
import {
  DISCOVERY_FEEDBACK_VALUES,
  type DiscoveryFeedbackMap,
  type DiscoveryFeedbackValue,
} from './discoveryFeedback'

// IO da tabela user_discovery_feedback (Fase 19R.2). RLS garante "só o dono".
// A chave é a stableKey da descoberta (tipo + assunto, sem contagem de dias),
// então o feedback sobrevive quando a pessoa registra mais.

interface FeedbackRow {
  discovery_key: string
  feedback: DiscoveryFeedbackValue
}

/** Percepções já registradas pela pessoa, por chave estável de descoberta. */
export async function fetchDiscoveryFeedback(userId: string | null | undefined): Promise<DiscoveryFeedbackMap> {
  if (!userId) return {}
  try {
    const { data, error } = await supabase
      .from('user_discovery_feedback')
      .select('discovery_key, feedback')
      .eq('user_id', userId)
    if (error) return {}
    const map: DiscoveryFeedbackMap = {}
    for (const row of (data ?? []) as FeedbackRow[]) {
      if (typeof row.discovery_key === 'string' && DISCOVERY_FEEDBACK_VALUES.has(row.feedback)) {
        map[row.discovery_key] = row.feedback
      }
    }
    return map
  } catch {
    return {}
  }
}

/** Salva (ou troca) a percepção sobre uma descoberta. */
export async function saveDiscoveryFeedback(
  userId: string,
  discoveryKey: string,
  feedback: DiscoveryFeedbackValue,
): Promise<boolean> {
  const { error } = await supabase
    .from('user_discovery_feedback')
    .upsert({ user_id: userId, discovery_key: discoveryKey, feedback }, { onConflict: 'user_id,discovery_key' })
  return !error
}

/** Remove a percepção — volta a descoberta ao estado neutro. */
export async function clearDiscoveryFeedback(userId: string, discoveryKey: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_discovery_feedback')
    .delete()
    .eq('user_id', userId)
    .eq('discovery_key', discoveryKey)
  return !error
}
