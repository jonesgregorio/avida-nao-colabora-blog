import { supabase } from './supabase'
import {
  DEFAULT_IDEA1_ROLLOUT_SETTINGS,
  extractIdea1RolloutSettings,
  isIdea1RolloutEnabledForUser,
  normalizeIdea1RolloutSettings,
  stableIdea1RolloutBucket,
  type Idea1RolloutSettings,
} from './idea1RolloutRules'

export interface Idea1RolloutDecision {
  active: boolean
  bucket: number | null
  settings: Idea1RolloutSettings
}

type AnalyticsSettingsRow = {
  config?: Record<string, unknown> | null
}

export async function fetchIdea1RolloutSettings(): Promise<Idea1RolloutSettings> {
  try {
    const { data, error } = await supabase
      .from('analytics_settings')
      .select('config')
      .eq('id', 1)
      .maybeSingle()

    if (error || !data) return { ...DEFAULT_IDEA1_ROLLOUT_SETTINGS }
    return extractIdea1RolloutSettings((data as AnalyticsSettingsRow).config)
  } catch {
    // Fail-open: indisponibilidade da configuração não remove uma experiência
    // que já está publicada nem esconde algo do usuário por acidente.
    return { ...DEFAULT_IDEA1_ROLLOUT_SETTINGS }
  }
}

export async function fetchIdea1RolloutDecision(userId: string): Promise<Idea1RolloutDecision> {
  const settings = await fetchIdea1RolloutSettings()
  return {
    active: isIdea1RolloutEnabledForUser(userId, settings),
    bucket: userId ? stableIdea1RolloutBucket(userId) : null,
    settings,
  }
}

export async function saveIdea1RolloutSettings(next: Idea1RolloutSettings): Promise<Idea1RolloutSettings> {
  const settings = normalizeIdea1RolloutSettings(next)
  const { data, error: readError } = await supabase
    .from('analytics_settings')
    .select('config')
    .eq('id', 1)
    .single()

  if (readError) throw readError

  const currentConfig = ((data as AnalyticsSettingsRow | null)?.config ?? {}) as Record<string, unknown>
  const config = {
    ...currentConfig,
    idea1_rollout: settings,
  }

  const { error: updateError } = await supabase
    .from('analytics_settings')
    .update({ config, updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (updateError) throw updateError
  return settings
}

export {
  DEFAULT_IDEA1_ROLLOUT_SETTINGS,
  extractIdea1RolloutSettings,
  isIdea1RolloutEnabledForUser,
  normalizeIdea1RolloutSettings,
  stableIdea1RolloutBucket,
}
export type { Idea1RolloutSettings }
