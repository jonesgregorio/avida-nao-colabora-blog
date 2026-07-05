import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Eventos que o webhook (stripe-webhook) trata.
const WEBHOOK_EVENTS = [
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

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Não autorizado' }, 401)
  const { data: prof } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if ((prof as { role?: string } | null)?.role !== 'admin') return json({ error: 'Apenas admin' }, 403)

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
