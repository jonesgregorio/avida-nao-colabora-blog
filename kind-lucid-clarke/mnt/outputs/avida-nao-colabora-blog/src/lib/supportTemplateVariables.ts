import type { PlanPricingMap } from './planPricing'

export const SUPPORT_TEMPLATE_PRICE_PLACEHOLDERS = {
  essential: '{{preco_essential}}',
  plus: '{{preco_plus}}',
} as const

/**
 * Resolve variáveis comerciais somente quando a resposta pronta é aplicada.
 * Assim o texto reutilizável nunca congela o preço do catálogo.
 *
 * As duas substituições de legado mantêm compatibilidade com templates já
 * persistidos antes da adoção dos placeholders; novos templates devem usar
 * exclusivamente {{preco_essential}} / {{preco_plus}}.
 */
export function resolveSupportTemplateVariables(body: string, pricing: PlanPricingMap): string {
  return body
    .replaceAll(SUPPORT_TEMPLATE_PRICE_PLACEHOLDERS.essential, pricing.essential.display)
    .replaceAll(SUPPORT_TEMPLATE_PRICE_PLACEHOLDERS.plus, pricing.plus.display)
    .replaceAll('R$ 19,90', pricing.essential.display)
    .replaceAll('R$ 39,90', pricing.plus.display)
}
