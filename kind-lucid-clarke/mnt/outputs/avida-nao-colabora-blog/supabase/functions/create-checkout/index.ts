import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

// Modelo NOVO: apenas dois planos pagos — Essencial (R$ 19,90) e Plus (R$ 39,90).
// Secrets em Supabase Dashboard → Edge Functions → Secrets.
//
// Preço do Plus (R$ 39,90): hoje o price de 39,90 vive em STRIPE_PRICE_THERAPEUTIC.
// GO-LIVE (ação externa sua): crie/repponte o secret STRIPE_PRICE_PLUS para o price
// de R$ 39,90 e ele passa a ter prioridade. NUNCA aponte STRIPE_PRICE_PLUS para o
// antigo price de R$ 79,90 — o fallback abaixo garante 39,90 enquanto isso.
const PLUS_PRICE_ID =
  Deno.env.get('STRIPE_PRICE_PLUS_3990')      // preferencial no go-live (R$ 39,90)
  || Deno.env.get('STRIPE_PRICE_THERAPEUTIC') // transição: já é o price de 39,90

type PaidPlan = 'essential' | 'plus'

const FALLBACK_PRICE_IDS: Record<PaidPlan, string | undefined> = {
  essential: Deno.env.get('STRIPE_PRICE_ESSENTIAL'),
  plus:      PLUS_PRICE_ID,
}

function isPaidPlan(value: unknown): value is PaidPlan {
  return value === 'essential' || value === 'plus'
}

// Origens permitidas para CORS e para o retorno pós-checkout (evita open-redirect).
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
// Mensagens que podem ir direto ao usuário (já em português, sem detalhe
// técnico). Qualquer outro erro (ex.: SDK do Stripe, que responde em inglês)
// cai no fallback genérico do catch — nunca vaza texto em inglês pro usuário.
class UserFacingError extends Error {}

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

Deno.serve(async (req) => {
  const cors = corsFor(req)
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
    if (authError || !user) throw new UserFacingError('Não autorizado')

    const { plan, origin } = await req.json()
    if (!isPaidPlan(plan)) throw new UserFacingError('Plano inválido. Escolha Essencial ou Plus.')
    const { data: priceCfg } = await supabase.from('plan_configs').select('stripe_price_id, active').eq('plan_key', plan).maybeSingle()
    // Plano desativado pelo Admin: não pode receber novas assinaturas. Assinantes
    // já ativos nesse plano não passam por aqui (fluxo de checkout é só para
    // quem ainda não tem assinatura ativa — ver checagem `existing` abaixo).
    if ((priceCfg as { active?: boolean } | null)?.active === false) {
      throw new UserFacingError('Este plano não está disponível para novas assinaturas no momento.')
    }
    const priceId = (priceCfg as { stripe_price_id?: string } | null)?.stripe_price_id || FALLBACK_PRICE_IDS[plan]
    if (!priceId) throw new UserFacingError(`Price ID não configurado para o plano ${plan}.`)

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

    const metadata = { supabase_user_id: user.id, plan }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/?view=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?view=pricing`,
      allow_promotion_codes: true,
      // A Session e a Subscription são objetos distintos no Stripe. Mantemos a
      // metadata nos dois para o webhook conseguir validar usuário/plano pela
      // assinatura real — sem depender apenas do navegador ou da Session.
      metadata,
      subscription_data: { metadata },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('create-checkout error:', err)
    const message = err instanceof UserFacingError
      ? err.message
      : 'Não foi possível iniciar o pagamento. Tente novamente em instantes.'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
