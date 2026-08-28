import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wrapper = readFileSync(new URL('../src/components/MyPlanPage.tsx', import.meta.url), 'utf8')
const core = readFileSync(new URL('../src/components/MyPlanPageCore.tsx', import.meta.url), 'utf8')
const pricing = readFileSync(new URL('../src/components/Pricing.tsx', import.meta.url), 'utf8')
const presentation = readFileSync(new URL('../src/lib/planCatalogPresentation.ts', import.meta.url), 'utf8')

test('Meu Plano injeta somente apresentação e preserva núcleo financeiro separado', () => {
  assert.match(wrapper, /MyPlanPageCore/)
  assert.match(wrapper, /loadPlanFeatureCatalog/)
  assert.match(wrapper, /buildCatalogPlanLabels/)
  assert.match(wrapper, /buildCatalogPlanBenefits/)
  assert.match(wrapper, /buildCatalogComparisonRows/)
  assert.doesNotMatch(wrapper, /manage-subscription/)
  assert.doesNotMatch(wrapper, /create-checkout/)
  assert.doesNotMatch(wrapper, /calcUpgradeProration/)
  assert.doesNotMatch(wrapper, /applyCatalogPresentation/)
  assert.doesNotMatch(wrapper, /\.splice\(/)

  assert.match(core, /manage-subscription/)
  assert.match(core, /create-checkout/)
  assert.match(core, /calcUpgradeProration/)
  assert.match(core, /handleUpgrade/)
  assert.match(core, /handleDowngrade/)
  assert.match(core, /handleCancel/)
  assert.match(core, /handleReactivate/)
})

test('Meu Plano usa nomes do catálogo para downgrade, comparativo e plano atual sem alterar entitlement', () => {
  assert.match(wrapper, /buildCatalogPlanLabels\(catalog, 'upgrade'\)/)
  assert.match(wrapper, /buildCatalogPlanBenefits\(catalog, currentPlan, 'my_plan'\)/)
  assert.match(wrapper, /buildCatalogComparisonRows\(catalog\)/)
  assert.match(core, /planFeatures=\{planFeatures\}/)
  assert.match(core, /compareRows=\{compareRows\}/)
  assert.match(core, /currentPlanBenefits=\{currentPlanBenefits\}/)
  assert.match(presentation, /item\.kind === 'commercial'/)
  assert.match(presentation, /item\.showOnComparison/)
  assert.match(presentation, /!item\.isActive/)
})

test('Pricing remove do comparativo recursos ocultos ou arquivados', () => {
  assert.match(pricing, /PLAN_COMPARE_ROWS\.flatMap/)
  assert.match(pricing, /if \(item && \(!item\.isActive \|\| !item\.showOnComparison\)\) return \[\]/)
})
