// Fonte canônica de preço exibido dos planos — consumida por Home, Pricing,
// Meu Plano e qualquer outra superfície que mostre preço. Lê a mesma RPC
// pública (`get_public_plan_pricing`) que já é a fonte de verdade do banco,
// sincronizada automaticamente a partir do Stripe (ver admin-plan-pricing).
//
// O Stripe continua sendo a fonte final da cobrança real — isto é só a
// camada de EXIBIÇÃO, para impedir que cada tela mostre um valor diferente.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { OFFICIAL_PLANS, PLAN_KEYS, type PlanKey } from './officialPlans'

export interface PlanPriceInfo {
  amount: number // em reais (não centavos), para exibição/cálculo simples
  display: string // ex.: "R$ 19,90"
  currency: string
  // Reflete plan_configs.active: um plano inativo não deve oferecer CTA de
  // assinatura/troca para ele (o backend também recusa — isto é só a UI).
  active: boolean
}

export type PlanPricingMap = Record<PlanKey, PlanPriceInfo>

// Fallback: usado antes da RPC responder e caso ela falhe — deriva do
// catálogo oficial (não é uma segunda fonte de verdade paralela, é o
// mesmo valor que já alimenta OFFICIAL_PLANS). Assume ativo por padrão: se a
// RPC falhar por instabilidade, é mais seguro manter o CTA visível (o backend
// ainda recusa checkout/troca de plano inativo) do que esconder planos válidos.
function fallbackPricing(): PlanPricingMap {
  const map = {} as PlanPricingMap
  for (const plan of OFFICIAL_PLANS) {
    map[plan.key] = { amount: plan.priceValue, display: plan.price, currency: 'brl', active: true }
  }
  return map
}

function parseAmountFromDisplay(display: string): number | null {
  const digits = display.replace(/[^\d,]/g, '').replace(',', '.')
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

export async function loadPlanPricing(): Promise<PlanPricingMap> {
  const map = fallbackPricing()
  const { data } = await supabase.rpc('get_public_plan_pricing')
  if (!Array.isArray(data)) return map
  // get_public_plan_pricing() já filtra `WHERE active = true` — qualquer plano
  // oficial que não aparecer na resposta está desativado no Admin.
  const returnedKeys = new Set<string>()
  for (const row of data as { plan_key: string; display_price: string; price_cents: number | null; currency: string }[]) {
    if (!PLAN_KEYS.includes(row.plan_key as PlanKey)) continue
    const key = row.plan_key as PlanKey
    returnedKeys.add(key)
    const amount = typeof row.price_cents === 'number' ? row.price_cents / 100 : parseAmountFromDisplay(row.display_price) ?? map[key].amount
    map[key] = { amount, display: row.display_price || map[key].display, currency: row.currency || 'brl', active: true }
  }
  for (const key of PLAN_KEYS) {
    if (!returnedKeys.has(key)) map[key] = { ...map[key], active: false }
  }
  return map
}

/** Hook de conveniência: começa com o fallback do catálogo oficial e atualiza
 * assim que a RPC responder — evita "pulo" de layout e nunca fica vazio. */
export function usePlanPricing(): { prices: PlanPricingMap; loading: boolean } {
  const [prices, setPrices] = useState<PlanPricingMap>(fallbackPricing)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    loadPlanPricing().then(map => { if (active) { setPrices(map); setLoading(false) } })
    return () => { active = false }
  }, [])
  return { prices, loading }
}
