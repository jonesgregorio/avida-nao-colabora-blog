import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('cada flag editável do catálogo governa uma superfície real', () => {
  const catalog = read('src/lib/planFeatureCatalog.ts')
  const pricing = read('src/components/Pricing.tsx')
  const myPlan = read('src/components/MyPlanPage.tsx')
  const presentation = read('src/lib/planCatalogPresentation.ts')

  assert.match(catalog, /surface === 'pricing'.*showOnPricing/s)
  assert.match(catalog, /surface === 'my_plan'.*showOnMyPlan/s)
  assert.match(catalog, /surface === 'comparison'.*showOnComparison/s)
  assert.match(catalog, /return item\.showOnUpgrade/)

  assert.match(pricing, /getCatalogPlanBenefits\(catalog, p\.key, 'pricing'\)/)
  assert.match(myPlan, /buildCatalogPlanLabels\(catalog, 'upgrade'\)/)
  assert.match(myPlan, /buildCatalogPlanBenefits\(catalog, currentPlan, 'my_plan'\)/)
  assert.match(myPlan, /buildCatalogComparisonRows\(catalog\)/)
  assert.match(presentation, /item\.showOnComparison/)
})

test('Meu Plano não modifica mais arrays globais para aplicar apresentação', () => {
  const wrapper = read('src/components/MyPlanPage.tsx')
  const core = read('src/components/MyPlanPageCore.tsx')

  assert.doesNotMatch(wrapper, /\.splice\(/)
  assert.doesNotMatch(wrapper, /PUBLIC_PLAN_FEATURES/)
  assert.doesNotMatch(wrapper, /PLAN_COMPARE_ROWS/)
  assert.doesNotMatch(wrapper, /applyCatalogPresentation/)

  assert.match(core, /planFeatures\?: Record<string, string\[\]>/)
  assert.match(core, /compareRows\?: PlanCompareRow\[\]/)
  assert.match(core, /currentPlanBenefits\?: CatalogBenefitView\[\]/)
  assert.match(core, /lostFeatures\(currentPlan, modal\.targetPlan, planFeatures\)/)
  assert.match(core, /lostFeatures\(currentPlan, 'free', planFeatures\)/)
  assert.match(core, /currentPlanBenefits\.map/)
  assert.match(core, /compareRows\.map/)
})
