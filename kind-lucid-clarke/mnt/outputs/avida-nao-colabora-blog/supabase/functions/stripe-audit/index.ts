import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Valores esperados (em centavos) — fonte da verdade do produto: Essencial R$19,90 / Plus R$39,90.
const EXPECTED = { essential: 1990, plus: 3990 }

// AUDITORIA (somente leitura): confirma modo (live/test), preços configurados,
// valor/moeda/recorrência de cada um, presença do webhook secret e estado da conta.
// NÃO cria, NÃO atualiza, NÃO apaga nada no Stripe. NUNCA retorna a chave secreta.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // ── Gate: apenas admin autenticado ──
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Não autorizado' }, 401)
  const { data: prof } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if ((prof as { role?: string } | null)?.role !== 'admin') return json({ error: 'Apenas admin' }, 403)

  const secret = Deno.env.get('STRIPE_SECRET_KEY') || ''
  // Modo derivado só do PREFIXO — a chave em si nunca sai daqui.
  const keyMode = secret.startsWith('sk_live_') || secret.startsWith('rk_live_') ? 'live'
    : secret.startsWith('sk_test_') || secret.startsWith('rk_test_') ? 'test'
    : secret ? 'desconhecido' : 'ausente'
  const keyRestricted = secret.startsWith('rk_')

  const priceEnv: Record<string, string | undefined> = {
    essential: Deno.env.get('STRIPE_PRICE_ESSENTIAL'),
    plus: Deno.env.get('STRIPE_PRICE_PLUS_3990') || Deno.env.get('STRIPE_PRICE_THERAPEUTIC'),
    plus_legacy_79: Deno.env.get('STRIPE_PRICE_PLUS'),
  }
  // Qual secret alimentou o preço do Plus (rastreabilidade da migração de go-live).
  const plusSource = Deno.env.get('STRIPE_PRICE_PLUS_3990') ? 'STRIPE_PRICE_PLUS_3990'
    : Deno.env.get('STRIPE_PRICE_THERAPEUTIC') ? 'STRIPE_PRICE_THERAPEUTIC (fallback)'
    : 'não configurado'

  const warnings: string[] = []
  const prices: Record<string, unknown> = {}

  async function auditPrice(key: string, id: string | undefined, expectedCents?: number) {
    if (!id) { prices[key] = { configured: false }; return }
    try {
      const p = await stripe.prices.retrieve(id, { expand: ['product'] })
      const product = p.product as Stripe.Product
      const amount = p.unit_amount ?? null
      const row = {
        configured: true,
        id: p.id,
        active: p.active,
        livemode: p.livemode,
        unit_amount: amount,
        amount_brl: amount != null ? (amount / 100).toFixed(2).replace('.', ',') : null,
        currency: p.currency,
        interval: p.recurring?.interval ?? null,
        interval_count: p.recurring?.interval_count ?? null,
        product_id: typeof product === 'object' ? product.id : product,
        product_name: typeof product === 'object' ? product.name : null,
        product_active: typeof product === 'object' ? product.active : null,
      }
      prices[key] = row
      if (!p.active) warnings.push(`Preço "${key}" (${p.id}) está INATIVO no Stripe.`)
      if (p.currency !== 'brl') warnings.push(`Preço "${key}" está em ${p.currency.toUpperCase()}, esperado BRL.`)
      if (p.recurring?.interval !== 'month') warnings.push(`Preço "${key}" não é mensal (interval=${p.recurring?.interval}).`)
      if (expectedCents != null && amount !== expectedCents) {
        warnings.push(`Preço "${key}" é ${amount != null ? (amount / 100).toFixed(2) : '—'}, esperado ${(expectedCents / 100).toFixed(2)}.`)
      }
    } catch (e) {
      prices[key] = { configured: true, id, found: false, error: (e as Error).message }
      warnings.push(`Preço "${key}" (${id}) não pôde ser lido — pode estar em outro modo (test/live) ou não existir.`)
    }
  }

  let account: Record<string, unknown> = {}
  try {
    if (!secret) throw new Error('STRIPE_SECRET_KEY ausente nas Edge Functions.')
    await auditPrice('essential', priceEnv.essential, EXPECTED.essential)
    await auditPrice('plus', priceEnv.plus, EXPECTED.plus)
    if (priceEnv.plus_legacy_79) await auditPrice('plus_legacy_79', priceEnv.plus_legacy_79)

    try {
      const acct = await stripe.accounts.retrieve()
      account = {
        id: acct.id,
        country: acct.country,
        default_currency: acct.default_currency,
        charges_enabled: acct.charges_enabled,
        payouts_enabled: acct.payouts_enabled,
        details_submitted: acct.details_submitted,
      }
    } catch (e) { account = { error: (e as Error).message } }

    // Coerência de modo: prefixo da chave vs. livemode real dos preços lidos.
    const priceLive = Object.values(prices).map((v) => (v as { livemode?: boolean }).livemode).filter((v) => v !== undefined)
    if (keyMode === 'live' && priceLive.some((v) => v === false)) warnings.push('Chave em modo LIVE mas há preço em modo TESTE — inconsistência de modo.')
    if (keyMode === 'test' && priceLive.some((v) => v === true)) warnings.push('Chave em modo TESTE mas há preço em modo LIVE — inconsistência de modo.')
    if (keyMode === 'test') warnings.push('Stripe está em modo TESTE (sk_test_). Cobranças reais não acontecem neste modo.')
  } catch (e) {
    warnings.push((e as Error).message)
  }

  const webhookSecretPresent = !!Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecretPresent) warnings.push('STRIPE_WEBHOOK_SECRET ausente — a validação de assinatura do webhook não funciona.')

  const essentialOk = (prices.essential as { active?: boolean; unit_amount?: number })?.active === true && (prices.essential as { unit_amount?: number })?.unit_amount === EXPECTED.essential
  const plusOk = (prices.plus as { active?: boolean; unit_amount?: number })?.active === true && (prices.plus as { unit_amount?: number })?.unit_amount === EXPECTED.plus
  const ok = essentialOk && plusOk && webhookSecretPresent && warnings.filter((w) => w.includes('inconsistência') || w.includes('não pôde ser lido')).length === 0

  return json({
    ok,
    mode: keyMode,
    key_present: !!secret,
    key_restricted: keyRestricted,
    webhook_secret_present: webhookSecretPresent,
    plus_price_source: plusSource,
    expected_amounts: { essential_brl: '19,90', plus_brl: '39,90' },
    account,
    prices,
    warnings,
    checked_at: new Date().toISOString(),
    note: 'Auditoria somente-leitura. Nenhum objeto do Stripe foi criado, alterado ou removido. A chave secreta nunca é retornada.',
  })
})
