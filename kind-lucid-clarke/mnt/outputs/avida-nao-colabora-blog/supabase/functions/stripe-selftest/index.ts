import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const PRICE_IDS: Record<string, string | undefined> = {
  essential: Deno.env.get('STRIPE_PRICE_ESSENTIAL'),
  therapeutic: Deno.env.get('STRIPE_PRICE_THERAPEUTIC'),
  'therapeutic-plus': Deno.env.get('STRIPE_PRICE_PLUS'),
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// AUTOTESTE (modo teste): valida os invariantes críticos de cobrança via API do Stripe,
// SEM UI e SEM cobrança real. Cria uma assinatura de teste (token pm_card_visa),
// exercita upgrade/downgrade/idempotência, verifica, e LIMPA tudo no fim.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Não autorizado' }, 401)
  const { data: prof } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if ((prof as { role?: string } | null)?.role !== 'admin') return json({ error: 'Apenas admin' }, 403)

  if (!PRICE_IDS.essential || !PRICE_IDS.therapeutic) {
    return json({ error: 'STRIPE_PRICE_ESSENTIAL / STRIPE_PRICE_THERAPEUTIC não configurados' }, 400)
  }

  const results: Record<string, unknown> = {}
  let custId: string | undefined
  let subId: string | undefined
  let scheduleId: string | undefined

  try {
    // ── Setup: cliente de teste + assinatura Essencial ativa ──
    const cust = await stripe.customers.create({ name: 'SELFTEST (auto)', metadata: { selftest: '1' } })
    custId = cust.id
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: cust.id })
    await stripe.customers.update(cust.id, { invoice_settings: { default_payment_method: pm.id } })
    const sub = await stripe.subscriptions.create({ customer: cust.id, items: [{ price: PRICE_IDS.essential! }] })
    subId = sub.id
    results.setup = { sub_status: sub.status, ok: sub.status === 'active' || sub.status === 'trialing' }

    // ── Teste 1: UPGRADE não duplica assinatura + troca de price ──
    try {
      const itemId = sub.items.data[0].id
      const up = await stripe.subscriptions.update(sub.id, {
        items: [{ id: itemId, price: PRICE_IDS.therapeutic! }],
        proration_behavior: 'always_invoice',
      })
      const subs = await stripe.subscriptions.list({ customer: cust.id })
      results.upgrade_sem_duplicata = {
        assinaturas_ativas: subs.data.length,
        price_virou_terapeutico: up.items.data[0].price.id === PRICE_IDS.therapeutic,
        ok: subs.data.length === 1 && up.items.data[0].price.id === PRICE_IDS.therapeutic,
      }
    } catch (e) { results.upgrade_sem_duplicata = { ok: false, error: (e as Error).message } }

    // ── Teste 2: DOWNGRADE cria SCHEDULE (não cancela) ──
    try {
      const fresh = await stripe.subscriptions.retrieve(sub.id)
      const sch = await stripe.subscriptionSchedules.create({ from_subscription: sub.id })
      scheduleId = sch.id
      const usch = await stripe.subscriptionSchedules.update(sch.id, {
        end_behavior: 'release',
        phases: [
          { items: [{ price: PRICE_IDS.therapeutic!, quantity: 1 }], start_date: sch.phases[0].start_date, end_date: fresh.current_period_end },
          { items: [{ price: PRICE_IDS.essential!, quantity: 1 }] },
        ],
      })
      const subAfter = await stripe.subscriptions.retrieve(sub.id)
      results.downgrade_via_schedule = {
        fases: usch.phases.length,
        assinatura_cancelada: subAfter.status === 'canceled',
        cancel_at_period_end: subAfter.cancel_at_period_end,
        ok: usch.phases.length === 2 && subAfter.status !== 'canceled' && !subAfter.cancel_at_period_end,
      }
    } catch (e) { results.downgrade_via_schedule = { ok: false, error: (e as Error).message } }

    // ── Teste 3: IDEMPOTÊNCIA do webhook (índice único bloqueia o 2º) ──
    try {
      const evtId = 'selftest_' + Date.now()
      const i1 = await supabase.from('stripe_webhook_events').insert({ stripe_event_id: evtId, event_type: 'selftest' })
      const i2 = await supabase.from('stripe_webhook_events').insert({ stripe_event_id: evtId, event_type: 'selftest' })
      await supabase.from('stripe_webhook_events').delete().eq('stripe_event_id', evtId)
      results.idempotencia = { primeiro_ok: !i1.error, segundo_rejeitado: !!i2.error, ok: !i1.error && !!i2.error }
    } catch (e) { results.idempotencia = { ok: false, error: (e as Error).message } }
  } catch (e) {
    results.fatal = (e as Error).message
  } finally {
    // ── Limpeza: libera schedule, cancela assinatura, apaga cliente de teste ──
    if (scheduleId) { try { await stripe.subscriptionSchedules.release(scheduleId) } catch { /* noop */ } }
    if (subId) { try { await stripe.subscriptions.cancel(subId) } catch { /* noop */ } }
    if (custId) { try { await stripe.customers.del(custId) } catch { /* noop */ } }
  }

  const r = results as Record<string, { ok?: boolean }>
  const allOk = !!(r.upgrade_sem_duplicata?.ok && r.downgrade_via_schedule?.ok && r.idempotencia?.ok)
  return json({ ok: allOk, results })
})
