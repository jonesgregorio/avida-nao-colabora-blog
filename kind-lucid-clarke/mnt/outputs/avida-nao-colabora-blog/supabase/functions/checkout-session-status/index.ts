import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

const ALLOWED_ORIGINS = new Set([
  'https://avidanaocolabora.com',
  'https://www.avidanaocolabora.com',
  'https://avida-nao-colabora-blog.vercel.app',
])

function corsFor(req: Request) {
  const origin = req.headers.get('Origin')
  const allowed = origin && (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))
    ? origin
    : (Deno.env.get('SITE_URL') || 'https://avidanaocolabora.com')
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

const subscriptionId = (value: string | { id: string } | null): string | null =>
  typeof value === 'string' ? value : value?.id ?? null

function json(body: unknown, cors: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Esta função só CONSULTA Stripe e o estado persistido pelo webhook. Ela nunca
// altera plano, assinatura ou qualquer dado de cobrança.
Deno.serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, cors, 405)

  const authorization = req.headers.get('Authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json({ error: 'Não autorizado.' }, cors, 401)

  let sessionId: unknown
  try {
    ({ session_id: sessionId } = await req.json())
  } catch {
    return json({ error: 'Solicitação inválida.' }, cors, 400)
  }
  if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return json({ error: 'Sessão de pagamento inválida.' }, cors, 400)
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const stripeSubId = subscriptionId(session.subscription)
    const stripeCustomerId = subscriptionId(session.customer)

    // O identificador vindo da URL só pode consultar a sessão do próprio usuário.
    if (session.metadata?.supabase_user_id !== user.id || !stripeSubId || !stripeCustomerId) {
      return json({ error: 'Sessão de pagamento não corresponde à sua conta.' }, cors, 403)
    }

    const [{ data: profile }, { data: savedSubscription }, { data: events }] = await Promise.all([
      supabase.from('profiles').select('stripe_customer_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_subscriptions')
        .select('plan_key,status,provider_customer_id,provider_subscription_id')
        .eq('user_id', user.id).eq('provider_subscription_id', stripeSubId).maybeSingle(),
      supabase.from('subscription_events')
        .select('metadata')
        .eq('user_id', user.id)
        .eq('event_type', 'checkout_completed')
        .eq('stripe_subscription_id', stripeSubId)
        .eq('status', 'confirmed')
        .order('occurred_at', { ascending: false })
        .limit(5),
    ])

    if (profile?.stripe_customer_id !== stripeCustomerId || savedSubscription?.provider_customer_id !== stripeCustomerId) {
      return json({ error: 'Sessão de pagamento não corresponde à sua conta.' }, cors, 403)
    }

    const webhookConfirmed = (events ?? []).some((event) =>
      (event.metadata as { session_id?: unknown } | null)?.session_id === session.id,
    )
    const subscriptionActive = savedSubscription?.status === 'active' || savedSubscription?.status === 'trialing'
    if (webhookConfirmed && subscriptionActive) {
      return json({ status: 'confirmed', plan: savedSubscription?.plan_key }, cors)
    }

    return json({ status: 'processing' }, cors)
  } catch (error) {
    console.error('checkout-session-status:', error instanceof Error ? error.message : 'erro desconhecido')
    return json({ error: 'Não foi possível consultar a confirmação agora.' }, cors, 502)
  }
})
