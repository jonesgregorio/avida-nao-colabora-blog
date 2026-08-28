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
function replaceAllCompatible(value: string, search: string, replacement: string): string {
  return value.split(search).join(replacement)
}

export function resolveSupportTemplateVariables(body: string, pricing: PlanPricingMap): string {
  return [
    [SUPPORT_TEMPLATE_PRICE_PLACEHOLDERS.essential, pricing.essential.display],
    [SUPPORT_TEMPLATE_PRICE_PLACEHOLDERS.plus, pricing.plus.display],
    ['R$ 19,90', pricing.essential.display],
    ['R$ 39,90', pricing.plus.display],
  ].reduce((text, [search, replacement]) => replaceAllCompatible(text, search, replacement), body)
}
