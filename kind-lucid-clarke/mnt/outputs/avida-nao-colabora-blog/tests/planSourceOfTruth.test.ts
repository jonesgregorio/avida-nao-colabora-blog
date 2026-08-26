import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_PLAN_ACCESS,
  OFFICIAL_FEATURES,
  OFFICIAL_PLAN_COMPARISON,
  OFFICIAL_PLANS,
  PLAN_KEYS,
  PUBLIC_PLAN_FEATURES,
  getFeatureMinimumPlan,
  getPublicPlanBenefits,
  normalizePlan,
} from '../src/lib/officialPlans.ts'
import { PLAN_BENEFITS, PLAN_COMPARE_ROWS } from '../src/lib/planComparison.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('catálogo oficial mantém somente Gratuito, Essencial e Plus', () => {
  assert.deepEqual(PLAN_KEYS, ['free', 'essential', 'plus'])
  assert.deepEqual(OFFICIAL_PLANS.map(plan => plan.key), PLAN_KEYS)
  assert.equal(normalizePlan('therapeutic'), 'plus')
  assert.equal(normalizePlan('therapeutic-plus'), 'plus')
})

test('benefícios públicos e comparação são derivados da fonte oficial', () => {
  for (const plan of PLAN_KEYS) {
    assert.deepEqual(PUBLIC_PLAN_FEATURES[plan], getPublicPlanBenefits(plan))
    assert.deepEqual(PLAN_BENEFITS[plan], PUBLIC_PLAN_FEATURES[plan])
  }
  assert.deepEqual(
    PLAN_COMPARE_ROWS,
    OFFICIAL_PLAN_COMPARISON.map(({ label, values }) => ({ label, values })),
  )
})

test('comparação não inventa níveis de questionário fora do catálogo oficial', () => {
  const labels = OFFICIAL_FEATURES.map(feature => feature.name).join(' | ')
  assert.match(labels, /Questionário inicial/)
  const comparison = JSON.stringify(OFFICIAL_PLAN_COMPARISON)
  assert.doesNotMatch(comparison, /Questionários intermediários/i)
  assert.doesNotMatch(comparison, /Questionários avançados/i)
})

test('piso de cada feature própria é calculado pela matriz oficial', () => {
  for (const feature of OFFICIAL_FEATURES) {
    const floor = getFeatureMinimumPlan(feature.key)
    assert.ok(floor, `feature sem plano mínimo: ${feature.key}`)
    assert.equal(DEFAULT_PLAN_ACCESS[floor!].includes(feature.key), true)
  }
  assert.equal(getFeatureMinimumPlan('guided_text_meditations'), 'essential')
  assert.equal(getFeatureMinimumPlan('feature_inexistente'), null)
})

test('permissions não mantém outra hierarquia ou tabela manual de features', () => {
  const src = read('src/lib/permissions.ts')
  assert.match(src, /PLAN_RANK/)
  assert.match(src, /OWN_FEATURE_KEYS/)
  assert.match(src, /resolveKey/)
  assert.match(src, /normalizePlan/)
  assert.doesNotMatch(src, /const FEATURE_PLAN_FLOOR/)
  assert.doesNotMatch(src, /therapeutic:\s*2/)
})

test('Diário usa identidade oficial e concentra as travas fora do componente Admin', () => {
  const config = read('src/lib/diaryConfig.ts')
  const admin = read('src/components/admin/AdminDiaryConfig.tsx')

  assert.match(config, /normalizePlan/)
  assert.match(config, /getPlanLabel/)
  assert.match(config, /export const DIARY_LOCKED_FIELDS/)
  assert.match(config, /export function enforceDiaryPlanRules/)
  assert.match(admin, /DIARY_LOCKED_FIELDS/)
  assert.match(admin, /enforceDiaryPlanRules/)
  assert.doesNotMatch(admin, /const lockedFields/)
  assert.doesNotMatch(admin, /const enforcePlanRules/)
})

test('Pricing deriva identidade comercial de OFFICIAL_PLANS', () => {
  const pricing = read('src/components/Pricing.tsx')
  assert.match(pricing, /OFFICIAL_PLANS\.map/)
  assert.match(pricing, /normalizePlan\(currentPlan\)/)
  assert.doesNotMatch(pricing, /name:\s*'Gratuito'/)
  assert.doesNotMatch(pricing, /price:\s*'R\$ 19,90'/)
  assert.doesNotMatch(pricing, /price:\s*'R\$ 39,90'/)
})
