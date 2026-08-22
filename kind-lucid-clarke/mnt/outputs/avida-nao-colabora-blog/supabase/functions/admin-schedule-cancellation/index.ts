import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdminAal2 } from '../_shared/adminAuth.ts'

// ============================================================================
// admin-schedule-cancellation — aba Admin > Cancelamentos
// ----------------------------------------------------------------------------
// Agenda o cancelamento de uma assinatura NO STRIPE com cancel_at_period_end=true
// (NUNCA cancelamento imediato). O usuário mantém acesso ao plano pago até
// current_period_end; após o fim do ciclo o webhook (customer.subscription.deleted)
// reverte para o Gratuito. Aqui só GARANTIMOS o agendamento no Stripe e
// sincronizamos o banco — de forma idempotente e segura (apenas admin AAL2).
//
// Entrada: { feedback_id }  — o ID da assinatura NUNCA vem do client; é buscado
// no banco a partir do usuário do registro de cancelamento.
// ============================================================================

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' as Stripe.LatestApiVersion })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE = Deno.env.get('SITE_URL') || Deno.env.get('APP_URL') || 'https://avidanaocolabora.com'

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', plus: 'Plus', therapeutic: 'Plus', 'therapeutic-plus': 'Plus',
}
const planLabel = (p: string | null | undefined): string => (p && PLAN_LABELS[p]) || p || 'Gratuito'

const BILLING_TZ = 'America/Sao_Paulo'
const fmtBR = (iso: string): string => {
  const d = new Date(iso)
  const cal = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  return d.toLocaleDateString('pt-BR', { timeZone: cal ? 'UTC' : BILLING_TZ })
}

const MS_PER_CYCLE = 30 * 86_400_000
const rollForwardIso = (iso: string, now: Date = new Date()): string => {
  const b = new Date(iso)
  if (Number.isNaN(b.getTime())) return iso
  const diff = now.getTime() - b.getTime()
  if (diff <= 0) return b.toISOString()
  const cycles = Math.ceil(diff / MS_PER_CYCLE)
  return new Date(b.getTime() + cycles * MS_PER_CYCLE).toISOString()
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)
  const user = auth.user

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  let body: { feedback_id?: string }
  try { body = await req.json() } catch { return json({ error: 'Body inválido' }, 400) }
  const feedbackId = body.feedback_id
  if (!feedbackId) return json({ error: 'feedback_id é obrigatório' }, 400)

  const { data: fb } = await admin.from('subscription_change_feedback')
    .select('id, user_id, change_type, current_plan, reasons, comment, effective_at, subscription_id, status')
    .eq('id', feedbackId).maybeSingle()
  if (!fb) return json({ error: 'Registro de cancelamento não encontrado.' }, 404)
  if (fb.change_type !== 'cancellation') return json({ error: 'Este registro não é um cancelamento.' }, 400)
  if ((fb as { status?: string }).status === 'reverted') {
    return json({ error: 'Este pedido foi retirado pelo usuário e não pode ser aprovado.', code: 'reverted' })
  }

  const targetUserId = fb.user_id as string

  const { data: sub } = await admin.from('user_subscriptions')
    .select('id, provider_subscription_id, current_period_end, status, cancel_at_period_end, plan_key')
    .eq('user_id', targetUserId).maybeSingle()

  const stripeSubId = (sub as { provider_subscription_id?: string } | null)?.provider_subscription_id ?? null
  if (!stripeSubId) {
    return json({ error: 'Não foi encontrada uma assinatura Stripe vinculada a este usuário.', code: 'no_subscription' })
  }

  const { data: profile } = await admin.from('profiles')
    .select('email, full_name, plan, plan_activated_at').eq('user_id', targetUserId).maybeSingle()
  const prof = profile as { email?: string; full_name?: string; plan?: string; plan_activated_at?: string } | null

  const computeEnd = (stripeEnd: string | null): string | null => {
    const raw = stripeEnd
      || (sub as { current_period_end?: string } | null)?.current_period_end
      || (fb.effective_at as string | null)
      || null
    if (raw) return rollForwardIso(raw)
    if (prof?.plan_activated_at) return rollForwardIso(new Date(new Date(prof.plan_activated_at).getTime() + MS_PER_CYCLE).toISOString())
    return null
  }

  let s: Stripe.Subscription
  try {
    s = await stripe.subscriptions.retrieve(stripeSubId)
  } catch (e) {
    const msg = (e as Error).message
    await admin.from('subscription_change_feedback').update({
      stripe_sync_status: 'failed', stripe_error: msg, updated_at: new Date().toISOString(),
    }).eq('id', feedbackId)
    return json({ error: 'Não foi possível enviar o cancelamento ao Stripe. Tente novamente.', code: 'stripe_error', detail: msg })
  }

  if (s.status === 'canceled') {
    return json({ error: 'A assinatura já está cancelada no Stripe.', code: 'already_cancelled' })
  }
  const cancelable = s.status === 'active' || s.status === 'trialing' || s.status === 'past_due'
  if (!cancelable) {
    return json({ error: `A assinatura não está em um estado cancelável (status: ${s.status}).`, code: 'not_cancelable' })
  }

  const effectiveEnd = computeEnd(s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null)

  async function syncDb(endDate: string | null): Promise<void> {
    await admin.from('user_subscriptions').update({
      cancel_at_period_end: true,
      status: 'cancel_pending',
      pending_plan: 'free',
      pending_plan_starts_at: endDate,
      updated_at: new Date().toISOString(),
    }).eq('user_id', targetUserId)

    await admin.from('subscription_change_feedback').update({
      status: 'scheduled',
      effective_at: endDate,
      stripe_sent_at: new Date().toISOString(),
      stripe_sync_status: 'success',
      stripe_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', feedbackId)
  }

  if (s.cancel_at_period_end === true) {
    await syncDb(effectiveEnd)
    return json({ ok: true, already: true, effectiveAt: effectiveEnd, message: 'Este cancelamento já estava agendado no Stripe.' })
  }

  let updated: Stripe.Subscription
  try {
    updated = await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true })
  } catch (e) {
    const msg = (e as Error).message
    await admin.from('subscription_change_feedback').update({
      stripe_sync_status: 'failed', stripe_error: msg, updated_at: new Date().toISOString(),
    }).eq('id', feedbackId)
    return json({ error: 'Não foi possível enviar o cancelamento ao Stripe. Tente novamente.', code: 'stripe_error', detail: msg })
  }

  if (updated.cancel_at_period_end !== true) {
    await admin.from('subscription_change_feedback').update({
      stripe_sync_status: 'failed', stripe_error: 'Stripe não confirmou cancel_at_period_end', updated_at: new Date().toISOString(),
    }).eq('id', feedbackId)
    return json({ error: 'Não foi possível enviar o cancelamento ao Stripe. Tente novamente.', code: 'stripe_error' })
  }

  const confirmedEnd = computeEnd(updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null)

  await syncDb(confirmedEnd)

  await admin.from('subscription_events').insert({
    user_id: targetUserId,
    subscription_id: (sub as { id?: string } | null)?.id ?? null,
    stripe_subscription_id: stripeSubId,
    event_type: 'cancellation_scheduled_in_stripe',
    previous_plan: prof?.plan ?? fb.current_plan ?? null,
    new_plan: 'free',
    status: 'scheduled',
    reasons: (fb.reasons as string[] | null) ?? null,
    comment: (fb.comment as string | null) ?? null,
    metadata: {
      source: 'admin_cancelamentos',
      action: 'schedule_cancel_at_period_end',
      cancel_at_period_end: true,
      current_period_end: confirmedEnd,
      stripe_response_status: updated.status,
      admin_id: user.id,
    },
  }).then(({ error }) => { if (error) console.error('subscription_events:', error.message) })

  if (confirmedEnd) {
    await admin.from('notifications').insert({
      user_id: targetUserId,
      title: 'Cancelamento agendado',
      body: `Seu plano continuará ativo até ${fmtBR(confirmedEnd)}. Após essa data, sua conta voltará para o plano Gratuito.`,
      type: 'info', action_url: 'my-plan', destination_path: 'my-plan',
    }).then(({ error }) => { if (error) console.error('notification:', error.message) })
  }

  if (prof?.email && confirmedEnd) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: targetUserId,
          to_email: prof.email,
          template_key: 'plan_cancel_requested',
          variables: {
            nome: prof.full_name || 'você',
            plano_atual: planLabel(prof.plan ?? fb.current_plan),
            data_fim_ciclo: fmtBR(confirmedEnd),
            link_meu_plano: `${SITE}/meu-plano`,
          },
          idempotency_key: `plan_cancel_requested:${targetUserId}:${confirmedEnd}`,
        }),
      })
    } catch (e) { console.error('email:', (e as Error).message) }
  }

  return json({ ok: true, effectiveAt: confirmedEnd })
})
