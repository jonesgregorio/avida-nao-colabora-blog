import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const checkout = readFileSync(new URL('../supabase/functions/create-checkout/index.ts', import.meta.url), 'utf8')
const webhook = readFileSync(new URL('../supabase/functions/stripe-webhook/index.ts', import.meta.url), 'utf8')

test('checkout aceita somente planos pagos oficiais e replica metadata na Subscription', () => {
  assert.match(checkout, /type PaidPlan = 'essential' \| 'plus'/)
  assert.match(checkout, /value === 'essential' \|\| value === 'plus'/)
  assert.match(checkout, /if \(!isPaidPlan\(plan\)\)/)
  assert.match(checkout, /subscription_data:\s*\{ metadata \}/)
  assert.match(checkout, /metadata = \{ supabase_user_id: user\.id, plan \}/)
})

test('checkout concluído usa Price da assinatura como fonte da verdade do plano', () => {
  assert.match(webhook, /const plan = await planFromPrice\(priceId, supabase\)/)
  assert.match(webhook, /requestedPlan = session\.metadata\?\.plan/)
  assert.match(webhook, /metadata plan=.*diverge do Price/)
  assert.match(webhook, /subscriptionUserId && subscriptionUserId !== sessionUserId/)
  assert.match(webhook, /plano "\$\{plan\}" verificado pelo Price/)
})

test('assinaturas sincronizadas pelo webhook são identificadas como Stripe', () => {
  assert.match(webhook, /provider: 'stripe'/)
  assert.match(webhook, /provider_customer_id: customerId/)
  assert.match(webhook, /provider_subscription_id: s\.id/)
  assert.match(webhook, /stripeSubscriptionFields\(subscription, customerId\)/)
})

test('payment_events recebe trilha financeira completa da invoice', () => {
  assert.match(webhook, /from\('payment_events'\)\.insert\(\{/)
  assert.match(webhook, /subscription_id: savedSub\?\.id \?\? null/)
  assert.match(webhook, /plan_key: plan/)
  assert.match(webhook, /status: 'succeeded'/)
  assert.match(webhook, /provider: 'stripe'/)
  assert.match(webhook, /provider_payment_id: invoice\.id/)
  assert.match(webhook, /created_at: pagoEm/)
})

test('reserva idempotente é marcada como processada ao final do handler', () => {
  assert.match(webhook, /const response = await handleEvent\(event, supabase\)/)
  assert.match(webhook, /status: 'processed'/)
  assert.match(webhook, /processed_at: new Date\(\)\.toISOString\(\)/)
  assert.match(webhook, /delete\(\)\.eq\('stripe_event_id', event\.id\)/)
})
