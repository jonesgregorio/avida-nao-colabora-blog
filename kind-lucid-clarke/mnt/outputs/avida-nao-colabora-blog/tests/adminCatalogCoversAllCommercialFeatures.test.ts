import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_PLAN_ACCESS, OFFICIAL_FEATURES, getFeatureMinimumPlan } from '../src/lib/officialPlans.ts'

// Achado da auditoria: Check-in, Diário por voz, Descobertas, Meu Jardim e
// Aprofundamentos do Diário eram anunciados no Pricing/README mas não
// existiam no catálogo oficial — o Admin não tinha como configurá-los
// (renomear, ocultar, mover de plano) sem deploy de código.

const NEW_KEYS: Record<string, 'free' | 'essential' | 'plus'> = {
  checkin_daily: 'free',
  diary_voice: 'free',
  discoveries: 'essential',
  my_garden: 'essential',
  diary_deepenings: 'plus',
}

test('os 5 recursos que só existiam no Pricing agora fazem parte do catálogo oficial', () => {
  for (const key of Object.keys(NEW_KEYS)) {
    assert.ok(OFFICIAL_FEATURES.some(f => f.key === key), `${key} ausente de OFFICIAL_FEATURES`)
  }
})

test('o plano mínimo de cada recurso novo bate com a matriz comercial', () => {
  for (const [key, plan] of Object.entries(NEW_KEYS)) {
    assert.equal(getFeatureMinimumPlan(key), plan, `${key} deveria ter piso '${plan}'`)
    assert.equal(DEFAULT_PLAN_ACCESS[plan].includes(key), true)
  }
})

test('Pricing.tsx agora aponta catalogKey para os 5 recursos, então o Admin consegue ocultar/renomear cada um', () => {
  const pricing = readFileSync(new URL('../src/components/Pricing.tsx', import.meta.url), 'utf8')
  assert.match(pricing, /checkin: \{ id: 'checkin', label: 'Check-in diário', catalogKey: 'checkin_daily' \}/)
  assert.match(pricing, /voice: \{ id: 'voice', label: 'Diário por voz', catalogKey: 'diary_voice' \}/)
  assert.match(pricing, /catalogKey: 'diary_deepenings'/)
  assert.match(pricing, /catalogKey: 'discoveries'/)
  assert.match(pricing, /catalogKey: 'my_garden'/)
})

test('Edge Function admin-plan-consistency permanece sincronizada com o catálogo oficial', () => {
  const fn = readFileSync(new URL('../supabase/functions/admin-plan-consistency/index.ts', import.meta.url), 'utf8')
  for (const key of Object.keys(NEW_KEYS)) {
    assert.match(fn, new RegExp(`'${key}'`), `admin-plan-consistency não lista o novo recurso "${key}"`)
  }
})

test('comparação oficial (Meu Plano) ganhou as mesmas 5 linhas que o Pricing já mostrava', () => {
  const officialPlans = readFileSync(new URL('../src/lib/officialPlans.ts', import.meta.url), 'utf8')
  for (const key of ['checkin', 'voice', 'discoveries', 'garden']) {
    assert.match(officialPlans, new RegExp(`featureRow\\('${key}'`), `linha de comparação "${key}" ausente de OFFICIAL_PLAN_COMPARISON`)
  }
  assert.match(officialPlans, /key: 'deepening'/, 'linha de comparação "deepening" ausente de OFFICIAL_PLAN_COMPARISON')
})
