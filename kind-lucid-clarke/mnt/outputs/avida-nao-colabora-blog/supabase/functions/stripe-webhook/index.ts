import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
})

type PaidPlan = 'essential' | 'plus'

// Mapeia Price ID → plano oficial. Prices legados do antigo Terapêutico continuam
// mapeados para Plus para não quebrar renovação de assinantes existentes.
function buildPlanByPrice(): Record<string, PaidPlan> {
  const map: Record<string, PaidPlan> = {}
  const essential = Deno.env.get('STRIPE_PRICE_ESSENTIAL')
  const plusNew = Deno.env.get('STRIPE_PRICE_PLUS_3990')
  const therapeutic = Deno.env.get('STRIPE_PRICE_THERAPEUTIC')
  const plusLegacy = Deno.env.get('STRIPE_PRICE_PLUS')
  if (essential) map[essential] = 'essential'
  if (plusNew) map[plusNew] = 'plus'
  if (therapeutic) map[therapeutic] = 'plus'
  if (plusLegacy) map[plusLegacy] = 'plus'
  return map
}
const PLAN_BY_PRICE = buildPlanByPrice()

function planFromPrice(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null
  return PLAN_BY_PRICE[priceId] ?? null
}

function stripeId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

const SITE = Deno.env.get('SITE_URL') || Deno.env.get('APP_URL') || 'https://avidanaocolabora.com'

const PLAN_BENEFITS: Record<string, string> = {
  essential:
    '- Diário ilimitado\n- Mapa emocional completo com histórico e gráficos\n- Conteúdos guiados completos\n- Relatório semanal automático',
  plus:
    '- Tudo do Essencial\n- Plano de autocuidado mensal\n- Relatório mensal aprofundado\n- Comentário profissional mensal\n- Orientação mensal por mensagem',
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  essential: 'Essencial',
  plus: 'Plus',
  therapeutic: 'Plus',
  'therapeutic-plus': 'Plus',
}
const planLabel = (p: string | null | undefined): string => (p && PLAN_LABELS[p]) || p || ''

const PLAN_RANK: Record<string, number> = { free: 0, essential: 1, plus: 2, therapeutic: 2, 'therapeutic-plus': 2 }
const rankOf = (p: string | null | undefined): number => (p && PLAN_RANK[p]) ?? 0

const BILLING_TZ = 'America/Sao_Paulo'
const fmtBR = (iso: string): string => {
  const d = new Date(iso)
  const dataDeCalendario = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  return d.toLocaleDateString('pt-BR', { timeZone: dataDeCalendario ? 'UTC' : BILLING_TZ })
}

// O payload do webhook usa a versão da API da conta. Aceita o formato antigo e o
// atual para localizar a assinatura vinculada à invoice.
function invoiceSubId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } }).subscription
  if (legacy) return typeof legacy === 'string' ? legacy : legacy.id
  const parent = (invoice as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id: string } } }
  }).parent
  const novo = parent?.subscription_details?.subscription
  if (novo) return typeof novo === 'string' ? novo : novo.id
  return null
}

async function registrarEvento(
  supabase: ReturnType<typeof createClient>,
  event: Stripe.Event,
  eventType: string,
  dados: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('subscription_events').insert({
    stripe_event_id: event.id,
    event_type: eventType,
    currency: 'BRL',
    occurred_at: new Date(event.created * 1000).toISOString(),
    ...dados,
  })
  if (error && String(error.code) !== '23505') {
    console.error(`subscription_events (${eventType}):`, error.message)
  }
}

function must(err: { message: string } | null, contexto: string): void {
  if (err) throw new Error(`${contexto}: ${err.message}`)
}

function subFields(s: Stripe.Subscription): Record<string, unknown> {
  const price = s.items.data[0]?.price
  return {
    price_id: price?.id ?? null,
    product_id: (price?.product as string) ?? null,
    canceled_at: s.canceled_at ? new Date(s.canceled_at * 1000).toISOString() : null,
    trial_end: s.trial_end ? new Date(s.trial_end * 1000).toISOString() : null,
    payment_status: s.status,
  }
}

function stripeSubscriptionFields(s: Stripe.Subscription, customerId: string): Record<string, unknown> {
  return {
    provider: 'stripe',
    provider_customer_id: customerId,
    provider_subscription_id: s.id,
    ...subFields(s),
  }
}

async function sendTxEmail(
  templateKey: string,
  toEmail: string | null | undefined,
  variables: Record<string, unknown>,
  idempotencyKey: string,
  userId?: string | null,
): Promise<void> {
  if (!toEmail) return
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    await fetch(`${url}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId ?? null, to_email: toEmail, template_key: templateKey, variables, idempotency_key: idempotencyKey }),
    })
  } catch (e) {
    console.error('sendTxEmail falhou:', templateKey, (e as Error).message)
  }
}

async function getRecipient(supabase: ReturnType<typeof createClient>, userId: string): Promise<{ email?: string; nome: string }> {
  const { data } = await supabase.from('profiles').select('email, full_name').eq('user_id', userId).maybeSingle()
  const row = data as { email?: string; full_name?: string } | null
  return { email: row?.email ?? undefined, nome: row?.full_name || 'você' }
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!signature || !webhookSecret) {
    return new Response('Configuração de webhook incompleta', { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature inválida:', (err as Error).message)
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Reserva idempotente antes do processamento. Em falha crítica, a reserva é
  // removida para permitir que o Stripe reentregue o mesmo evento.
  const dedup = await supabase
    .from('stripe_webhook_events')
    .insert({ stripe_event_id: event.id, event_type: event.type })
  let claimed = true
  if (dedup.error) {
    if (String(dedup.error.code) === '23505' || /duplicate|unique/i.test(dedup.error.message)) {
      console.log(`webhook: evento ${event.id} já reservado/processado — ignorado`)
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    console.error('stripe_webhook_events: falha ao registrar (segue processando):', dedup.error.message)
    claimed = false
  }

  try {
    const response = await handleEvent(event, supabase)

    // A tabela já possui status/processed_at; antes esta transição nunca era feita,
    // deixando eventos processados presos em "processing" no diagnóstico.
    if (claimed) {
      const { error: doneErr } = await supabase
        .from('stripe_webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString(), error_message: null })
        .eq('stripe_event_id', event.id)
      if (doneErr) console.error('stripe_webhook_events: falha ao marcar processed:', doneErr.message)
    }

    return response
  } catch (err) {
    console.error(`webhook: falha ao processar ${event.type} (${event.id}):`, (err as Error).message)
    if (claimed) {
      const { error: relErr } = await supabase
        .from('stripe_webhook_events').delete().eq('stripe_event_id', event.id)
      if (relErr) console.error('webhook: falha ao liberar reserva:', relErr.message)
    }
    return new Response(JSON.stringify({ error: 'processing_failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})

async function handleEvent(
  event: Stripe.Event,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  // Pagamento confirmado via Checkout: o Price da Subscription é a fonte da
  // verdade do plano. A metadata identifica o usuário e serve de cross-check.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const sessionUserId = session.metadata?.supabase_user_id
    const requestedPlan = session.metadata?.plan
    const subscriptionId = stripeId(session.subscription)

    if (!sessionUserId || !subscriptionId) {
      console.error('checkout.session.completed: user_id ou subscription ausente; acesso não liberado')
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Falha de leitura do Stripe é transitória: lança para o endpoint devolver 5xx
    // e receber retry, em vez de liberar acesso com dados incompletos.
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
    const priceId = stripeSub.items.data[0]?.price.id
    const plan = planFromPrice(priceId)
    const customerId = stripeId(session.customer) || stripeId(stripeSub.customer)
    const subscriptionUserId = stripeSub.metadata?.supabase_user_id

    if (!plan || !customerId) {
      console.error(`checkout.session.completed: Price ID "${priceId}" não mapeado ou customer ausente; acesso não liberado`)
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }
    if (subscriptionUserId && subscriptionUserId !== sessionUserId) {
      console.error('checkout.session.completed: user_id da Session diverge da Subscription; acesso não liberado')
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }
    if (requestedPlan && requestedPlan !== plan) {
      console.error(`checkout.session.completed: metadata plan="${requestedPlan}" diverge do Price; usando plano verificado "${plan}"`)
    }

    const userId = sessionUserId
    const { data: prevProfile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('user_id', userId)
      .single()
    const oldPlan = prevProfile?.plan ?? 'free'

    const activatedAt = new Date(event.created * 1000).toISOString()
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ plan, plan_activated_at: activatedAt })
      .eq('user_id', userId)
    must(profileErr, 'profiles.plan (checkout)')

    const periodStart = new Date(stripeSub.current_period_start * 1000).toISOString()
    const periodEnd = new Date(stripeSub.current_period_end * 1000).toISOString()

    const { error: subErr } = await supabase.from('user_subscriptions').upsert({
      user_id: userId,
      plan_key: plan,
      status: 'active',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      pending_plan: null,
      pending_plan_starts_at: null,
      subscription_created_at: new Date(stripeSub.created * 1000).toISOString(),
      ...stripeSubscriptionFields(stripeSub, customerId),
    }, { onConflict: 'user_id' })
    must(subErr, 'user_subscriptions (checkout)')

    const { error: histErr } = await supabase.from('plan_change_history').insert({
      user_id: userId,
      old_plan: oldPlan,
      new_plan: plan,
      change_type: 'upgrade',
      amount_charged: (session.amount_total ?? 0) / 100,
      effective_at: periodStart,
      source: 'stripe_webhook',
      notes: `Pagamento confirmado via checkout. Session: ${session.id}`,
    })
    if (histErr) console.error('Erro ao inserir plan_change_history (checkout):', histErr)

    await registrarEvento(supabase, event, 'checkout_completed', {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSub.id,
      previous_plan: oldPlan,
      new_plan: plan,
      amount: (session.amount_total ?? 0) / 100,
      status: 'confirmed',
      metadata: {
        session_id: session.id,
        price_id: priceId,
        requested_plan: requestedPlan ?? null,
        period_start: periodStart,
        period_end: periodEnd,
      },
    })

    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Assinatura ativada com sucesso!',
      body: 'Seu plano foi ativado. Aproveite todos os recursos do seu novo plano.',
      type: 'info',
      action_url: 'my-plan', destination_path: 'my-plan',
    })
    if (notifErr) console.error('Erro ao criar notificação (checkout):', notifErr)

    console.log(`checkout.session.completed: plano "${plan}" verificado pelo Price e ativado para usuário ${userId}`)

    const { email, nome } = await getRecipient(supabase, userId)
    const valor = ((session.amount_total ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    await sendTxEmail('payment_confirmed', email, {
      nome, plano: planLabel(plan), valor,
      data_pagamento: fmtBR(activatedAt),
      inicio_ciclo: fmtBR(periodStart),
      fim_ciclo: fmtBR(periodEnd),
      link_meu_plano: `${SITE}/meu-plano`,
    }, `payment_confirmed:${session.id}`, userId)
    if (oldPlan === 'free') {
      await sendTxEmail('plan_activated', email, { nome, plano: planLabel(plan), beneficios_do_plano: PLAN_BENEFITS[plan] ?? '', link_meu_plano: `${SITE}/meu-plano` }, `plan_activated:${session.id}`, userId)
    } else if (oldPlan !== plan) {
      await sendTxEmail('plan_upgraded', email, { nome, plano_antigo: planLabel(oldPlan), plano_novo: planLabel(plan), link_meu_plano: `${SITE}/meu-plano` }, `plan_upgraded:${session.id}`, userId)
    }
  }

  // Pagamento de invoice: renova acesso e registra a trilha financeira completa.
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice
    const invSubId = invoiceSubId(invoice)
    if (!invSubId) {
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const subscription = await stripe.subscriptions.retrieve(invSubId)
    const priceId = subscription.items.data[0]?.price.id
    const plan = planFromPrice(priceId)
    const customerId = stripeId(subscription.customer)

    if (!plan || !customerId) {
      console.error(`invoice.payment_succeeded: Price ID "${priceId}" não mapeado ou customer ausente. Plano NÃO atualizado.`)
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const { data: profileData, error: profileLookupErr } = await supabase
      .from('profiles')
      .select('user_id, plan')
      .eq('stripe_customer_id', customerId)
      .single()

    if (profileLookupErr || !profileData) {
      console.error(`invoice.payment_succeeded: perfil não encontrado para customer ${customerId}`)
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const userId = profileData.user_id
    const oldPlan = profileData.plan

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('stripe_customer_id', customerId)
    must(profileErr, 'profiles.plan (invoice)')

    const periodStart = new Date(subscription.current_period_start * 1000).toISOString()
    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString()
    const pagoEm = new Date(event.created * 1000).toISOString()
    const valorPago = (invoice.amount_paid ?? 0) / 100

    const { data: savedSub, error: subErr } = await supabase.from('user_subscriptions').upsert({
      user_id: userId,
      plan_key: plan,
      status: 'active',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      last_payment_confirmed_at: pagoEm,
      last_payment_amount: valorPago,
      subscription_created_at: new Date(subscription.created * 1000).toISOString(),
      ...stripeSubscriptionFields(subscription, customerId),
    }, { onConflict: 'user_id' }).select('id').single()
    must(subErr, 'user_subscriptions (invoice)')

    const renovacao = invoice.billing_reason === 'subscription_cycle'
    await registrarEvento(supabase, event, renovacao ? 'subscription_renewed' : 'payment_confirmed', {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_invoice_id: invoice.id,
      previous_plan: oldPlan,
      new_plan: plan,
      amount: valorPago,
      status: 'confirmed',
      metadata: { billing_reason: invoice.billing_reason, price_id: priceId, period_end: periodEnd },
    })

    const currency = String(invoice.currency || 'brl').toUpperCase()
    const { error: payErr } = await supabase.from('payment_events').insert({
      user_id: userId,
      subscription_id: savedSub?.id ?? null,
      plan_key: plan,
      type: 'monthly_payment',
      amount: valorPago,
      currency,
      status: 'succeeded',
      provider: 'stripe',
      provider_payment_id: invoice.id,
      description: `${renovacao ? 'Renovação' : 'Pagamento'} ${plan} — ${fmtBR(periodStart)}`,
      created_at: pagoEm,
    })
    must(payErr, 'payment_events (invoice)')

    if (oldPlan !== plan) {
      const { error: histErr } = await supabase.from('plan_change_history').insert({
        user_id: userId,
        old_plan: oldPlan,
        new_plan: plan,
        change_type: 'upgrade',
        amount_charged: valorPago,
        effective_at: periodStart,
        source: 'stripe_webhook',
        notes: `Mudança de plano via renovação de assinatura. Invoice: ${invoice.id}`,
      })
      if (histErr) console.error('Erro ao inserir plan_change_history (invoice):', histErr)
    }

    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Pagamento confirmado',
      body: 'Sua assinatura foi renovada com sucesso.',
      type: 'info',
      action_url: 'my-plan', destination_path: 'my-plan',
    })
    if (notifErr) console.error('Erro ao criar notificação (invoice):', notifErr)

    console.log(`invoice.payment_succeeded: plano "${plan}" renovado para customer ${customerId} (user ${userId})`)

    const { email: rEmail, nome: rNome } = await getRecipient(supabase, userId)
    const rValor = valorPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    await sendTxEmail('payment_confirmed', rEmail, {
      nome: rNome, plano: planLabel(plan), valor: rValor,
      data_pagamento: fmtBR(pagoEm),
      inicio_ciclo: fmtBR(periodStart),
      fim_ciclo: fmtBR(periodEnd),
      link_meu_plano: `${SITE}/meu-plano`,
    }, `payment_confirmed:${invoice.id}`, userId)
  }

  // Assinatura criada: sincroniza a referência do Stripe. A ativação vem do
  // checkout.session.completed para evitar e-mails/benefícios duplicados.
  if (event.type === 'customer.subscription.created') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = stripeId(subscription.customer)
    const plan = planFromPrice(subscription.items.data[0]?.price.id)
    if (!customerId || !plan) {
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }
    const { data: prof } = await supabase.from('profiles').select('user_id').eq('stripe_customer_id', customerId).maybeSingle()
    const userId = (prof as { user_id?: string } | null)?.user_id ?? null
    if (userId) {
      const { error: subErr } = await supabase.from('user_subscriptions').upsert({
        user_id: userId,
        plan_key: plan,
        status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        subscription_created_at: new Date(subscription.created * 1000).toISOString(),
        ...stripeSubscriptionFields(subscription, customerId),
      }, { onConflict: 'user_id' })
      if (subErr) console.error('Erro user_subscriptions (sub.created):', subErr)

      await registrarEvento(supabase, event, 'subscription_created', {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        new_plan: plan,
        status: subscription.status,
        metadata: { trial_end: subscription.trial_end, price_id: subscription.items.data[0]?.price.id },
      })
    }
    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  // Subscription.updated é a confirmação do Stripe para upgrade/downgrade e
  // também sincroniza alterações de status/ciclo sem confiar no front-end.
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = stripeId(subscription.customer)
    const priceId = subscription.items.data[0]?.price.id
    const newPlan = planFromPrice(priceId)

    if (!customerId || !newPlan) {
      console.error(`subscription.updated: customer ou price não mapeado (price ${priceId})`)
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const { data: prof } = await supabase
      .from('profiles').select('user_id, plan').eq('stripe_customer_id', customerId).maybeSingle()
    const profRow = prof as { user_id?: string; plan?: string } | null
    const userId = profRow?.user_id ?? null

    if (!userId) {
      console.error(`subscription.updated: usuário não encontrado para customer ${customerId}`)
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const oldPlan = profRow?.plan ?? 'free'
    const periodStart = new Date(subscription.current_period_start * 1000).toISOString()
    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString()
    const active = subscription.status === 'active' || subscription.status === 'trialing'

    const { error: subErr } = await supabase.from('user_subscriptions').upsert({
      user_id: userId,
      plan_key: newPlan,
      status: active ? 'active' : subscription.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      ...stripeSubscriptionFields(subscription, customerId),
    }, { onConflict: 'user_id' })
    if (subErr) console.error('Erro user_subscriptions (sub.updated):', subErr)

    if (active) {
      const { error: pErr } = await supabase.from('profiles').update({ plan: newPlan }).eq('user_id', userId)
      if (pErr) console.error('Erro profiles.plan (sub.updated):', pErr)
    }

    if (newPlan !== oldPlan && active) {
      const isUpgrade = rankOf(newPlan) > rankOf(oldPlan)
      if (isUpgrade) {
        await supabase.from('profiles').update({ plan_activated_at: new Date(event.created * 1000).toISOString() }).eq('user_id', userId)
      }
      await supabase.from('plan_change_history').insert({
        user_id: userId, old_plan: oldPlan, new_plan: newPlan,
        change_type: isUpgrade ? 'upgrade' : 'downgrade',
        amount_charged: 0, effective_at: new Date(event.created * 1000).toISOString(),
        source: 'stripe_webhook', notes: `subscription.updated — sub ${subscription.id}`,
      }).then(({ error }) => { if (error) console.error('hist (sub.updated):', error) })

      await registrarEvento(supabase, event, isUpgrade ? 'upgrade_confirmed' : 'downgrade_completed', {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        previous_plan: oldPlan,
        new_plan: newPlan,
        status: subscription.status,
        metadata: { price_id: priceId, period_end: periodEnd },
      })

      if (!isUpgrade) {
        await supabase.from('subscription_change_feedback')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('user_id', userId).eq('change_type', 'downgrade').eq('status', 'scheduled')
          .then(({ error }) => { if (error) console.error('feedback downgrade completed:', error) })
      }

      const { email, nome } = await getRecipient(supabase, userId)
      if (isUpgrade) {
        await sendTxEmail('plan_upgraded', email, {
          nome, plano_antigo: planLabel(oldPlan), plano_novo: planLabel(newPlan), link_meu_plano: `${SITE}/meu-plano`,
        }, `plan_upgraded:${subscription.id}:${newPlan}`, userId)
      }
      await supabase.from('notifications').insert({
        user_id: userId,
        title: isUpgrade ? 'Plano atualizado' : 'Plano alterado',
        body: `Seu plano agora é ${planLabel(newPlan)}.`,
        type: 'info', action_url: 'my-plan', destination_path: 'my-plan',
      }).then(({ error }) => { if (error) console.error('notif (sub.updated):', error) })
    }

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = stripeId(subscription.customer)
    if (!customerId) {
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const { data: subData } = await supabase
      .from('user_subscriptions')
      .select('user_id, pending_plan, plan_key')
      .eq('provider_subscription_id', subscription.id)
      .maybeSingle()

    let userId: string | null = subData?.user_id ?? null
    if (!userId) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single()
      userId = profileData?.user_id ?? null
    }

    if (!userId) {
      console.error(`customer.subscription.deleted: usuário não encontrado para customer ${customerId}`)
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const finalPlan = 'free'
    const oldPlan = subData?.plan_key ?? 'unknown'

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ plan: finalPlan })
      .eq('user_id', userId)
    must(profileErr, 'profiles.plan (deleted)')

    const { error: subErr } = await supabase.from('user_subscriptions').update({
      plan_key: finalPlan,
      status: 'cancelled',
      cancel_at_period_end: false,
      pending_plan: null,
      pending_plan_starts_at: null,
      provider: 'stripe',
      provider_customer_id: customerId,
      provider_subscription_id: subscription.id,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date(event.created * 1000).toISOString(),
      payment_status: 'canceled',
    }).eq('user_id', userId)

    await registrarEvento(supabase, event, 'cancellation_completed', {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      previous_plan: oldPlan,
      new_plan: finalPlan,
      status: 'canceled',
      metadata: { canceled_at: subscription.canceled_at, ended_at: subscription.ended_at },
    })

    await supabase.from('subscription_change_feedback')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('change_type', 'cancellation').eq('status', 'scheduled')
      .then(({ error }) => { if (error) console.error('feedback cancel completed:', error) })
    must(subErr, 'user_subscriptions (deleted)')

    const { error: histErr } = await supabase.from('plan_change_history').insert({
      user_id: userId,
      old_plan: oldPlan,
      new_plan: finalPlan,
      change_type: 'cancel',
      amount_charged: 0,
      effective_at: new Date(event.created * 1000).toISOString(),
      source: 'stripe_webhook',
      notes: `Assinatura Stripe encerrada. Sub: ${subscription.id}`,
    })
    if (histErr) console.error('Erro ao inserir plan_change_history (deleted):', histErr)

    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Assinatura encerrada',
      body: 'Sua assinatura foi encerrada. Você continua com acesso ao plano Gratuito.',
      type: 'info',
      action_url: 'my-plan', destination_path: 'my-plan',
    })
    if (notifErr) console.error('Erro ao criar notificação (deleted):', notifErr)

    console.log(`customer.subscription.deleted: plano revertido para "${finalPlan}" — customer ${customerId} (user ${userId})`)

    const { email: dEmail, nome: dNome } = await getRecipient(supabase, userId)
    await sendTxEmail('plan_returned_to_free', dEmail, {
      nome: dNome, plano_anterior: oldPlan, link_meu_plano: `${SITE}/meu-plano`,
    }, `plan_returned_to_free:${subscription.id}`, userId)
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const customerId = stripeId(invoice.customer)
    if (!customerId) {
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('user_id, plan, email, full_name')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    const p = prof as { user_id?: string; plan?: string; email?: string; full_name?: string } | null

    if (p?.user_id) {
      const falhouEm = new Date(event.created * 1000).toISOString()
      await supabase.from('user_subscriptions')
        .update({ last_payment_failed_at: falhouEm, provider: 'stripe', provider_customer_id: customerId })
        .eq('user_id', p.user_id)
        .then(({ error }) => { if (error) console.error('last_payment_failed_at:', error.message) })

      await registrarEvento(supabase, event, 'payment_failed', {
        user_id: p.user_id,
        stripe_customer_id: customerId,
        stripe_subscription_id: invoiceSubId(invoice),
        stripe_invoice_id: invoice.id,
        previous_plan: p.plan ?? null,
        new_plan: p.plan ?? null,
        amount: (invoice.amount_due ?? 0) / 100,
        status: 'failed',
        metadata: { attempt_count: invoice.attempt_count ?? null, billing_reason: invoice.billing_reason },
      })
    }

    if (p?.email) {
      await sendTxEmail('payment_failed', p.email, {
        nome: p.full_name || 'você', plano: p.plan || '', link_pagamento: `${SITE}/meu-plano`,
      }, `payment_failed:${invoice.id}`, p.user_id)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
