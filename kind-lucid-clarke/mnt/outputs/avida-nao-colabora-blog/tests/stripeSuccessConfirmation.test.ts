import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const successPage = read('src/components/SuccessPage.tsx')
const statusFunction = read('supabase/functions/checkout-session-status/index.ts')

test('tela de sucesso não confirma pagamento sem verificação server-side da session_id', () => {
  assert.match(successPage, /URLSearchParams\(window\.location\.search\)\.get\('session_id'\)/)
  assert.match(successPage, /functions\.invoke\('checkout-session-status'/)
  assert.match(successPage, /Pagamento recebido\. Estamos ativando seu plano\./)
  assert.match(successPage, /Assinatura confirmada\./)
  assert.match(successPage, /Não conseguimos confirmar automaticamente\./)
  assert.doesNotMatch(successPage, /const initialPlan/)
  assert.doesNotMatch(successPage, /userPlan !== 'free'/)
})

test('validação da sessão usa Stripe e só confirma após o estado gravado pelo webhook', () => {
  assert.match(statusFunction, /stripe\.checkout\.sessions\.retrieve\(sessionId\)/)
  assert.match(statusFunction, /session\.metadata\?\.supabase_user_id !== user\.id/)
  assert.match(statusFunction, /from\('subscription_events'\)/)
  assert.match(statusFunction, /event_type', 'checkout_completed'/)
  assert.match(statusFunction, /webhookConfirmed && subscriptionActive/)
  assert.match(statusFunction, /return json\(\{ status: 'confirmed'/)
  assert.doesNotMatch(statusFunction, /\.update\(/)
  assert.doesNotMatch(statusFunction, /\.upsert\(/)
})

test('a verificação server-side não expõe segredo Stripe ao navegador', () => {
  assert.match(statusFunction, /Deno\.env\.get\('STRIPE_SECRET_KEY'\)/)
  assert.doesNotMatch(successPage, /STRIPE_SECRET_KEY|sk_live|sk_test/)
})
