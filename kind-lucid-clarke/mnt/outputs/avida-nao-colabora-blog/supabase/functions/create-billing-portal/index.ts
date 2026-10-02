import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Abre o Portal do Cliente do Stripe para o usuário logado trocar o cartão,
// ver faturas e editar dados de cobrança. Nunca recebe nem armazena dados de cartão.
// Cancelamento e troca de plano NÃO ficam no portal (fluxo próprio: manage-subscription).

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

const ALLOWED_ORIGINS = new Set([
  'https://avidanaocolabora.com',
  'https://www.avidanaocolabora.com',
  'https://avida-nao-colabora-blog.vercel.app',
])

function corsHeaders(origin: string | null) {
  const allowed = origin && (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))
    ? origin
    : Deno.env.get('SITE_URL') ?? 'https://avidanaocolabora.com'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

Deno.serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req.headers.get('Origin'))
  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Não autorizado' }, 401)

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser()
  if (userErr || !user) return jsonResponse({ error: 'Não autorizado' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // O customer vem SEMPRE do banco, a partir do usuário autenticado — nunca do body.
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
  if (!customerId) {
    return jsonResponse({ error: 'Você ainda não possui uma assinatura paga. Os dados de pagamento ficam disponíveis após assinar um plano.' }, 400)
  }

  const site = Deno.env.get('SITE_URL') || Deno.env.get('APP_URL') || 'https://avidanaocolabora.com'
  const portalConfig = Deno.env.get('STRIPE_PORTAL_CONFIGURATION_ID')

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${site}/meu-plano`,
      ...(portalConfig ? { configuration: portalConfig } : {}),
    })
    return jsonResponse({ ok: true, url: session.url })
  } catch (err) {
    console.error('create-billing-portal:', (err as Error).message)
    return jsonResponse({ error: 'Não foi possível abrir o gerenciamento de pagamento agora. Tente novamente em instantes.' }, 502)
  }
})
