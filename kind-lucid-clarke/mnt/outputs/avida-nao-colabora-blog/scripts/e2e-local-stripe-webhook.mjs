// E2E local do fluxo Stripe → webhook → atualização de plano.
//
// Não usa o pacote npm "stripe" (evita nova dependência do projeto): fala
// direto com a API REST da Stripe via fetch, exatamente como as Edge
// Functions fazem via `npm:stripe@14` dentro do Deno.
//
// Requer variáveis de ambiente (ver .e2e-local/stripe-webhook-e2e.env, que
// NUNCA é versionado):
//   E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, E2E_SUPABASE_SERVICE_ROLE_KEY
//   E2E_DOCKER_BIN, LOCAL_FUNCTIONS_URL
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//   STRIPE_PRICE_ESSENTIAL, STRIPE_PRICE_PLUS_3990
//
// Uso:
//   node --env-file=.e2e-local/stripe-webhook-e2e.env scripts/e2e-local-stripe-webhook.mjs checkout essential
//     -> cria usuário confirmado, chama create-checkout, imprime a URL de
//        checkout para pagamento manual no navegador com o cartão de teste.
//
//   node --env-file=.e2e-local/stripe-webhook-e2e.env scripts/e2e-local-stripe-webhook.mjs verify <customerId> <userId> essential
//     -> busca os eventos reais gerados pelo pagamento na API da Stripe,
//        assina-os localmente com STRIPE_WEBHOOK_SECRET e entrega ao
//        endpoint local stripe-webhook. Depois confirma profiles.plan e
//        user_subscriptions no Postgres local.
//
//   node --env-file=.e2e-local/stripe-webhook-e2e.env scripts/e2e-local-stripe-webhook.mjs edge-cases <customerId> <userId>
//     -> replay do mesmo evento, assinatura inválida, price não mapeado,
//        metadata de usuário divergente.
//
//   node --env-file=.e2e-local/stripe-webhook-e2e.env scripts/e2e-local-stripe-webhook.mjs cleanup <userId> [subscriptionId]
//     -> cancela a assinatura de teste na Stripe e remove o usuário local.

import { randomUUID, createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function need(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

const E2E_SUPABASE_URL = need('E2E_SUPABASE_URL')
const E2E_SUPABASE_ANON_KEY = need('E2E_SUPABASE_ANON_KEY')
const E2E_SUPABASE_SERVICE_ROLE_KEY = need('E2E_SUPABASE_SERVICE_ROLE_KEY')
const LOCAL_FUNCTIONS_URL = need('LOCAL_FUNCTIONS_URL')
const STRIPE_SECRET_KEY = need('STRIPE_SECRET_KEY')
const STRIPE_WEBHOOK_SECRET = need('STRIPE_WEBHOOK_SECRET')

const admin = createClient(E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ---- Stripe REST helpers (sem SDK) -----------------------------------

async function stripeGet(path, params = {}) {
  const url = new URL(`https://api.stripe.com/v1/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } })
  const json = await res.json()
  if (!res.ok) throw new Error(`Stripe GET ${path} falhou: ${JSON.stringify(json)}`)
  return json
}

async function stripePost(path, form) {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(form)) {
    if (v === undefined) continue
    if (Array.isArray(v)) v.forEach((item, i) => body.set(`${k}[${i}]`, item))
    else body.set(k, String(v))
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Stripe POST ${path} falhou: ${JSON.stringify(json)}`)
  return json
}

async function stripeDelete(path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Stripe DELETE ${path} falhou: ${JSON.stringify(json)}`)
  return json
}

// Assina localmente exatamente como a Stripe assinaria (esquema documentado
// publicamente: HMAC-SHA256 de "timestamp.payload" com o signing secret do
// endpoint). Isso permite reentregar um evento REAL (dados vindos da API da
// Stripe) sem depender de túnel/proxy para receber a entrega original.
function signStripePayload(payloadString, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signedPayload = `${timestamp}.${payloadString}`
  const signature = createHmac('sha256', secret).update(signedPayload).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

async function deliverWebhook(eventObject, { signature, rawPayload } = {}) {
  const payload = rawPayload ?? JSON.stringify(eventObject)
  const sig = signature ?? signStripePayload(payload, STRIPE_WEBHOOK_SECRET)
  const res = await fetch(`${LOCAL_FUNCTIONS_URL}/stripe-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig },
    body: payload,
  })
  const text = await res.text()
  return { status: res.status, body: text }
}

// ---- Postgres local (psql via docker exec, mesmo padrão do script de RLS) --

import { execFileSync } from 'node:child_process'

function psql(sql) {
  const bin = process.env.E2E_DOCKER_BIN || 'docker'
  return execFileSync(bin, [
    'exec', 'supabase_db_local-e2e', 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-v', 'ON_ERROR_STOP=1',
    '-c', sql,
  ], { encoding: 'utf8' }).trim()
}

// ---- Comandos ----------------------------------------------------------

async function cmdCheckout(plan) {
  if (plan !== 'essential' && plan !== 'plus') throw new Error('plan deve ser essential ou plus')
  const email = `stripe-e2e-${randomUUID().slice(0, 8)}@local.test`
  const password = `Stripe-${randomUUID()}-Aa1!`

  const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (createErr || !created.user) throw new Error(`Não foi possível criar usuário: ${createErr?.message}`)
  const userId = created.user.id

  const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({ email, password })
  if (signInErr || !signIn.session) throw new Error(`Não foi possível logar: ${signInErr?.message}`)

  const res = await fetch(`${LOCAL_FUNCTIONS_URL}/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signIn.session.access_token}`,
      apikey: E2E_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ plan, origin: 'http://localhost:5173' }),
  })
  const json = await res.json()
  if (!res.ok || !json.url) throw new Error(`create-checkout falhou (HTTP ${res.status}): ${JSON.stringify(json)}`)

  console.log('=== Conta E2E criada ===')
  console.log('userId:', userId)
  console.log('email:', email)
  console.log('password:', password)
  console.log()
  console.log('=== URL de checkout (abrir no navegador, pagar com 4242 4242 4242 4242) ===')
  console.log(json.url)
}

async function cmdVerify(customerId, userId, plan) {
  // Busca os eventos reais mais recentes ligados a este customer.
  const types = ['checkout.session.completed', 'customer.subscription.created', 'invoice.payment_succeeded']
  const results = []
  for (const type of types) {
    const list = await stripeGet('events', { type, limit: '20' })
    const match = list.data.find((e) => JSON.stringify(e.data.object).includes(customerId))
    if (!match) {
      console.warn(`AVISO: nenhum evento ${type} recente encontrado para o customer ${customerId}`)
      continue
    }
    results.push(match)
  }
  if (results.length === 0) throw new Error('Nenhum evento real encontrado — o checkout foi concluído no navegador?')

  for (const event of results) {
    const delivery = await deliverWebhook(event)
    console.log(`--- entregando ${event.type} (evt ${event.id}) ---`)
    console.log('HTTP', delivery.status, delivery.body.slice(0, 300))
    if (delivery.status >= 300) throw new Error(`Webhook rejeitou ${event.type}: HTTP ${delivery.status}`)
  }

  // Confirma estado no banco local.
  const profileRow = psql(`SELECT plan, stripe_customer_id FROM public.profiles WHERE user_id = '${userId}'::uuid`)
  console.log('profiles.plan | stripe_customer_id ->', profileRow)
  const [dbPlan, dbCustomer] = profileRow.split('|').map((s) => s.trim())
  if (dbPlan !== plan) throw new Error(`profiles.plan esperado=${plan} obtido=${dbPlan}`)
  if (!dbCustomer || dbCustomer !== customerId) throw new Error(`stripe_customer_id não bate: esperado=${customerId} obtido=${dbCustomer}`)

  const subRow = psql(`SELECT plan_key, status, provider_customer_id FROM public.user_subscriptions WHERE user_id = '${userId}'::uuid ORDER BY updated_at DESC LIMIT 1`)
  console.log('user_subscriptions ->', subRow || '(vazio)')
  const [subPlan, subStatus, subCustomer] = subRow.split('|').map((s) => s.trim())
  if (subPlan !== plan) throw new Error(`user_subscriptions.plan_key esperado=${plan} obtido=${subPlan}`)
  if (subStatus !== 'active') throw new Error(`user_subscriptions.status esperado=active obtido=${subStatus}`)
  if (subCustomer !== customerId) throw new Error(`user_subscriptions.provider_customer_id não bate: esperado=${customerId} obtido=${subCustomer}`)

  console.log('OK: profiles.plan e user_subscriptions refletem o pagamento real.')
}

function fakeSubscriptionEvent({ type, id, customer, priceId, metadata, status = 'active' }) {
  const now = Math.floor(Date.now() / 1000)
  return {
    id,
    object: 'event',
    type,
    created: now,
    data: {
      object: {
        id: 'sub_forged_' + randomUUID().slice(0, 8),
        object: 'subscription',
        customer,
        status,
        created: now,
        current_period_start: now,
        current_period_end: now + 30 * 24 * 3600,
        cancel_at_period_end: false,
        canceled_at: null,
        trial_end: null,
        items: { data: [{ price: { id: priceId, product: 'prod_forged' } }] },
        metadata,
      },
    },
  }
}

async function cmdEdgeCases(customerId, userId) {
  const list = await stripeGet('events', { type: 'checkout.session.completed', limit: '20' })
  const event = list.data.find((e) => JSON.stringify(e.data.object).includes(customerId))
  if (!event) throw new Error('Evento checkout.session.completed não encontrado — rode "verify" antes')
  const payload = JSON.stringify(event)

  console.log('--- caso 1: replay do mesmo evento (idempotência) ---')
  console.log('Esperado: 1a entrega processa (200), replay é ignorado como duplicado (200, duplicate:true), SEM duplicar plan_change_history/notifications.')
  const first = await deliverWebhook(event, { rawPayload: payload })
  const replay = await deliverWebhook(event, { rawPayload: payload })
  console.log('primeira entrega:', first.status, first.body.slice(0, 150))
  console.log('replay:', replay.status, replay.body.slice(0, 150))
  if (!/duplicate/i.test(replay.body)) console.warn('AVISO: replay não foi identificado como duplicado — revisar stripe_webhook_events')

  console.log('--- caso 2: assinatura inválida ---')
  console.log('Esperado: HTTP 400, corpo "Webhook Error: ...".')
  const badSig = await deliverWebhook(event, { rawPayload: payload, signature: 't=1000000000,v1=' + '0'.repeat(64) })
  console.log('HTTP', badSig.status, badSig.body.slice(0, 150))
  if (badSig.status < 400) throw new Error('BUG: assinatura inválida foi aceita')

  console.log('--- caso 3: price ID não mapeado (customer.subscription.created) ---')
  console.log('Esperado: HTTP 200 {received:true}, SEM alterar profiles.plan nem user_subscriptions (plano não reconhecido -> ignora em silêncio, só loga erro no console da função).')
  const unmapped = fakeSubscriptionEvent({
    type: 'customer.subscription.created',
    id: 'evt_forged_unmapped_' + randomUUID().slice(0, 12),
    customer: customerId,
    priceId: 'price_nao_mapeado_inexistente',
    metadata: { supabase_user_id: userId, plan: 'essential' },
  })
  const unmappedDelivery = await deliverWebhook(unmapped)
  console.log('HTTP', unmappedDelivery.status, unmappedDelivery.body.slice(0, 200))
  const planAfterUnmapped = psql(`SELECT plan FROM public.profiles WHERE user_id = '${userId}'::uuid`)
  console.log('profiles.plan após price não mapeado (não deve ter mudado):', planAfterUnmapped)

  console.log('--- caso 4: metadata de usuário divergente (checkout.session.completed) ---')
  console.log('Esperado: HTTP 200 {received:true}, acesso NÃO liberado (Session.user_id diverge da Subscription real) — profiles.plan permanece o de antes deste evento forjado.')
  const mismatchedSession = structuredClone(event)
  mismatchedSession.id = 'evt_forged_mismatch_' + randomUUID().slice(0, 12)
  mismatchedSession.data.object.metadata = { ...mismatchedSession.data.object.metadata, supabase_user_id: randomUUID() }
  const planBeforeMismatch = psql(`SELECT plan FROM public.profiles WHERE user_id = '${userId}'::uuid`)
  const mismatchDelivery = await deliverWebhook(mismatchedSession)
  console.log('HTTP', mismatchDelivery.status, mismatchDelivery.body.slice(0, 200))
  const planAfterMismatch = psql(`SELECT plan FROM public.profiles WHERE user_id = '${userId}'::uuid`)
  console.log('profiles.plan antes/depois do evento com metadata divergente:', planBeforeMismatch, '->', planAfterMismatch)
  if (planBeforeMismatch !== planAfterMismatch) throw new Error('BUG: metadata divergente alterou o plano mesmo assim')

  console.log('Casos extremos concluídos.')
}

async function cmdCleanup(userId, subscriptionId) {
  if (subscriptionId) {
    try {
      await stripeDelete(`subscriptions/${subscriptionId}`)
      console.log('Assinatura Stripe cancelada:', subscriptionId)
    } catch (err) {
      console.warn('Aviso ao cancelar assinatura:', err.message)
    }
  }
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) console.warn('Aviso ao remover usuário:', error.message)
    else console.log('Usuário E2E removido:', userId)
  }
}

const [, , command, ...args] = process.argv

try {
  if (command === 'checkout') await cmdCheckout(args[0])
  else if (command === 'verify') await cmdVerify(args[0], args[1], args[2])
  else if (command === 'edge-cases') await cmdEdgeCases(args[0], args[1])
  else if (command === 'cleanup') await cmdCleanup(args[0], args[1])
  else {
    console.error('Uso: checkout <plan> | verify <customerId> <userId> <plan> | edge-cases <customerId> <userId> | cleanup <userId> [subscriptionId]')
    process.exit(1)
  }
} catch (err) {
  console.error('ERRO:', err.message)
  process.exit(1)
}
