import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('planPricing.ts é a única fonte de preço dinâmico (via get_public_plan_pricing) e nunca fica vazio', () => {
  const src = read('src/lib/planPricing.ts')
  assert.match(src, /get_public_plan_pricing/)
  assert.match(src, /export async function loadPlanPricing/)
  assert.match(src, /export function usePlanPricing/)
  // O fallback deriva do catálogo oficial — não pode ser um número hardcoded
  // paralelo (isso reintroduziria o mesmo bug que este arquivo corrige).
  const fallbackFn = src.slice(src.indexOf('function fallbackPricing'), src.indexOf('function parseAmountFromDisplay'))
  assert.match(fallbackFn, /OFFICIAL_PLANS/)
  assert.doesNotMatch(fallbackFn, /19[.,]9|39[.,]9/, 'fallback não deve hardcodar o preço atual — deve vir de OFFICIAL_PLANS')
})

test('Home, Pricing e Meu Plano consomem a mesma fonte canônica de preço', () => {
  const home = read('src/components/HomeContent.tsx')
  assert.match(home, /from '..\/lib\/planPricing'/)
  assert.match(home, /usePlanPricing/)

  const pricing = read('src/components/Pricing.tsx')
  assert.match(pricing, /from '..\/lib\/planPricing'/)
  assert.match(pricing, /usePlanPricing/)
  // Não deve mais chamar a RPC diretamente — só através da fonte canônica.
  assert.doesNotMatch(pricing, /supabase\.rpc\('get_public_plan_pricing'\)/)

  const myPlan = read('src/components/MyPlanPageCore.tsx')
  assert.match(myPlan, /from '..\/lib\/planPricing'/)
  assert.match(myPlan, /usePlanPricing/)
  // O cálculo de proração de upgrade/downgrade precisa usar o preço dinâmico,
  // não uma tabela estática derivada só de OFFICIAL_PLANS no módulo.
  assert.doesNotMatch(myPlan, /\bPLAN_PRICES\[/, 'não deve sobrar uso da tabela estática antiga de preços')
})
