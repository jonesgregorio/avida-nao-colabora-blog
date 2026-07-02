import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
})

// Mapeia Price ID → nome do plano interno
// Configure obrigatoriamente no Supabase Dashboard → Edge Functions → Secrets:
//   STRIPE_PRICE_ESSENTIAL, STRIPE_PRICE_THERAPEUTIC, STRIPE_PRICE_PLUS
function buildPlanByPrice(): Record<string, string> {
  const map: Record<string, string> = {}
  const essential = Deno.env.get('STRIPE_PRICE_ESSENTIAL')
  const therapeutic = Deno.env.get('STRIPE_PRICE_THERAPEUTIC')
  const plus = Deno.env.get('STRIPE_PRICE_PLUS')
  if (essential) map[essential] = 'essential'
  if (therapeutic) map[therapeutic] = 'therapeutic'
  if (plus) map[plus] = 'therapeutic-plus'
  return map
}
const PLAN_BY_PRICE = buildPlanByPrice()

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
  } catch (err: any) {
    console.error('Webhook signature inválida:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ────────────────────────────────────────────────────────────
  // Pagamento confirmado via checkout → ativa o plano
  // ────────────────────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.supabase_user_id
    const plan = session.metadata?.plan

    if (!userId || !plan) {
      console.error('checkout.session.completed: metadata supabase_user_id ou plan ausente')
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Busca plano anterior ANTES de atualizar
    const { data: prevProfile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('user_id', userId)
      .single()
    const oldPlan = prevProfile?.plan ?? 'free'

    // Atualiza plano em profiles
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('user_id', userId)
    if (profileErr) console.error('Erro ao atualizar profiles.plan (checkout):', profileErr)

    // Busca dados da assinatura Stripe se disponível
    let stripeSub: Stripe.Subscription | null = null
    if (session.subscription) {
      try {
        stripeSub = await stripe.subscriptions.retrieve(session.subscription as string)
      } catch (e: any) {
        console.error('Erro ao buscar subscription Stripe (checkout):', e.message)
      }
    }

    const periodStart = stripeSub
      ? new Date(stripeSub.current_period_start * 1000).toISOString()
      : new Date().toISOString()
    const periodEnd = stripeSub
      ? new Date(stripeSub.current_period_end * 1000).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString()

    // Upsert user_subscriptions
    const { error: subErr } = await supabase.from('user_subscriptions').upsert({
      user_id: userId,
      plan_key: plan,
      status: 'active',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      pending_plan: null,
      pending_plan_starts_at: null,
      provider_subscription_id: stripeSub?.id ?? null,
    }, { onConflict: 'user_id' })
    if (subErr) console.error('Erro ao upsert user_subscriptions (checkout):', subErr)

    // Registra no histórico de mudanças
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

    // Cria notificação para o usuário
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Assinatura ativada com sucesso!',
      body: `Seu plano foi ativado. Aproveite todos os recursos do seu novo plano.`,
      type: 'info',
      action_view: 'my-plan',
    })
    if (notifErr) console.error('Erro ao criar notificação (checkout):', notifErr)

    console.log(`checkout.session.completed: plano "${plan}" ativado para usuário ${userId}`)
  }

  // ────────────────────────────────────────────────────────────
  // Assinatura renovada → garante que o plano continua ativo
  // ────────────────────────────────────────────────────────────
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice
    if (!invoice.subscription) {
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
    const priceId = subscription.items.data[0]?.price.id
    const plan = PLAN_BY_PRICE[priceId]
    const customerId = subscription.customer as string

    if (!plan) {
      console.error(`invoice.payment_succeeded: Price ID "${priceId}" não mapeado — nenhuma env var correspondente configurada. Plano NÃO atualizado.`)
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Busca user_id pelo stripe_customer_id
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

    // Atualiza profiles.plan
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('stripe_customer_id', customerId)
    if (profileErr) console.error('Erro ao renovar profiles.plan:', profileErr)

    const periodStart = new Date(subscription.current_period_start * 1000).toISOString()
    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString()

    // Upsert user_subscriptions com datas do ciclo
    const { error: subErr } = await supabase.from('user_subscriptions').upsert({
      user_id: userId,
      plan_key: plan,
      status: 'active',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      provider_subscription_id: subscription.id,
    }, { onConflict: 'user_id' })
    if (subErr) console.error('Erro ao upsert user_subscriptions (invoice):', subErr)

    // Registra pagamento em payment_events
    const { error: payErr } = await supabase.from('payment_events').insert({
      user_id: userId,
      type: 'monthly_payment',
      amount: (invoice.amount_paid ?? 0) / 100,
      provider_payment_id: invoice.id,
      description: `Renovação ${plan} — ${new Date(periodStart).toLocaleDateString('pt-BR')}`,
    })
    if (payErr) console.error('Erro ao inserir payment_events:', payErr)

    // Só registra no histórico de plano se houve mudança de plano
    if (oldPlan !== plan) {
      const { error: histErr } = await supabase.from('plan_change_history').insert({
        user_id: userId,
        old_plan: oldPlan,
        new_plan: plan,
        change_type: 'upgrade',
        amount_charged: (invoice.amount_paid ?? 0) / 100,
        effective_at: periodStart,
        source: 'stripe_webhook',
        notes: `Mudança de plano via renovação de assinatura. Invoice: ${invoice.id}`,
      })
      if (histErr) console.error('Erro ao inserir plan_change_history (invoice):', histErr)
    }

    // Notificação de pagamento confirmado
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Pagamento confirmado',
      body: `Sua assinatura foi renovada com sucesso.`,
      type: 'info',
      action_view: 'my-plan',
    })
    if (notifErr) console.error('Erro ao criar notificação (invoice):', notifErr)

    console.log(`invoice.payment_succeeded: plano "${plan}" renovado para customer ${customerId} (user ${userId})`)
  }

  // ────────────────────────────────────────────────────────────
  // Assinatura cancelada → volta para plano gratuito
  // ────────────────────────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = subscription.customer as string

    // Busca user_id e pending_plan pelo stripe_customer_id
    const { data: subData } = await supabase
      .from('user_subscriptions')
      .select('user_id, pending_plan, plan_key')
      .eq('provider_subscription_id', subscription.id)
      .maybeSingle()

    let userId: string | null = subData?.user_id ?? null

    // Fallback: busca pelo stripe_customer_id em profiles
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

    // Se havia um pending_plan (downgrade agendado), usa ele; senão vai para 'free'
    const finalPlan = subData?.pending_plan ?? 'free'
    const oldPlan = subData?.plan_key ?? 'unknown'

    // Atualiza profiles.plan
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ plan: finalPlan })
      .eq('user_id', userId)
    if (profileErr) console.error('Erro ao reverter profiles.plan (deleted):', profileErr)

    // Atualiza user_subscriptions
    const { error: subErr } = await supabase.from('user_subscriptions').update({
      plan_key: finalPlan,
      status: finalPlan === 'free' ? 'cancelled' : 'active',
      cancel_at_period_end: false,
      pending_plan: null,
      pending_plan_starts_at: null,
    }).eq('user_id', userId)
    if (subErr) console.error('Erro ao atualizar user_subscriptions (deleted):', subErr)

    // Registra no histórico
    const changeType = finalPlan === 'free' ? 'cancel' : 'downgrade'
    const { error: histErr } = await supabase.from('plan_change_history').insert({
      user_id: userId,
      old_plan: oldPlan,
      new_plan: finalPlan,
      change_type: changeType,
      amount_charged: 0,
      effective_at: new Date().toISOString(),
      source: 'stripe_webhook',
      notes: `Assinatura Stripe encerrada. Sub: ${subscription.id}`,
    })
    if (histErr) console.error('Erro ao inserir plan_change_history (deleted):', histErr)

    // Notificação
    const notifTitle = finalPlan === 'free'
      ? 'Assinatura encerrada'
      : `Plano alterado para ${finalPlan}`
    const notifBody = finalPlan === 'free'
      ? 'Sua assinatura foi encerrada. Você continua com acesso ao plano Gratuito.'
      : `Seu plano foi alterado conforme agendado.`
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: userId,
      title: notifTitle,
      body: notifBody,
      type: 'info',
      action_view: 'my-plan',
    })
    if (notifErr) console.error('Erro ao criar notificação (deleted):', notifErr)

    console.log(`customer.subscription.deleted: plano revertido para "${finalPlan}" — customer ${customerId} (user ${userId})`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
