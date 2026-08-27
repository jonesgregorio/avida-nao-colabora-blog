import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('create-checkout recusa novas assinaturas para plano marcado inativo', () => {
  const src = read('supabase/functions/create-checkout/index.ts')
  assert.match(src, /select\('stripe_price_id, active'\)/)
  assert.match(src, /active.*===\s*false/)
  assert.match(src, /não está disponível para novas assinaturas/)
})

test('manage-subscription recusa upgrade e downgrade para plano inativo, mas nunca bloqueia downgrade para Gratuito', () => {
  const src = read('supabase/functions/manage-subscription/index.ts')
  assert.match(src, /async function planIsActive/)
  // 'free' nunca é bloqueado — ninguém pode ficar preso num plano pago contra a vontade.
  const fn = src.slice(src.indexOf('async function planIsActive'), src.indexOf('async function planIsActive') + 500)
  assert.match(fn, /if \(plan === 'free'\) return true/)

  const upgradeBlock = src.slice(src.indexOf("action === 'upgrade'"), src.indexOf("action === 'cancel'"))
  assert.match(upgradeBlock, /planIsActive\(targetPlan\)/)

  const downgradeBlock = src.slice(src.indexOf("action === 'downgrade'"))
  assert.match(downgradeBlock, /planIsActive\(targetPlan\)/)
})

test('Pricing.tsx e Meu Plano escondem/desabilitam CTA de assinatura para plano inativo, sem esconder de quem já é assinante', () => {
  const pricing = read('src/components/Pricing.tsx')
  assert.match(pricing, /unavailable = !isCurrent && prices\[plan\.key\]\?\.active === false/)
  assert.match(pricing, /Indisponível agora/)

  const myPlan = read('src/components/MyPlanPageCore.tsx')
  assert.match(myPlan, /pricingMap\[p\.key\]\?\.active === false/)
})

test('planPricing.ts expõe `active` derivado de get_public_plan_pricing (que já filtra active=true)', () => {
  const src = read('src/lib/planPricing.ts')
  assert.match(src, /active: boolean/)
  assert.match(src, /returnedKeys/)
})
