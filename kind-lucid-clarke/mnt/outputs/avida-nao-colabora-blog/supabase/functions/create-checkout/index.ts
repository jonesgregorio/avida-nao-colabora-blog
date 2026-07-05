import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
})

// Configure obrigatoriamente no Supabase Dashboard → Edge Functions → Secrets:
//   STRIPE_PRICE_ESSENTIAL, STRIPE_PRICE_THERAPEUTIC, STRIPE_PRICE_PLUS
const PRICE_IDS: Record<string, string | undefined> = {
  essential:          Deno.env.get('STRIPE_PRICE_ESSENTIAL'),
  therapeutic:        Deno.env.get('STRIPE_PRICE_THERAPEUTIC'),
  'therapeutic-plus': Deno.env.get('STRIPE_PRICE_PLUS'),
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Origens permitidas para o retorno pós-checkout (evita open-redirect).
// Aceita a origem que o navegador enviou SÓ se estiver na lista; senão usa SITE_URL.
const ALLOWED_ORIGINS = new Set([
  'https://avidanaocolabora.com',
  'https://www.avidanaocolabora.com',
  'https://avida-nao-colabora-blog.vercel.app',
])
function resolveSiteUrl(origin: unknown): string {
  if (typeof origin === 'string') {
    if (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) return origin
  }
  return Deno.env.get('SITE_URL') || 'http://localhost:5173'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Valida o token JWT do usuário logado
    const authHeader = req.headers.get('Authorization') || ''
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) throw new Error('Não autorizado')

    const { plan, origin } = await req.json()
    const priceId = PRICE_IDS[plan]
    if (!priceId) throw new Error(`Plano inválido ou Price ID não configurado: ${plan}`)

    // Retorno na MESMA origem do navegador (validada) — evita logout apex vs www.
    const siteUrl = resolveSiteUrl(origin)

    // Busca ou cria o Stripe Customer vinculado ao usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('user_id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name || undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id)
    }

    // Impede assinatura DUPLICADA: se o cliente já tem assinatura ativa, a troca de plano
    // deve ir por manage-subscription (upgrade/downgrade), não um novo checkout.
    const existing = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 })
    if (existing.data.length > 0) {
      return new Response(JSON.stringify({ error: 'Você já tem uma assinatura ativa. Use "Mudar plano" para trocar de plano.' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/?view=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?view=pricing`,
      allow_promotion_codes: true,
      metadata: { supabase_user_id: user.id, plan },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('create-checkout error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
