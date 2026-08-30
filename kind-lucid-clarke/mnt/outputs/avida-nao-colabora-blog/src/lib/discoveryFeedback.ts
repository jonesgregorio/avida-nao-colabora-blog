// Fase 19R.2 — percepção estruturada e reversível sobre uma Descoberta.
// Este arquivo é PURO (sem acesso a rede/banco). O IO fica em discoveryFeedbackStore.ts.
//
// Uma descoberta é um padrão que os PRÓPRIOS registros estruturados da pessoa já
// sustentam. Aqui ela só guarda uma percepção:
//   made_sense    = fez sentido
//   sort_of       = mais ou menos
//   not_following = não quero acompanhar isso (oculta a descoberta; reversível)
// Nunca representa progresso, pontuação, streak ou gamificação.

export const DISCOVERY_FEEDBACK_OPTIONS = [
  { value: 'made_sense', label: 'Fez sentido' },
  { value: 'sort_of', label: 'Mais ou menos' },
  { value: 'not_following', label: 'Não quero acompanhar isso' },
] as const

export type DiscoveryFeedbackValue = typeof DISCOVERY_FEEDBACK_OPTIONS[number]['value']

export type DiscoveryFeedbackMap = Record<string, DiscoveryFeedbackValue>

export const DISCOVERY_FEEDBACK_VALUES = new Set<string>(
  DISCOVERY_FEEDBACK_OPTIONS.map(option => option.value),
)

/** Chaves que a pessoa pediu para não acompanhar — ficam ocultas na área e na Home. */
export function mutedDiscoveryKeys(map: DiscoveryFeedbackMap): Set<string> {
  return new Set(
    Object.entries(map)
      .filter(([, value]) => value === 'not_following')
      .map(([key]) => key),
  )
}
