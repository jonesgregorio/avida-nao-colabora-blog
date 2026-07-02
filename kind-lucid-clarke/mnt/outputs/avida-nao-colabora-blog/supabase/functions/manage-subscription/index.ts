import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
})

// Ações suportadas
type Action = 'cancel' | 'downgrade' | 'reactivate'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Autentica o usuário via JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 })
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser()
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { action: Action; targetPlan?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), { status: 400 })
  }

  const { action, targetPlan } = body
  if (!['cancel', 'downgrade', 'reactivate'].includes(action)) {
    return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400 })
  }

  // Busca assinatura do usuário
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // Busca plano atual
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  const currentPlan = profile?.plan ?? 'free'
  const stripeSubId = sub?.provider_subscription_id ?? null

  const effectiveAt = sub?.current_period_end ?? new Date().toISOString()

  try {
    if (action === 'cancel') {
      // Cancela ao fim do período
      if (stripeSubId) {
        await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true })
      }

      const { error: subErr } = await supabase.from('user_subscriptions').upsert({
        user_id: user.id,
        status: 'cancel_pending',
        cancel_at_period_end: true,
        pending_plan: 'free',
        pending_plan_starts_at: effectiveAt,
      }, { onConflict: 'user_id' })
      if (subErr) throw new Error('Erro ao atualizar assinatura: ' + subErr.message)

      await supabase.from('plan_change_history').insert({
        user_id: user.id,
        old_plan: currentPlan,
        new_plan: 'free',
        change_type: 'cancel',
        amount_charged: 0,
        effective_at: effectiveAt,
        source: 'user',
        notes: `Cancelamento agendado para ${new Date(effectiveAt).toLocaleDateString('pt-BR')}`,
      }).then(({ error }) => { if (error) console.error('plan_change_history cancel:', error) })

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Cancelamento agendado',
        body: `Sua assinatura será encerrada ao fim do ciclo atual. Você mantém acesso até lá.`,
        type: 'info',
      }).then(({ error }) => { if (error) console.error('notif cancel:', error) })

      return new Response(JSON.stringify({
        ok: true,
        message: `Cancelamento agendado para ${new Date(effectiveAt).toLocaleDateString('pt-BR')}.`,
        effectiveAt,
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (action === 'downgrade') {
      if (!targetPlan) {
        return new Response(JSON.stringify({ error: 'targetPlan obrigatório para downgrade' }), { status: 400 })
      }

      // Para downgrade, cancela a assinatura Stripe atual ao fim do período.
      // O webhook customer.subscription.deleted lerá pending_plan e ativará o plano correto.
      if (stripeSubId) {
        await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true })
      }

      const { error: subErr } = await supabase.from('user_subscriptions').upsert({
        user_id: user.id,
        cancel_at_period_end: true,
        pending_plan: targetPlan,
        pending_plan_starts_at: effectiveAt,
      }, { onConflict: 'user_id' })
      if (subErr) throw new Error('Erro ao agendar downgrade: ' + subErr.message)

      await supabase.from('plan_change_history').insert({
        user_id: user.id,
        old_plan: currentPlan,
        new_plan: targetPlan,
        change_type: 'downgrade_intent',
        amount_charged: 0,
        effective_at: effectiveAt,
        source: 'user',
        notes: `Downgrade para ${targetPlan} agendado para ${new Date(effectiveAt).toLocaleDateString('pt-BR')}`,
      }).then(({ error }) => { if (error) console.error('plan_change_history downgrade:', error) })

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Downgrade agendado',
        body: `Seu plano será alterado ao fim do ciclo atual.`,
        type: 'info',
      }).then(({ error }) => { if (error) console.error('notif downgrade:', error) })

      return new Response(JSON.stringify({
        ok: true,
        message: `Downgrade agendado para ${new Date(effectiveAt).toLocaleDateString('pt-BR')}.`,
        effectiveAt,
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (action === 'reactivate') {
      // Remove o cancelamento agendado
      if (stripeSubId) {
        await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: false })
      }

      const { error: subErr } = await supabase.from('user_subscriptions').update({
        status: 'active',
        cancel_at_period_end: false,
        pending_plan: null,
        pending_plan_starts_at: null,
      }).eq('user_id', user.id)
      if (subErr) throw new Error('Erro ao reativar assinatura: ' + subErr.message)

      await supabase.from('plan_change_history').insert({
        user_id: user.id,
        old_plan: currentPlan,
        new_plan: currentPlan,
        change_type: 'reactivate',
        amount_charged: 0,
        effective_at: new Date().toISOString(),
        source: 'user',
        notes: 'Cancelamento removido pelo usuário',
      }).then(({ error }) => { if (error) console.error('plan_change_history reactivate:', error) })

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Assinatura reativada',
        body: `O cancelamento agendado foi removido. Seu plano continua ativo normalmente.`,
        type: 'info',
      }).then(({ error }) => { if (error) console.error('notif reactivate:', error) })

      return new Response(JSON.stringify({
        ok: true,
        message: 'Cancelamento removido. Seu plano continuará ativo normalmente.',
      }), { headers: { 'Content-Type': 'application/json' } })
    }
  } catch (err: any) {
    console.error(`manage-subscription ${action}:`, err.message)
    return new Response(JSON.stringify({ error: err.message ?? 'Erro interno' }), { status: 500 })
  }

  return new Response(JSON.stringify({ error: 'Ação não tratada' }), { status: 400 })
})
