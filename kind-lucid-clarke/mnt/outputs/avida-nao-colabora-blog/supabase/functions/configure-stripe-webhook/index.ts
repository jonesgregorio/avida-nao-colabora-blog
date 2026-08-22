import Stripe from 'npm:stripe@14'
import { requireAdminAal2 } from '../_shared/adminAuth.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' as Stripe.LatestApiVersion })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Eventos que o webhook (stripe-webhook) trata.
const WEBHOOK_EVENTS: Stripe.WebhookEndpointUpdateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Admin dispara esta função; ela usa a STRIPE_SECRET_KEY (server-side) para configurar
// os eventos do endpoint de webhook — sem o usuário tocar no painel do Stripe.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  try {
    const target = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-webhook`
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
    const ep = endpoints.data.find(e => e.url === target)
    if (!ep) {
      return json({ error: `Nenhum endpoint aponta para ${target}`, endpoints: endpoints.data.map(e => e.url) }, 404)
    }
    const updated = await stripe.webhookEndpoints.update(ep.id, { enabled_events: WEBHOOK_EVENTS })
    return json({ ok: true, endpoint: ep.id, url: ep.url, events: updated.enabled_events })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
