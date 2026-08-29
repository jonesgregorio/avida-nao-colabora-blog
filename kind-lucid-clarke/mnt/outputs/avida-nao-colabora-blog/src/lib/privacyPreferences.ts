import { supabase } from './supabase'

export const DEFAULT_HISTORY_PERSONALIZATION_ENABLED = true

export async function fetchHistoryPersonalizationEnabled(userId?: string | null): Promise<boolean> {
  if (!userId) return false
  const { data, error } = await supabase
    .from('user_privacy_preferences')
    .select('history_personalization_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  // Compatibilidade progressiva: antes da primeira escolha, o comportamento atual
  // do produto permanece ativo. Uma falha transitória também não apaga recursos.
  if (error || !data) return DEFAULT_HISTORY_PERSONALIZATION_ENABLED
  return data.history_personalization_enabled !== false
}

export async function saveHistoryPersonalizationEnabled(userId: string, enabled: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('user_privacy_preferences')
    .upsert({
      user_id: userId,
      history_personalization_enabled: enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  return !error
}
