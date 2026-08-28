export const SUPPORT_CATEGORIES = [
  'Uso do site',
  'Problema técnico',
  'Conta e acesso',
  'Planos e assinatura',
  'Pagamento',
  'Privacidade e dados',
  'Sugestão de melhoria',
  'Outro',
] as const

export type SupportCategory = typeof SUPPORT_CATEGORIES[number]

export const DEFAULT_SUPPORT_CATEGORY: SupportCategory = SUPPORT_CATEGORIES[0]

export function isSupportCategory(value: unknown): value is SupportCategory {
  return typeof value === 'string' && SUPPORT_CATEGORIES.includes(value as SupportCategory)
}
