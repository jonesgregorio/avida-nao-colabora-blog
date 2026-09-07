import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdminAal2 } from '../_shared/adminAuth.ts'

// ============================================================================
// admin-subscription — Etapa 6 da evolução do Admin: gestão avançada de
// assinaturas SEM substituir o Stripe como fonte financeira.
//
// Ações (todas exigem admin AAL2, todas idempotentes, todas auditadas):
//   inspect                  — lê o estado AO VIVO no Stripe (somente leitura).
//   sync                     — espelha o Stripe para public.user_subscriptions.
//   set_cancel_at_period_end  — agenda cancelamento p/ o fim do ciclo (value=true)
//                               ou reativa (value=false). Nunca cancela na hora.
//
// NÃO cria cobrança, NÃO altera preço/produto/webhook, NÃO cancela imediatamente,
// NÃO expõe nenhuma chave (o front nunca vê sk_/whsec_).
// ============================================================================

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const iso = (unixSeconds: number | null | undefined): string | null =>
  unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null

type Action = 'inspect' | 'sync' | 'set_cancel_at_period_end'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)
  const adminUser = auth.user

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { action?: Action; user_id?: string; value?: boolean }
  try { body = await req.json() } catch { return json({ error: 'Body inválido' }, 400) }

  const action = body.action
  const targetUserId = body.user_id
  if (!action || !['inspect', 'sync', 'set_cancel_at_period_end'].includes(action)) {
    return json({ error: 'Ação inválida' }, 400)
  }
  if (!targetUserId) return json({ error: 'user_id é obrigatório' }, 400)

  const { data: subRow } = await admin.from('user_subscriptions')
    .select('id, plan_key, status, payment_status, current_period_start, current_period_end, cancel_at_period_end, pending_plan, pending_plan_starts_at, provider_subscription_id, price_id, product_id, canceled_at, trial_end')
    .eq('user_id', targetUserId).maybeSingle()

  const stripeSubId = (subRow as { provider_subscription_id?: string | null } | null)?.provider_subscription_id ?? null

  async function audit(details: Record<string, unknown>) {
    try {
      await admin.from('admin_logs').insert({
        admin_id: adminUser.id,
        action: 'config',
        target_type: 'subscription',
        target_id: targetUserId,
        details,
      })
    } catch (e) { console.error('admin_subscription audit:', (e as Error).message) }
  }

  // Puxa o estado ao vivo do Stripe (campos seguros).
  async function fetchStripe(): Promise<Record<string, unknown> | null> {
    if (!stripeSubId) return null
    const s = await stripe.subscriptions.retrieve(stripeSubId, { expand: ['customer'] })
    const item = s.items?.data?.[0]
    const customer = (s.customer && typeof s.customer === 'object' && !('deleted' in s.customer))
      ? s.customer as Stripe.Customer
      : null
    return {
      status: s.status,
      cancel_at_period_end: s.cancel_at_period_end,
      current_period_start: iso(s.current_period_start),
      current_period_end: iso(s.current_period_end),
      canceled_at: iso(s.canceled_at),
      trial_end: iso(s.trial_end),
      price_id: item?.price?.id ?? null,
      product_id: (typeof item?.price?.product === 'string' ? item?.price?.product : item?.price?.product?.id) ?? null,
      unit_amount: item?.price?.unit_amount ?? null,
      currency: item?.price?.currency ?? null,
      latest_invoice_status: typeof s.latest_invoice === 'object' ? (s.latest_invoice as Stripe.Invoice)?.status ?? null : null,
      customer_balance: customer?.balance ?? null,
      customer_delinquent: customer?.delinquent ?? null,
    }
  }

  try {
    // ---- inspect ---------------------------------------------------------
    if (action === 'inspect') {
      if (!stripeSubId) return json({ ok: true, stripe: null, message: 'Sem assinatura Stripe vinculada.' })
      const stripeState = await fetchStripe()
      await audit({ op: 'inspect' })
      return json({ ok: true, stripe: stripeState, db: subRow })
    }

    // ---- sync -----------------------------------------------------------
    if (action === 'sync') {
      if (!stripeSubId) return json({ error: 'Sem assinatura Stripe para sincronizar.', code: 'no_subscription' })
      const stripeState = await fetchStripe()
      if (!stripeState) return json({ error: 'Não foi possível ler a assinatura no Stripe.' }, 502)

      const patch: Record<string, unknown> = {
        payment_status: stripeState.status,
        cancel_at_period_end: stripeState.cancel_at_period_end,
        current_period_start: stripeState.current_period_start,
        current_period_end: stripeState.current_period_end,
        canceled_at: stripeState.canceled_at,
        trial_end: stripeState.trial_end,
        price_id: stripeState.price_id,
        product_id: stripeState.product_id,
        updated_at: new Date().toISOString(),
      }
      await admin.from('user_subscriptions').update(patch).eq('user_id', targetUserId)
      await audit({ op: 'sync', before: subRow, after: patch })
      return json({ ok: true, synced: patch, stripe: stripeState })
    }

    // ---- set_cancel_at_period_end (cancelar ao fim do ciclo / reativar) --
    if (action === 'set_cancel_at_period_end') {
      const value = body.value === true
      let effectiveEnd: string | null = (subRow as { current_period_end?: string | null } | null)?.current_period_end ?? null

      if (stripeSubId) {
        const s = await stripe.subscriptions.retrieve(stripeSubId)
        if (s.status === 'canceled') return json({ error: 'A assinatura já está cancelada no Stripe.', code: 'already_cancelled' })
        effectiveEnd = iso(s.current_period_end)
        if (s.cancel_at_period_end !== value) {
          const updated = await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: value })
          if (updated.cancel_at_period_end !== value) {
            return json({ error: 'O Stripe não confirmou a alteração. Tente novamente.', code: 'stripe_error' }, 502)
          }
          effectiveEnd = iso(updated.current_period_end)
        }
      }

      await admin.from('user_subscriptions').update({
        cancel_at_period_end: value,
        status: value ? 'cancel_pending' : 'active',
        pending_plan: value ? 'free' : null,
        pending_plan_starts_at: value ? effectiveEnd : null,
        updated_at: new Date().toISOString(),
      }).eq('user_id', targetUserId)

      // Só o agendamento gera evento de negócio; a reativação fica na auditoria.
      if (value) {
        await admin.from('subscription_events').insert({
          user_id: targetUserId,
          subscription_id: (subRow as { id?: string } | null)?.id ?? null,
          stripe_subscription_id: stripeSubId,
          event_type: 'cancellation_requested',
          previous_plan: (subRow as { plan_key?: string } | null)?.plan_key ?? null,
          new_plan: 'free',
          status: 'scheduled',
          comment: 'Agendado pelo admin (fim do ciclo)',
        }).then(({ error }) => { if (error) console.error('subscription_events:', error.message) })
      }

      await audit({ op: 'set_cancel_at_period_end', value, effective_end: effectiveEnd, had_stripe: Boolean(stripeSubId) })
      return json({ ok: true, cancel_at_period_end: value, effective_end: effectiveEnd })
    }

    return json({ error: 'Ação inválida' }, 400)
  } catch (err) {
    console.error(`admin-subscription ${action}:`, (err as Error).message)
    return json({ error: 'Não foi possível concluir a operação.', detail: (err as Error).message }, 500)
  }
})
