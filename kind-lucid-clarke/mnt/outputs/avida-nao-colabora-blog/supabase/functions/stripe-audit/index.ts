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

type SB = ReturnType<typeof createClient>

// Conta ocorrências de uma coluna (agregado, sem PII).
async function tallyCol(sb: SB, table: string, col: string) {
  const { data, error } = await sb.from(table).select(col)
  if (error) return { error: error.message }
  const counts: Record<string, number> = {}
  for (const row of (data as Record<string, unknown>[]) || []) {
    const k = String(row[col] ?? '∅')
    counts[k] = (counts[k] || 0) + 1
  }
  return counts
}

// Lê um price do Stripe (com produto) e devolve linha + avisos — nada de escrita.
async function auditPrice(key: string, id: string | undefined, expectedCents?: number) {
  const warnings: string[] = []
  if (!id) return { row: { configured: false }, warnings }
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
    if (!p.active) warnings.push(`Preço "${key}" (${p.id}) está INATIVO no Stripe.`)
    if (p.currency !== 'brl') warnings.push(`Preço "${key}" está em ${p.currency.toUpperCase()}, esperado BRL.`)
    if (p.recurring?.interval !== 'month') warnings.push(`Preço "${key}" não é mensal (interval=${p.recurring?.interval}).`)
    if (expectedCents != null && amount !== expectedCents) {
      warnings.push(`Preço "${key}" é ${amount != null ? (amount / 100).toFixed(2) : '—'}, esperado ${(expectedCents / 100).toFixed(2)}.`)
    }
    return { row, warnings }
  } catch (e) {
    warnings.push(`Preço "${key}" (${id}) não pôde ser lido — pode estar em outro modo (test/live) ou não existir.`)
    return { row: { configured: true, id, found: false, error: (e as Error).message }, warnings }
  }
}

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

  let body: { scope?: string } = {}
  try { body = await req.json() } catch { /* sem body */ }

  const priceEssential = Deno.env.get('STRIPE_PRICE_ESSENTIAL')
  const pricePlus = Deno.env.get('STRIPE_PRICE_PLUS_3990') || Deno.env.get('STRIPE_PRICE_THERAPEUTIC')

  // ── Escopo "db": cruza os dados JÁ sincronizados no Supabase com o Stripe ──
  // (service role: enxerga todas as linhas; leitura pura; agrega, sem PII).
  if (body.scope === 'db') {
    const dbWarnings: string[] = []
    const out: Record<string, unknown> = {}

    out.profiles_por_plano = await tallyCol(supabase, 'profiles', 'plan')
    out.assinaturas_por_plan_key = await tallyCol(supabase, 'user_subscriptions', 'plan_key')
    out.assinaturas_por_payment_status = await tallyCol(supabase, 'user_subscriptions', 'payment_status')
    out.assinaturas_por_status = await tallyCol(supabase, 'user_subscriptions', 'status')
    out.price_ids_em_uso = await tallyCol(supabase, 'user_subscriptions', 'price_id')

    // Valores realmente cobrados (payment_events) — agregados por valor.
    try {
      const { data, error } = await supabase.from('payment_events').select('amount, created_at').order('created_at', { ascending: false }).limit(500)
      if (error) throw error
      const rows = (data as { amount: number | null; created_at: string }[]) || []
      const porValor: Record<string, number> = {}
      for (const r of rows) {
        const brl = r.amount != null ? (r.amount / 100).toFixed(2).replace('.', ',') : '∅'
        porValor[brl] = (porValor[brl] || 0) + 1
      }
      out.payment_events = { total_lidos: rows.length, valores_brl: porValor, ultimo: rows[0]?.created_at ?? null }
    } catch (e) { out.payment_events = { error: (e as Error).message } }

    // Histórico de mudança de plano — valores cobrados.
    try {
      const { data, error } = await supabase.from('plan_change_history').select('amount_charged').limit(500)
      if (error) throw error
      const rows = (data as { amount_charged: number | null }[]) || []
      const porValor: Record<string, number> = {}
      for (const r of rows) {
        const brl = r.amount_charged != null ? (r.amount_charged / 100).toFixed(2).replace('.', ',') : '∅'
        porValor[brl] = (porValor[brl] || 0) + 1
      }
      out.plan_change_history = { total_lidos: rows.length, valores_cobrados_brl: porValor }
    } catch (e) { out.plan_change_history = { error: (e as Error).message } }

    // Cross-check: os price_ids vistos no banco batem com os configurados nas Edge Functions?
    const usados = out.price_ids_em_uso as Record<string, number> | { error: string }
    if (usados && !('error' in usados)) {
      const conhecidos = new Set([priceEssential, pricePlus].filter(Boolean) as string[])
      for (const pid of Object.keys(usados)) {
        if (pid === '∅') continue
        if (!conhecidos.has(pid)) dbWarnings.push(`price_id "${pid}" aparece em assinaturas mas NÃO é o STRIPE_PRICE_ESSENTIAL nem o preço Plus configurado — assinatura em preço legado/estranho.`)
      }
    }

    return json({
      ok: dbWarnings.length === 0,
      scope: 'db',
      configurado: { essential: priceEssential ?? null, plus: pricePlus ?? null },
      dados: out,
      warnings: dbWarnings,
      checked_at: new Date().toISOString(),
      note: 'Leitura agregada dos dados sincronizados no Supabase (service role). Sem dados pessoais; nenhuma escrita.',
    })
  }

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

  async function runPrice(key: string, id: string | undefined, expectedCents?: number) {
    const r = await auditPrice(key, id, expectedCents)
    prices[key] = r.row
    for (const w of r.warnings) warnings.push(w)
  }

  let account: Record<string, unknown> = {}
  try {
    if (!secret) throw new Error('STRIPE_SECRET_KEY ausente nas Edge Functions.')
    await runPrice('essential', priceEnv.essential, EXPECTED.essential)
    await runPrice('plus', priceEnv.plus, EXPECTED.plus)
    if (priceEnv.plus_legacy_79) await runPrice('plus_legacy_79', priceEnv.plus_legacy_79)

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
