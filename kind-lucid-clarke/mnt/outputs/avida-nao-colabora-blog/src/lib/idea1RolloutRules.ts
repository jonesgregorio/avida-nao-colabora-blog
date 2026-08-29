export interface Idea1RolloutSettings {
  enabled: boolean
  percentage: number
}

export const DEFAULT_IDEA1_ROLLOUT_SETTINGS: Idea1RolloutSettings = {
  enabled: true,
  percentage: 100,
}

export function normalizeIdea1RolloutSettings(value: unknown): Idea1RolloutSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_IDEA1_ROLLOUT_SETTINGS }

  const candidate = value as Record<string, unknown>
  const rawPercentage = typeof candidate.percentage === 'number'
    ? candidate.percentage
    : Number(candidate.percentage)
  const percentage = Number.isFinite(rawPercentage)
    ? Math.max(0, Math.min(100, Math.round(rawPercentage)))
    : DEFAULT_IDEA1_ROLLOUT_SETTINGS.percentage

  return {
    enabled: typeof candidate.enabled === 'boolean'
      ? candidate.enabled
      : DEFAULT_IDEA1_ROLLOUT_SETTINGS.enabled,
    percentage,
  }
}

export function extractIdea1RolloutSettings(config: unknown): Idea1RolloutSettings {
  if (!config || typeof config !== 'object') return { ...DEFAULT_IDEA1_ROLLOUT_SETTINGS }
  return normalizeIdea1RolloutSettings((config as Record<string, unknown>).idea1_rollout)
}

/**
 * FNV-1a de 32 bits reduzido para 100 buckets estáveis.
 * O mesmo usuário permanece no mesmo grupo entre sessões/deploys; não há sorteio
 * por renderização, horário ou conteúdo emocional.
 */
export function stableIdea1RolloutBucket(userId: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % 100
}

export function isIdea1RolloutEnabledForUser(
  userId: string,
  settings: Idea1RolloutSettings,
): boolean {
  const normalized = normalizeIdea1RolloutSettings(settings)
  if (!normalized.enabled || normalized.percentage <= 0) return false
  if (normalized.percentage >= 100) return true
  if (!userId) return true
  return stableIdea1RolloutBucket(userId) < normalized.percentage
}
