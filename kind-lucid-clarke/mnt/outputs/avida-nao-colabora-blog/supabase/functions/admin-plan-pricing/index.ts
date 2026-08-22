import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdminAal2 } from '../_shared/adminAuth.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' as Stripe.LatestApiVersion })
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type PaidPlan = 'essential' | 'plus'
const isPaidPlan = (v: unknown): v is PaidPlan => v === 'essential' || v === 'plus'
function fallbackPriceId(plan: PaidPlan): string | null {
  if (plan === 'essential') return Deno.env.get('STRIPE_PRICE_ESSENTIAL') || null
  return Deno.env.get('STRIPE_PRICE_PLUS_3990') || Deno.env.get('STRIPE_PRICE_THERAPEUTIC') || null
}
function displayPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)
  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let body: { action?: 'status' | 'update'; plan_key?: string; amount_cents?: number }
  try { body = await req.json() } catch { return json({ error: 'Body inválido' }, 400) }

  async function resolveCurrent(plan: PaidPlan) {
    const { data: cfg } = await supabase.from('plan_configs')
      .select('stripe_price_id, stripe_product_id, price_cents, price_currency')
      .eq('plan_key', plan).maybeSingle()
    const priceId = (cfg as { stripe_price_id?: string } | null)?.stripe_price_id || fallbackPriceId(plan)
    if (!priceId) return null
    const price = await stripe.prices.retrieve(priceId)
    return {
      plan_key: plan,
      price_id: price.id,
      product_id: typeof price.product === 'string' ? price.product : price.product.id,
      amount_cents: price.unit_amount ?? Number((cfg as { price_cents?: number } | null)?.price_cents ?? 0),
      currency: price.currency,
      active: price.active,
    }
  }

  try {
    if (body.action === 'status' || !body.action) {
      const prices = (await Promise.all((['essential', 'plus'] as PaidPlan[]).map(resolveCurrent))).filter(Boolean)
      return json({ ok: true, prices })
    }
    if (body.action !== 'update' || !isPaidPlan(body.plan_key)) return json({ error: 'Plano inválido' }, 400)
    const cents = Math.round(Number(body.amount_cents))
    if (!Number.isFinite(cents) || cents < 100 || cents > 1_000_000) {
      return json({ ok: false, error: 'Informe um preço mensal válido entre R$ 1,00 e R$ 10.000,00.' })
    }
    const current = await resolveCurrent(body.plan_key)
    if (!current) return json({ ok: false, error: 'Price atual do plano não está configurado no Stripe.' })
    if (current.amount_cents === cents) return json({ ok: false, error: `O plano já custa ${displayPrice(cents)} por mês.` })

    await supabase.from('stripe_plan_prices').upsert({
      plan_key: body.plan_key, stripe_price_id: current.price_id, stripe_product_id: current.product_id,
      amount_cents: current.amount_cents, currency: current.currency, active_for_new: false,
    }, { onConflict: 'stripe_price_id' })

    const next = await stripe.prices.create({
      product: current.product_id,
      unit_amount: cents,
      currency: 'brl',
      recurring: { interval: 'month' },
      nickname: `${body.plan_key === 'essential' ? 'Essencial' : 'Plus'} — ${displayPrice(cents)}/mês`,
      metadata: { plan_key: body.plan_key, managed_by: 'admin-plan-pricing', previous_price_id: current.price_id, changed_by: auth.user.id },
    })

    const now = new Date().toISOString()
    const { error: retireErr } = await supabase.from('stripe_plan_prices')
      .update({ active_for_new: false, retired_at: now }).eq('plan_key', body.plan_key)
    if (retireErr) {
      await stripe.prices.update(next.id, { active: false })
      throw new Error('Falha ao aposentar o Price anterior no banco: ' + retireErr.message)
    }

    const { error: historyErr } = await supabase.from('stripe_plan_prices').upsert({
      plan_key: body.plan_key, stripe_price_id: next.id, stripe_product_id: current.product_id,
      amount_cents: cents, currency: 'brl', active_for_new: true, created_by: auth.user.id, retired_at: null,
    }, { onConflict: 'stripe_price_id' })
    if (historyErr) {
      await stripe.prices.update(next.id, { active: false })
      throw new Error('Falha ao registrar o novo Price no banco: ' + historyErr.message)
    }

    const { error: cfgErr } = await supabase.from('plan_configs').update({
      stripe_price_id: next.id, stripe_product_id: current.product_id, price_cents: cents,
      price_currency: 'brl', price: displayPrice(cents), price_synced_at: now, updated_at: now,
    }).eq('plan_key', body.plan_key)
    if (cfgErr) {
      await stripe.prices.update(next.id, { active: false })
      await supabase.from('stripe_plan_prices').update({ active_for_new: false, retired_at: now }).eq('stripe_price_id', next.id)
      throw new Error('Falha ao atualizar o plano no banco: ' + cfgErr.message)
    }

    try { await stripe.prices.update(current.price_id, { active: false }) }
    catch (e) { console.error('Não foi possível arquivar Price anterior:', (e as Error).message) }

    return json({
      ok: true, plan_key: body.plan_key, old_price_id: current.price_id, new_price_id: next.id,
      amount_cents: cents, display_price: displayPrice(cents), existing_subscriptions_unchanged: true,
      message: `Novo preço ${displayPrice(cents)}/mês ativado para novas assinaturas e futuras trocas. Assinaturas atuais mantêm o valor contratado.`,
    })
  } catch (e) {
    console.error('admin-plan-pricing:', (e as Error).message)
    return json({ error: 'Não foi possível atualizar o preço com segurança. Nenhuma nova tentativa automática foi feita.' }, 500)
  }
})
