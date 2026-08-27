import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wrapper = readFileSync(new URL('../src/components/MyPlanPage.tsx', import.meta.url), 'utf8')
const core = readFileSync(new URL('../src/components/MyPlanPageCore.tsx', import.meta.url), 'utf8')
const pricing = readFileSync(new URL('../src/components/Pricing.tsx', import.meta.url), 'utf8')

test('Meu Plano injeta somente apresentação e preserva núcleo financeiro separado', () => {
  assert.match(wrapper, /MyPlanPageCore/)
  assert.match(wrapper, /loadPlanFeatureCatalog/)
  assert.match(wrapper, /getCatalogPlanBenefits/)
  assert.match(wrapper, /applyCatalogPresentation/)
  assert.doesNotMatch(wrapper, /manage-subscription/)
  assert.doesNotMatch(wrapper, /create-checkout/)
  assert.doesNotMatch(wrapper, /calcUpgradeProration/)

  assert.match(core, /manage-subscription/)
  assert.match(core, /create-checkout/)
  assert.match(core, /calcUpgradeProration/)
  assert.match(core, /handleUpgrade/)
  assert.match(core, /handleDowngrade/)
  assert.match(core, /handleCancel/)
  assert.match(core, /handleReactivate/)
})

test('Meu Plano usa nomes do catálogo para downgrade e comparativo sem alterar entitlement', () => {
  assert.match(wrapper, /PUBLIC_PLAN_FEATURES\[plan\] = getCatalogPlanBenefits\(catalog, plan, 'upgrade'\)/)
  assert.match(wrapper, /PLAN_COMPARE_ROWS\.splice/)
  assert.match(wrapper, /item\.kind === 'commercial'/)
  assert.match(wrapper, /item\.showOnComparison/)
  assert.match(wrapper, /!item\.isActive/)
})

test('Pricing remove do comparativo recursos ocultos ou arquivados', () => {
  assert.match(pricing, /PLAN_COMPARE_ROWS\.flatMap/)
  assert.match(pricing, /if \(item && \(!item\.isActive \|\| !item\.showOnComparison\)\) return \[\]/)
})
