import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('OFFICIAL_FEATURE_KEYS da Edge Function fica em sincronia com os 12 recursos técnicos oficiais', () => {
  const officialPlans = read('src/lib/officialPlans.ts')
  const officialKeys = [...officialPlans.matchAll(/key: '([a-z0-9_]+)'/g)].map(m => m[1])
  // Corta o array em OFFICIAL_FEATURES (antes de OFFICIAL_PLANS reaproveitar `key:`).
  const featuresBlock = officialPlans.slice(
    officialPlans.indexOf('export const OFFICIAL_FEATURES'),
    officialPlans.indexOf('export const ALIAS_TO_KEY'),
  )
  const officialFeatureKeys = [...featuresBlock.matchAll(/key: '([a-z0-9_]+)'/g)].map(m => m[1])
  assert.equal(officialFeatureKeys.length, 12, 'auditoria assume 12 recursos técnicos oficiais — atualize a Edge Function se isso mudar')

  const fn = read('supabase/functions/admin-plan-consistency/index.ts')
  const fnBlock = fn.slice(fn.indexOf('const OFFICIAL_FEATURE_KEYS'), fn.indexOf(']') + 1)
  for (const key of officialFeatureKeys) {
    assert.match(fnBlock, new RegExp(`'${key}'`), `admin-plan-consistency não lista o recurso técnico "${key}"`)
  }
  assert.equal(officialKeys.length >= officialFeatureKeys.length, true)
})

test('admin-plan-consistency exige AAL2, é read-only (não escreve em nenhuma tabela) e nunca corrige sozinho', () => {
  const fn = read('supabase/functions/admin-plan-consistency/index.ts')
  assert.match(fn, /requireAdminAal2\(req\)/)
  assert.doesNotMatch(fn, /\.upsert\(|\.update\(|\.insert\(|\.delete\(/, 'o verificador deve ser puramente read-only')
  assert.doesNotMatch(fn, /stripe\.prices\.(create|update)/, 'não deve corrigir preços automaticamente')
})

test('verificador compara preço do banco com o preço real ao vivo no Stripe (não usa valor fixo hardcoded)', () => {
  const fn = read('supabase/functions/admin-plan-consistency/index.ts')
  assert.match(fn, /stripe\.prices\.retrieve\(cfg\.stripe_price_id\)/)
  assert.match(fn, /price\.unit_amount/)
})

test('stripe-audit compara com o preço atual do banco, não com um valor fixo permanente (Etapa 10)', () => {
  const fn = read('supabase/functions/stripe-audit/index.ts')
  // O valor fixo antigo só pode sobrar como fallback de emergência, nunca
  // como a fonte usada nas comparações reais (`essentialOk`/`plusOk`/`runPrice`).
  assert.doesNotMatch(fn, /EXPECTED\.essential|EXPECTED\.plus/, 'não deve mais comparar contra a constante fixa antiga')
  assert.match(fn, /FALLBACK_EXPECTED/)
  assert.match(fn, /from\('plan_configs'\)\.select\('plan_key, price_cents'\)/)
  assert.match(fn, /runPrice\('essential', priceEnv\.essential, expected\.essential\)/)
  assert.match(fn, /runPrice\('plus', priceEnv\.plus, expected\.plus\)/)
})

test('UI do Admin só aponta divergências, sem botão de correção automática', () => {
  const ui = read('src/components/admin/AdminPlanConsistencyCheck.tsx')
  assert.match(ui, /Verificar planos/)
  assert.doesNotMatch(ui, /[Cc]orrigir automaticamente|[Aa]plicar correç/)
  const overview = read('src/components/admin/AdminPlanosPage.tsx')
  assert.match(overview, /AdminPlanConsistencyCheck/)
})
