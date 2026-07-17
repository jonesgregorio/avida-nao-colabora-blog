// ============================================================================
// Motivos de cancelamento/downgrade — lista OFICIAL e fechada.
// ============================================================================
// Os slugs são estáveis e usados como chave em três lugares que precisam
// concordar: este arquivo (UI), a validação no manage-subscription (Deno não
// importa daqui) e o CHECK da migration 094. Mexer em um exige mexer nos três.
// Não criar motivo fora desta lista.
// ============================================================================

export type ReasonSlug =
  | 'financial'
  | 'bugs'
  | 'missing_feature'
  | 'content_not_expected'
  | 'chose_competitor'
  | 'did_not_understand_features'
  | 'other'

export const REASON_LABELS: Record<ReasonSlug, string> = {
  financial: 'Financeiro',
  bugs: 'Erros ou bugs',
  missing_feature: 'Falta de funcionalidade',
  content_not_expected: 'Conteúdo não atendeu às expectativas',
  chose_competitor: 'Preferi outro serviço',
  did_not_understand_features: 'Não entendi bem os recursos do plano',
  other: 'Outro motivo',
}

// Ordem de exibição na modal.
export const REASON_OPTIONS: ReasonSlug[] = [
  'financial',
  'bugs',
  'missing_feature',
  'content_not_expected',
  'chose_competitor',
  'did_not_understand_features',
  'other',
]

export const reasonLabel = (slug: string): string =>
  REASON_LABELS[slug as ReasonSlug] ?? slug

/** Rótulos separados por vírgula: "Financeiro, Falta de funcionalidade". */
export const reasonsLabel = (slugs: string[] | null | undefined): string =>
  (slugs ?? []).map(reasonLabel).join(', ')

/**
 * Mesma regra do back-end (§9): pelo menos um motivo, e "Outro motivo" exige
 * comentário. Devolve a mensagem de erro ou null quando está válido.
 */
export function validateReasons(reasons: string[], comment: string): string | null {
  if (reasons.length === 0) return 'Selecione pelo menos um motivo para continuar.'
  const foraDaLista = reasons.filter((r) => !REASON_OPTIONS.includes(r as ReasonSlug))
  if (foraDaLista.length > 0) return `Motivo inválido: ${foraDaLista.join(', ')}`
  if (reasons.includes('other') && !comment.trim()) return 'Descreva o outro motivo para continuar.'
  return null
}
