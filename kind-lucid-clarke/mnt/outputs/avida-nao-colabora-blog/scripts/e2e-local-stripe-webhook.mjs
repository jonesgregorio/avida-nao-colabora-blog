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
//   node --env-file=.e2e-local/stripe-webhook-e2e.env scripts/e2e-local-stripe-webhook.mjs checkout-auto essential
//     -> igual ao "checkout", mas paga sozinho via Playwright (chromium
//        headless, cartão de teste 4242) e já imprime customerId/userId
//        prontos para "verify"/"plan-change"/"cleanup".
//
//   node --env-file=.e2e-local/stripe-webhook-e2e.env scripts/e2e-local-stripe-webhook.mjs full-cycle essential
//     -> ciclo completo num comando só: checkout-auto -> verify ->
//        payment-failed -> plan-change (upgrade para plus e volta pro
//        plano original) -> cleanup. Não precisa de navegador manual.
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
//   node --env-file=.e2e-local/stripe-webhook-e2e.env scripts/e2e-local-stripe-webhook.mjs payment-failed <customerId> <userId> [subscriptionId]
//     -> forja um invoice.payment_failed real o suficiente (mesmo esquema de
//        assinatura HMAC) e confirma que o plano NÃO muda e que
//        user_subscriptions.last_payment_failed_at é registrado.
//
//   node --env-file=.e2e-local/stripe-webhook-e2e.env scripts/e2e-local-stripe-webhook.mjs plan-change <subscriptionId> <newPriceId> <userId> <expectedPlan>
//     -> troca o price de uma assinatura REAL via API da Stripe
//        (subscriptions.update), entrega o customer.subscription.updated
//        resultante ao webhook e confirma profiles.plan/user_subscriptions.
//        Serve tanto para upgrade quanto para downgrade — só muda o price e
//        o expectedPlan passados.
//
//   node --env-file=.e2e-local/stripe-webhook-e2e.env scripts/e2e-local-stripe-webhook.mjs renewal-cycle essential
//     -> cria assinatura direto pela API (Stripe Test Clock), avança o
//        relógio de teste até depois do fim do 1º período — a Stripe cobra
//        de verdade e gera um invoice.payment_succeeded real de renovação
//        (billing_reason=subscription_cycle) — entrega ao webhook e
//        confirma period avançado, payment_events/subscription_events/
//        notifications/email_logs (inclusive o assunto do e-mail já
//        renderizado com as variáveis).
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

async function createCheckoutSession(plan) {
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

  return { userId, email, password, url: json.url }
}

async function cmdCheckout(plan) {
  const { userId, email, password, url } = await createCheckoutSession(plan)
  console.log('=== Conta E2E criada ===')
  console.log('userId:', userId)
  console.log('email:', email)
  console.log('password:', password)
  console.log()
  console.log('=== URL de checkout (abrir no navegador, pagar com 4242 4242 4242 4242) ===')
  console.log(url)
}

// Paga uma sessão de Checkout sozinho, via Playwright (chromium headless),
// usando o cartão de teste da Stripe. Evita a etapa manual no navegador.
// Não depende do redirect final (que exige um dev server em localhost:5173
// rodando) — clica em "Assinar" e sai; quem confirma o pagamento é o polling
// na API da Stripe em cmdCheckoutAuto.
async function payCheckoutWithTestCard(url) {
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    await page.fill('input[placeholder="1234 1234 1234 1234"]', '4242424242424242')
    await page.fill('input[placeholder="MM / AA"]', '12/34')
    await page.fill('input[placeholder="CVC"]', '123')
    const nameField = page.locator('input[placeholder="Nome completo"]')
    if (await nameField.count() > 0) await nameField.fill('Teste E2E Stripe')

    await page.locator('button[type="submit"]').first().click()
    // Não espera navegação: o redirect final aponta pro app real (origin),
    // que pode não estar rodando neste ambiente. O clique já é suficiente
    // pra Stripe processar o pagamento do lado dele.
    await page.waitForTimeout(4000)
  } finally {
    await browser.close()
  }
}

async function cmdCheckoutAuto(plan) {
  const { userId, email, url } = await createCheckoutSession(plan)
  console.log('=== Conta E2E criada ===')
  console.log('userId:', userId, '| email:', email)

  const sessionId = new URL(url).pathname.split('/').pop()
  if (!sessionId?.startsWith('cs_')) throw new Error(`Não consegui extrair session_id da URL de checkout: ${url}`)

  console.log('Pagando via Playwright (cartão de teste 4242)...')
  await payCheckoutWithTestCard(url)

  console.log('Confirmando pagamento na API da Stripe (polling)...')
  let session = null
  for (let i = 0; i < 15; i++) {
    session = await stripeGet(`checkout/sessions/${sessionId}`)
    if (session.payment_status === 'paid') break
    await new Promise((r) => setTimeout(r, 2000))
  }
  if (session?.payment_status !== 'paid') throw new Error(`payment_status não confirmou 'paid' a tempo: ${session?.payment_status}`)
  const customerId = session.customer
  console.log('Pagamento confirmado. customerId:', customerId)

  return { userId, customerId }
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

  let subscriptionId = null
  for (const event of results) {
    const delivery = await deliverWebhook(event)
    console.log(`--- entregando ${event.type} (evt ${event.id}) ---`)
    console.log('HTTP', delivery.status, delivery.body.slice(0, 300))
    if (delivery.status >= 300) throw new Error(`Webhook rejeitou ${event.type}: HTTP ${delivery.status}`)
    if (event.type === 'customer.subscription.created') subscriptionId = event.data.object.id
  }
  if (subscriptionId) console.log('subscriptionId (para plan-change/cleanup):', subscriptionId)

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
  return { subscriptionId }
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

async function cmdPaymentFailed(customerId, userId, subscriptionId) {
  const planBefore = psql(`SELECT plan FROM public.profiles WHERE user_id = '${userId}'::uuid`)

  const event = {
    id: 'evt_e2e_paymentfailed_' + randomUUID().slice(0, 12),
    object: 'event',
    type: 'invoice.payment_failed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'in_e2e_' + randomUUID().slice(0, 8),
        object: 'invoice',
        customer: customerId,
        subscription: subscriptionId || null,
        amount_due: 3990,
        attempt_count: 1,
        billing_reason: 'subscription_cycle',
      },
    },
  }

  const delivery = await deliverWebhook(event)
  console.log('HTTP', delivery.status, delivery.body.slice(0, 200))
  if (delivery.status >= 300) throw new Error(`Webhook rejeitou invoice.payment_failed: HTTP ${delivery.status}`)

  const planAfter = psql(`SELECT plan FROM public.profiles WHERE user_id = '${userId}'::uuid`)
  console.log('profiles.plan antes/depois (não deve mudar):', planBefore, '->', planAfter)
  if (planBefore !== planAfter) throw new Error(`BUG: invoice.payment_failed alterou o plano (${planBefore} -> ${planAfter})`)

  const subRow = psql(`SELECT last_payment_failed_at FROM public.user_subscriptions WHERE user_id = '${userId}'::uuid ORDER BY updated_at DESC LIMIT 1`)
  console.log('user_subscriptions.last_payment_failed_at ->', subRow || '(vazio)')
  if (!subRow) throw new Error('BUG: last_payment_failed_at não foi registrado')

  console.log('OK: plano preservado e falha de pagamento registrada.')
}

async function cmdPlanChange(subscriptionId, newPriceId, userId, expectedPlan) {
  const current = await stripeGet(`subscriptions/${subscriptionId}`)
  const itemId = current.items.data[0]?.id
  if (!itemId) throw new Error(`Item da assinatura ${subscriptionId} não encontrado`)

  const planBefore = psql(`SELECT plan FROM public.profiles WHERE user_id = '${userId}'::uuid`)

  const updated = await stripePost(`subscriptions/${subscriptionId}`, {
    'items[0][id]': itemId,
    'items[0][price]': newPriceId,
    proration_behavior: 'none',
  })

  const event = {
    id: 'evt_e2e_planchange_' + randomUUID().slice(0, 12),
    object: 'event',
    type: 'customer.subscription.updated',
    created: Math.floor(Date.now() / 1000),
    data: { object: updated },
  }

  const delivery = await deliverWebhook(event)
  console.log('HTTP', delivery.status, delivery.body.slice(0, 200))
  if (delivery.status >= 300) throw new Error(`Webhook rejeitou customer.subscription.updated: HTTP ${delivery.status}`)

  const planAfter = psql(`SELECT plan FROM public.profiles WHERE user_id = '${userId}'::uuid`)
  console.log('profiles.plan:', planBefore, '->', planAfter)
  if (planAfter !== expectedPlan) throw new Error(`esperado plan=${expectedPlan} obtido=${planAfter}`)

  const subRow = psql(`SELECT plan_key, status FROM public.user_subscriptions WHERE user_id = '${userId}'::uuid ORDER BY updated_at DESC LIMIT 1`)
  console.log('user_subscriptions ->', subRow)
  const [subPlan] = subRow.split('|').map((s) => s.trim())
  if (subPlan !== expectedPlan) throw new Error(`user_subscriptions.plan_key esperado=${expectedPlan} obtido=${subPlan}`)

  console.log(`OK: assinatura migrada para ${expectedPlan}.`)
}

const PRICE_BY_PLAN = {
  essential: () => need('STRIPE_PRICE_ESSENTIAL'),
  plus: () => need('STRIPE_PRICE_PLUS_3990'),
}
const OTHER_PLAN = { essential: 'plus', plus: 'essential' }

async function cmdFullCycle(plan) {
  if (plan !== 'essential' && plan !== 'plus') throw new Error('plan deve ser essential ou plus')
  const otherPlan = OTHER_PLAN[plan]

  console.log(`\n########## 1/6 checkout-auto (${plan}) ##########`)
  const { userId, customerId } = await cmdCheckoutAuto(plan)

  console.log('\n########## 2/6 verify ##########')
  const { subscriptionId } = await cmdVerify(customerId, userId, plan)
  if (!subscriptionId) throw new Error('subscriptionId não encontrado após verify — plan-change/cleanup ficam sem alvo')

  console.log('\n########## 3/6 payment-failed ##########')
  await cmdPaymentFailed(customerId, userId, subscriptionId)

  console.log(`\n########## 4/6 plan-change: ${plan} -> ${otherPlan} ##########`)
  await cmdPlanChange(subscriptionId, PRICE_BY_PLAN[otherPlan](), userId, otherPlan)

  console.log(`\n########## 5/6 plan-change: ${otherPlan} -> ${plan} ##########`)
  await cmdPlanChange(subscriptionId, PRICE_BY_PLAN[plan](), userId, plan)

  console.log('\n########## 6/6 cleanup ##########')
  await cmdCleanup(userId, subscriptionId)
  await stripeDelete(`customers/${customerId}`).catch((err) => console.warn('Aviso ao remover customer:', err.message))
  console.log('Customer Stripe removido:', customerId)

  console.log('\nOK: ciclo completo (checkout, webhook, payment_failed, upgrade, downgrade, cleanup) passou sem erros.')
}

// Testa uma renovação REAL de assinatura (segundo ciclo de cobrança) usando
// Stripe Test Clocks — avança o relógio de teste da Stripe pra depois do fim
// do período atual, o que faz a Stripe faturar e cobrar de verdade (com o
// cartão de teste já salvo), gerando um invoice.payment_succeeded real com
// billing_reason=subscription_cycle. Não usa Checkout Hospedado (que não
// aceita test clock em customer já existente); cria o customer/assinatura
// direto pela API, como create-checkout faria, e replica manualmente o que
// checkout.session.completed normalmente grava (stripe_customer_id).
async function cmdRenewalCycle(plan) {
  const priceId = PRICE_BY_PLAN[plan]()
  const email = `stripe-e2e-renewal-${randomUUID().slice(0, 8)}@local.test`
  const password = `Stripe-${randomUUID()}-Aa1!`

  const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (createErr || !created.user) throw new Error(`Não foi possível criar usuário: ${createErr?.message}`)
  const userId = created.user.id

  console.log('=== Conta E2E criada ===')
  console.log('userId:', userId, '| email:', email)

  const clock = await stripePost('test_helpers/test_clocks', { frozen_time: Math.floor(Date.now() / 1000) })
  console.log('Test clock criado:', clock.id)

  const customer = await stripePost('customers', { email, test_clock: clock.id })
  // O token "pm_card_visa" é de uso único: anexar devolve um PaymentMethod
  // REAL com outro ID, que é o que precisa ser usado dali pra frente.
  const paymentMethod = await stripePost(`payment_methods/pm_card_visa/attach`, { customer: customer.id })
  await stripePost(`customers/${customer.id}`, { 'invoice_settings[default_payment_method]': paymentMethod.id })

  // Replica o que checkout.session.completed grava normalmente, já que aqui
  // pulamos o Checkout Hospedado (test clock só funciona em customer criado
  // já vinculado a ele).
  psql(`UPDATE public.profiles SET stripe_customer_id = '${customer.id}' WHERE user_id = '${userId}'::uuid`)

  const subscription = await stripePost('subscriptions', {
    customer: customer.id,
    'items[0][price]': priceId,
    default_payment_method: paymentMethod.id,
  })
  console.log('Assinatura criada (1º ciclo):', subscription.id, '| status:', subscription.status)

  // Entrega o evento do 1º ciclo pra estabelecer o baseline (equivalente ao
  // que verify faz depois de um Checkout real). Busca a fatura direto no
  // customer (em vez de procurar na lista global de eventos — mais
  // confiável, sem depender de ordenação/crowding de outros eventos da
  // conta) e embrulha o objeto REAL num envelope de evento, como já é feito
  // em plan-change.
  const firstInvoice = await fetchLatestInvoice(customer.id, 'subscription_create')
  const firstInvoiceEvent = wrapAsEvent('invoice.payment_succeeded', firstInvoice)
  const firstDelivery = await deliverWebhook(firstInvoiceEvent)
  if (firstDelivery.status >= 300) throw new Error(`Webhook rejeitou o 1º invoice.payment_succeeded: HTTP ${firstDelivery.status}`)
  console.log('1º ciclo confirmado. billing_reason:', firstInvoice.billing_reason)

  const beforePeriodEnd = psql(`SELECT current_period_end FROM public.user_subscriptions WHERE user_id = '${userId}'::uuid`)
  const planEventsBefore = psql(`SELECT count(*) FROM public.subscription_events WHERE user_id = '${userId}'::uuid AND event_type = 'subscription_renewed'`)

  // Avança o relógio pra depois do fim do período atual — a Stripe fatura e
  // cobra de verdade nesse momento, gerando o 2º invoice.payment_succeeded.
  const currentSub = await stripeGet(`subscriptions/${subscription.id}`)
  const advanceTo = subPeriodEndOf(currentSub) + 3600
  console.log('Avançando o test clock para depois do fim do período atual...')
  await stripePost(`test_helpers/test_clocks/${clock.id}/advance`, { frozen_time: advanceTo })
  await waitForClockReady(clock.id)

  const renewalInvoice = await fetchLatestInvoice(customer.id, 'subscription_cycle')
  if (renewalInvoice.id === firstInvoice.id) throw new Error('Ainda não há uma 2ª fatura — o test clock avançou o suficiente?')
  const renewalEvent = wrapAsEvent('invoice.payment_succeeded', renewalInvoice)
  console.log('Fatura de renovação real encontrada:', renewalInvoice.id, '| billing_reason:', renewalInvoice.billing_reason)

  const renewalDelivery = await deliverWebhook(renewalEvent)
  console.log('HTTP', renewalDelivery.status, renewalDelivery.body.slice(0, 200))
  if (renewalDelivery.status >= 300) throw new Error(`Webhook rejeitou a renovação: HTTP ${renewalDelivery.status}`)

  // ---- Verificações -------------------------------------------------------
  const planAfter = psql(`SELECT plan FROM public.profiles WHERE user_id = '${userId}'::uuid`)
  assertRenewal(planAfter === plan, `profiles.plan deveria continuar '${plan}' após a renovação, obtido '${planAfter}'`)

  const afterPeriodEnd = psql(`SELECT current_period_end FROM public.user_subscriptions WHERE user_id = '${userId}'::uuid`)
  assertRenewal(afterPeriodEnd !== beforePeriodEnd, `current_period_end deveria avançar após a renovação (antes=${beforePeriodEnd}, depois=${afterPeriodEnd})`)

  const paymentEventRow = psql(`SELECT description FROM public.payment_events WHERE user_id = '${userId}'::uuid AND provider_payment_id = '${renewalEvent.data.object.id}'`)
  assertRenewal(/^Renovação/.test(paymentEventRow ?? ''), `payment_events.description deveria começar com "Renovação", obtido: ${paymentEventRow}`)

  const planEventsAfter = psql(`SELECT count(*) FROM public.subscription_events WHERE user_id = '${userId}'::uuid AND event_type = 'subscription_renewed'`)
  assertRenewal(Number(planEventsAfter) === Number(planEventsBefore) + 1, `subscription_events deveria ganhar exatamente 1 linha 'subscription_renewed' (antes=${planEventsBefore}, depois=${planEventsAfter})`)

  const notifRow = psql(`SELECT title FROM public.notifications WHERE user_id = '${userId}'::uuid AND title = 'Pagamento confirmado' ORDER BY created_at DESC LIMIT 1`)
  assertRenewal(notifRow === 'Pagamento confirmado', 'notificação de renovação não foi criada')

  // Conteúdo do e-mail: mesmo sem RESEND_API_KEY local, o assunto já é
  // renderizado com as variáveis ANTES de falhar por falta de provedor —
  // dá pra confirmar que o template foi preenchido de verdade, não deixado
  // com {{placeholders}} crus.
  const emailLogRow = psql(`SELECT subject FROM public.email_logs WHERE user_id = '${userId}'::uuid AND template_key = 'payment_confirmed' AND idempotency_key = 'payment_confirmed:${renewalEvent.data.object.id}'`)
  assertRenewal(Boolean(emailLogRow), 'email_logs não registrou o e-mail de payment_confirmed da renovação')
  assertRenewal(!/\{\{/.test(emailLogRow ?? ''), `assunto do e-mail ainda tem placeholders não substituídos: ${emailLogRow}`)
  console.log('Assunto renderizado do e-mail de renovação:', emailLogRow)

  console.log('\nOK: renovação real (test clock) confirmada — plano mantido, período avançado, payment_events/subscription_events/notifications/email_logs corretos.')

  await stripeDelete(`subscriptions/${subscription.id}`).catch(() => {})
  await stripeDelete(`test_helpers/test_clocks/${clock.id}`).catch((err) => console.warn('Aviso ao remover test clock:', err.message))
  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) console.warn('Aviso ao remover usuário:', delErr.message)
  else console.log('Usuário E2E removido:', userId)
}

async function fetchLatestInvoice(customerId, billingReason) {
  for (let i = 0; i < 10; i++) {
    const list = await stripeGet('invoices', { customer: customerId, limit: '10' })
    const match = list.data.find((inv) => inv.billing_reason === billingReason && inv.status === 'paid')
    if (match) return match
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`Nenhuma fatura paga com billing_reason=${billingReason} encontrada a tempo para customer ${customerId}`)
}

function wrapAsEvent(type, object) {
  return { id: 'evt_e2e_' + randomUUID().slice(0, 16), object: 'event', type, created: Math.floor(Date.now() / 1000), data: { object } }
}

function assertRenewal(condition, message) {
  if (!condition) throw new Error(message)
}

function subPeriodEndOf(subscription) {
  const legacy = subscription.current_period_end
  if (typeof legacy === 'number') return legacy
  const item = subscription.items?.data?.[0]?.current_period_end
  if (typeof item === 'number') return item
  throw new Error('current_period_end ausente na Subscription retornada pela API')
}

async function waitForClockReady(clockId) {
  for (let i = 0; i < 30; i++) {
    const clock = await stripeGet(`test_helpers/test_clocks/${clockId}`)
    if (clock.status === 'ready') return
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('Test clock não ficou "ready" a tempo')
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
  else if (command === 'checkout-auto') await cmdCheckoutAuto(args[0])
  else if (command === 'full-cycle') await cmdFullCycle(args[0])
  else if (command === 'verify') await cmdVerify(args[0], args[1], args[2])
  else if (command === 'edge-cases') await cmdEdgeCases(args[0], args[1])
  else if (command === 'payment-failed') await cmdPaymentFailed(args[0], args[1], args[2])
  else if (command === 'plan-change') await cmdPlanChange(args[0], args[1], args[2], args[3])
  else if (command === 'renewal-cycle') await cmdRenewalCycle(args[0])
  else if (command === 'cleanup') await cmdCleanup(args[0], args[1])
  else {
    console.error('Uso: checkout <plan> | checkout-auto <plan> | full-cycle <plan> | verify <customerId> <userId> <plan> | edge-cases <customerId> <userId> | payment-failed <customerId> <userId> [subscriptionId] | plan-change <subscriptionId> <newPriceId> <userId> <expectedPlan> | renewal-cycle <plan> | cleanup <userId> [subscriptionId]')
    process.exit(1)
  }
} catch (err) {
  console.error('ERRO:', err.message)
  process.exit(1)
}
