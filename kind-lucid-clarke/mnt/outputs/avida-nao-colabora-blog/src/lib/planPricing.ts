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
}

export type PlanPricingMap = Record<PlanKey, PlanPriceInfo>

// Fallback: usado antes da RPC responder e caso ela falhe — deriva do
// catálogo oficial (não é uma segunda fonte de verdade paralela, é o
// mesmo valor que já alimenta OFFICIAL_PLANS).
function fallbackPricing(): PlanPricingMap {
  const map = {} as PlanPricingMap
  for (const plan of OFFICIAL_PLANS) {
    map[plan.key] = { amount: plan.priceValue, display: plan.price, currency: 'brl' }
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
  for (const row of data as { plan_key: string; display_price: string; price_cents: number | null; currency: string }[]) {
    if (!PLAN_KEYS.includes(row.plan_key as PlanKey)) continue
    const key = row.plan_key as PlanKey
    const amount = typeof row.price_cents === 'number' ? row.price_cents / 100 : parseAmountFromDisplay(row.display_price) ?? map[key].amount
    map[key] = { amount, display: row.display_price || map[key].display, currency: row.currency || 'brl' }
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
