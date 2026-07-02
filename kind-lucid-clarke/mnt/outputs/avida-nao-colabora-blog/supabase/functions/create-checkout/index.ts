import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
})

// ATENÇÃO: Price IDs de produção Stripe usados como fallback quando as env vars não estão definidas.
// Em produção, configure obrigatoriamente as seguintes variáveis no Supabase Dashboard:
//   STRIPE_PRICE_ESSENTIAL, STRIPE_PRICE_THERAPEUTIC, STRIPE_PRICE_PLUS
// Os IDs hardcoded abaixo são de produção real — não os exponha publicamente.
const PRICE_IDS: Record<string, string> = {
  essential:          Deno.env.get('STRIPE_PRICE_ESSENTIAL')    || 'price_1To2n05xvJV4HLHz8ym64uYH',
  therapeutic:        Deno.env.get('STRIPE_PRICE_THERAPEUTIC')  || 'price_1To2n15xvJV4HLHzqQWylm4W',
  'therapeutic-plus': Deno.env.get('STRIPE_PRICE_PLUS')        || 'price_1To2n15xvJV4HLHz2BoMO7ie',
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { plan } = await req.json()
    const priceId = PRICE_IDS[plan]
    if (!priceId) throw new Error(`Plano inválido ou Price ID não configurado: ${plan}`)

    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:5173'

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
  } catch (err: any) {
    console.error('create-checkout error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
