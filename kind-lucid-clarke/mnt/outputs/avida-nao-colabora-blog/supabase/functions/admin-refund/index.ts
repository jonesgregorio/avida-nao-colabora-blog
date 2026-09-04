import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdminAal2 } from '../_shared/adminAuth.ts'

// admin-refund — reembolso de uma cobrança específica, pelo Admin.
// Travas: exige admin AAL2; motivo obrigatório; teto por operação; confirmação
// em duas etapas (preview → confirm). Registra em public.stripe_refunds.
// NÃO altera assinatura, preço, webhook nem qualquer outro fluxo.

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Teto de segurança por operação (centavos). Ajustável por secret.
const MAX_CENTS = (() => {
  const v = parseInt(Deno.env.get('REFUND_MAX_CENTS') || '', 10)
  return Number.isFinite(v) && v > 0 ? v : 50_000 // R$ 500,00
})()

interface ChargeInfo {
  charge_id: string
  payment_intent: string | null
  amount: number
  amount_refunded: number
  refundable: number
  currency: string
  customer_email: string | null
  description: string | null
  created: number
}

async function resolveCharge(id: string): Promise<ChargeInfo> {
  let charge: Stripe.Charge | null = null

  if (id.startsWith('ch_')) {
    charge = await stripe.charges.retrieve(id)
  } else if (id.startsWith('pi_')) {
    const pi = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] })
    charge = (pi.latest_charge as Stripe.Charge) ?? null
  } else if (id.startsWith('in_')) {
    const inv = await stripe.invoices.retrieve(id, { expand: ['charge'] })
    charge = (inv.charge as Stripe.Charge) ?? null
  } else {
    throw new Error('ID inválido. Use ch_… (cobrança), pi_… (pagamento) ou in_… (fatura).')
  }

  if (!charge || !charge.id) throw new Error('Nenhuma cobrança encontrada para esse ID.')
  if (!charge.paid || charge.status !== 'succeeded') throw new Error('Essa cobrança não foi paga com sucesso — nada a reembolsar.')

  const amount = charge.amount ?? 0
  const amount_refunded = charge.amount_refunded ?? 0
  return {
    charge_id: charge.id,
    payment_intent: typeof charge.payment_intent === 'string' ? charge.payment_intent : null,
    amount,
    amount_refunded,
    refundable: Math.max(0, amount - amount_refunded),
    currency: charge.currency ?? 'brl',
    customer_email: charge.billing_details?.email ?? charge.receipt_email ?? null,
    description: charge.description ?? null,
    created: charge.created ?? 0,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  if (!Deno.env.get('STRIPE_SECRET_KEY')) return json({ error: 'STRIPE_SECRET_KEY não configurada no servidor.' }, 500)

  let body: { id?: string; amount_cents?: number; reason?: string; confirm?: boolean }
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  const id = (body.id || '').trim()
  if (!id) return json({ error: 'Informe o ID da cobrança.' }, 400)

  let info: ChargeInfo
  try {
    info = await resolveCharge(id)
  } catch (e) {
    return json({ error: (e as Error).message || 'Falha ao consultar a cobrança.' }, 400)
  }

  // Etapa 1 — preview
  if (!body.confirm) {
    return json({ preview: info, max_cents: MAX_CENTS })
  }

  // Etapa 2 — reembolso real
  const reason = (body.reason || '').trim()
  if (reason.length < 5) return json({ error: 'Descreva o motivo do reembolso (mínimo 5 caracteres).' }, 400)
  if (info.refundable <= 0) return json({ error: 'Essa cobrança já foi totalmente reembolsada.' }, 400)

  const amount = Number.isFinite(body.amount_cents) && (body.amount_cents as number) > 0
    ? Math.floor(body.amount_cents as number)
    : info.refundable

  if (amount > info.refundable) return json({ error: `Valor acima do reembolsável (${info.refundable} centavos).` }, 400)
  if (amount > MAX_CENTS) return json({ error: `Valor acima do teto por operação (${MAX_CENTS} centavos). Faça pelo dashboard do Stripe ou ajuste REFUND_MAX_CENTS.` }, 400)

  let refund: Stripe.Refund
  try {
    refund = await stripe.refunds.create(
      {
        charge: info.charge_id,
        amount,
        reason: 'requested_by_customer',
        metadata: { admin_id: auth.user.id, admin_reason: reason.slice(0, 300) },
      },
      { idempotencyKey: `admin-refund-${info.charge_id}-${amount}-${auth.user.id}` },
    )
  } catch (e) {
    return json({ error: `Stripe recusou o reembolso: ${(e as Error).message}` }, 400)
  }

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await admin.from('stripe_refunds').insert({
      stripe_refund_id: refund.id,
      charge_id: info.charge_id,
      payment_intent: info.payment_intent,
      amount_cents: amount,
      currency: info.currency,
      reason,
      admin_id: auth.user.id,
      customer_email: info.customer_email,
      status: refund.status ?? null,
    })
  } catch {
    // o reembolso já aconteceu — o log é secundário
  }

  return json({
    ok: true,
    refund_id: refund.id,
    amount_cents: amount,
    currency: info.currency,
    status: refund.status,
    charge_id: info.charge_id,
  })
})
