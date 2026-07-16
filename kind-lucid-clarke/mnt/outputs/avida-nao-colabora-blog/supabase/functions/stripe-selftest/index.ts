import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
// Preço do Plus: prefere o secret de go-live e cai no atual (STRIPE_PRICE_THERAPEUTIC).
const PRICE_IDS: Record<string, string | undefined> = {
  essential: Deno.env.get('STRIPE_PRICE_ESSENTIAL'),
  plus: Deno.env.get('STRIPE_PRICE_PLUS_3990') || Deno.env.get('STRIPE_PRICE_THERAPEUTIC'),
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

  if (!PRICE_IDS.essential || !PRICE_IDS.plus) {
    return json({ error: 'STRIPE_PRICE_ESSENTIAL / (STRIPE_PRICE_PLUS_3990 ou STRIPE_PRICE_THERAPEUTIC) não configurados' }, 400)
  }

  // ── Trava de modo LIVE ──
  // Este teste depende de tokens de teste (pm_card_visa) e de Test Clocks, que o
  // Stripe só aceita com chave sk_test_. Com chave live ele falharia de qualquer
  // forma — mas só DEPOIS de criar um customer real na conta (o create vem antes
  // do cartão). Recusamos aqui, antes de tocar em qualquer objeto.
  const secret = Deno.env.get('STRIPE_SECRET_KEY') || ''
  if (secret.startsWith('sk_live_') || secret.startsWith('rk_live_')) {
    return json({
      ok: false,
      modo: 'live',
      error: 'O autoteste de cobrança só funciona com chave de TESTE (sk_test_). A conta está em modo LIVE: os cartões fictícios (pm_card_visa) e Test Clocks são bloqueados pelo Stripe, e exercitar o fluxo aqui significaria assinatura e cobrança reais.',
      como_verificar: 'Em modo live, use os botões somente-leitura: "Auditar configuração", "Auditar webhook", "Auditar dados sincronizados" e "Diagnosticar entrega de eventos".',
    }, 400)
  }

  const results: Record<string, unknown> = {}
  let custId: string | undefined
  let subId: string | undefined
  let scheduleId: string | undefined
  let clockId: string | undefined

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
        items: [{ id: itemId, price: PRICE_IDS.plus! }],
        proration_behavior: 'always_invoice',
      })
      const subs = await stripe.subscriptions.list({ customer: cust.id })
      results.upgrade_sem_duplicata = {
        assinaturas_ativas: subs.data.length,
        price_virou_plus: up.items.data[0].price.id === PRICE_IDS.plus,
        ok: subs.data.length === 1 && up.items.data[0].price.id === PRICE_IDS.plus,
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
          { items: [{ price: PRICE_IDS.plus!, quantity: 1 }], start_date: sch.phases[0].start_date, end_date: fresh.current_period_end },
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

    // ── Teste 4: DOWNGRADE APLICA no fim do ciclo (Stripe Test Clock avança o tempo) ──
    try {
      const now = Math.floor(Date.now() / 1000)
      const clock = await stripe.testHelpers.testClocks.create({ frozen_time: now })
      clockId = clock.id
      const c2 = await stripe.customers.create({ test_clock: clock.id, name: 'SELFTEST-CLOCK', metadata: { selftest: '1' } })
      const pm2 = await stripe.paymentMethods.attach('pm_card_visa', { customer: c2.id })
      await stripe.customers.update(c2.id, { invoice_settings: { default_payment_method: pm2.id } })
      const s2 = await stripe.subscriptions.create({ customer: c2.id, items: [{ price: PRICE_IDS.plus! }] })
      const periodEnd = s2.current_period_end
      const sch2 = await stripe.subscriptionSchedules.create({ from_subscription: s2.id })
      await stripe.subscriptionSchedules.update(sch2.id, {
        end_behavior: 'release',
        phases: [
          { items: [{ price: PRICE_IDS.plus!, quantity: 1 }], start_date: sch2.phases[0].start_date, end_date: periodEnd },
          { items: [{ price: PRICE_IDS.essential!, quantity: 1 }] },
        ],
      })
      // Avança o relógio para 1h depois do fim do ciclo → o schedule deve trocar o price.
      await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: periodEnd + 3600 })
      let ready = false
      for (let i = 0; i < 15; i++) {
        const ck = await stripe.testHelpers.testClocks.retrieve(clock.id)
        if (ck.status === 'ready') { ready = true; break }
        if (ck.status === 'internal_failure') break
        await new Promise((r) => setTimeout(r, 3000))
      }
      const s2after = await stripe.subscriptions.retrieve(s2.id)
      const newPrice = s2after.items.data[0]?.price.id
      results.downgrade_aplica_no_fim = {
        clock_pronto: ready,
        price_virou_essencial: newPrice === PRICE_IDS.essential,
        assinatura_ativa: s2after.status === 'active' || s2after.status === 'trialing',
        ok: ready && newPrice === PRICE_IDS.essential && (s2after.status === 'active' || s2after.status === 'trialing'),
      }
    } catch (e) { results.downgrade_aplica_no_fim = { ok: false, error: (e as Error).message } }
  } catch (e) {
    results.fatal = (e as Error).message
  } finally {
    // ── Limpeza: libera schedule, cancela assinatura, apaga cliente de teste ──
    if (scheduleId) { try { await stripe.subscriptionSchedules.release(scheduleId) } catch { /* noop */ } }
    if (subId) { try { await stripe.subscriptions.cancel(subId) } catch { /* noop */ } }
    if (custId) { try { await stripe.customers.del(custId) } catch { /* noop */ } }
    if (clockId) { try { await stripe.testHelpers.testClocks.del(clockId) } catch { /* noop */ } }
  }

  const r = results as Record<string, { ok?: boolean }>
  const allOk = !!(r.upgrade_sem_duplicata?.ok && r.downgrade_via_schedule?.ok && r.idempotencia?.ok && r.downgrade_aplica_no_fim?.ok)
  return json({ ok: allOk, results })
})
