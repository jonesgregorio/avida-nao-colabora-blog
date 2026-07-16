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

// Eventos que o stripe-webhook trata. Mesma lista da configure-stripe-webhook —
// se divergir, o endpoint deixa de avisar o app sobre pagamento/ciclo.
const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

type SB = ReturnType<typeof createClient>

// Réplica exata do buildPlanByPrice() do stripe-webhook — para diagnosticar se um
// price_id real cairia (ou não) no mapa que decide o plano.
function PLAN_BY_PRICE_ENV(): Record<string, string> {
  const map: Record<string, string> = {}
  const essential = Deno.env.get('STRIPE_PRICE_ESSENTIAL')
  const plusNew = Deno.env.get('STRIPE_PRICE_PLUS_3990')
  const therapeutic = Deno.env.get('STRIPE_PRICE_THERAPEUTIC')
  const plusLegacy = Deno.env.get('STRIPE_PRICE_PLUS')
  if (essential) map[essential] = 'essential'
  if (plusNew) map[plusNew] = 'plus'
  if (therapeutic) map[therapeutic] = 'plus'
  if (plusLegacy) map[plusLegacy] = 'plus'
  return map
}

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
    // ATENÇÃO: o stripe-webhook já grava `amount` EM REAIS (faz amount_paid/100 na
    // hora de inserir). Dividir de novo aqui mostrava 19,90 como "0,20".
    try {
      const { data, error } = await supabase.from('payment_events').select('amount, created_at').order('created_at', { ascending: false }).limit(500)
      if (error) throw error
      const rows = (data as { amount: number | null; created_at: string }[]) || []
      const porValor: Record<string, number> = {}
      for (const r of rows) {
        const brl = r.amount != null ? r.amount.toFixed(2).replace('.', ',') : '∅'
        porValor[brl] = (porValor[brl] || 0) + 1
      }
      out.payment_events = { total_lidos: rows.length, valores_brl: porValor, ultimo: rows[0]?.created_at ?? null }
    } catch (e) { out.payment_events = { error: (e as Error).message } }

    // Histórico de mudança de plano — valores cobrados (também já EM REAIS).
    try {
      const { data, error } = await supabase.from('plan_change_history').select('amount_charged').limit(500)
      if (error) throw error
      const rows = (data as { amount_charged: number | null }[]) || []
      const porValor: Record<string, number> = {}
      for (const r of rows) {
        const brl = r.amount_charged != null ? r.amount_charged.toFixed(2).replace('.', ',') : '∅'
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

  // ── Escopo "diagnose": por que um evento não virou linha no banco? ──
  // Cruza os eventos que o STRIPE emitiu com os que o WEBHOOK processou
  // (stripe_webhook_events = tabela de idempotência) e com payment_events.
  // Assim dá para distinguir "evento nunca chegou" de "chegou e falhou".
  if (body.scope === 'diagnose') {
    try {
      const evs = await stripe.events.list({ limit: 30 })
      const emitidos = evs.data.map((e) => ({
        id: e.id,
        tipo: e.type,
        criado: new Date(e.created * 1000).toISOString(),
        webhooks_pendentes: e.pending_webhooks, // 0 = Stripe entregou a todos
      }))

      const { data: proc } = await supabase
        .from('stripe_webhook_events')
        .select('stripe_event_id, event_type, created_at')
        .order('created_at', { ascending: false }).limit(50)
      const processados = new Set(((proc as { stripe_event_id: string }[]) || []).map((p) => p.stripe_event_id))

      const cruzamento = emitidos.map((e) => ({
        ...e,
        processado_pelo_webhook: processados.has(e.id),
      }))
      const naoProcessados = cruzamento.filter((e) => !e.processado_pelo_webhook)

      const { data: pays } = await supabase
        .from('payment_events')
        .select('amount, type, provider_payment_id, created_at')
        .order('created_at', { ascending: false }).limit(10)

      // ── Por que o handler da invoice não gravou payment_events? ──
      // Ele busca o perfil por stripe_customer_id e sai calado se não achar.
      // Aqui refazemos exatamente essa busca com o customer do evento real.
      let invoiceTrace: Record<string, unknown> = { nota: 'Nenhum invoice.payment_succeeded recente.' }
      const invEvent = evs.data.find((e) => e.type === 'invoice.payment_succeeded')
      if (invEvent) {
        const inv = invEvent.data.object as Stripe.Invoice
        const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null
        const { data: pMatch, error: pErr } = await supabase
          .from('profiles').select('user_id, plan, stripe_customer_id').eq('stripe_customer_id', customerId)
        const { count: totalComCustomer } = await supabase
          .from('profiles').select('user_id', { count: 'exact', head: true }).not('stripe_customer_id', 'is', null)

        let priceId: string | null = null
        let planMapeado: string | null = null
        try {
          if (inv.subscription) {
            const s = await stripe.subscriptions.retrieve(inv.subscription as string)
            priceId = s.items.data[0]?.price.id ?? null
            planMapeado = priceId ? (PLAN_BY_PRICE_ENV()[priceId] ?? null) : null
          }
        } catch (e) { priceId = `erro: ${(e as Error).message}` }

        invoiceTrace = {
          evento_id: invEvent.id,
          invoice_id: inv.id,
          invoice_tem_subscription: !!inv.subscription,
          valor_pago_reais: (inv.amount_paid ?? 0) / 100,
          customer_do_evento: customerId,
          perfis_com_esse_customer: pMatch?.length ?? 0,
          perfil_encontrado: (pMatch?.length ?? 0) === 1,
          erro_busca_perfil: pErr?.message ?? null,
          total_perfis_com_stripe_customer_id: totalComCustomer ?? 0,
          price_id_da_assinatura: priceId,
          plano_mapeado: planMapeado,
          diagnostico:
            (pMatch?.length ?? 0) === 0
              ? 'CAUSA: nenhum profile tem esse stripe_customer_id → o handler sai no early-return sem gravar payment_events.'
              : (pMatch?.length ?? 0) > 1
                ? 'CAUSA: mais de um profile com o mesmo stripe_customer_id → .single() falha.'
                : !planMapeado
                  ? 'CAUSA: price_id não mapeado em PLAN_BY_PRICE → handler sai antes de gravar.'
                  : 'Perfil e plano OK — a falha é no INSERT de payment_events (ver constraint/coluna).',
        }
      }

      return json({
        scope: 'diagnose',
        invoice_trace: invoiceTrace,
        eventos_stripe: cruzamento,
        webhook_events_recentes: proc ?? [],
        payment_events_recentes: pays ?? [],
        leitura: 'Eventos "não processados" que o endpoint não assina são normais e esperados. Veja invoice_trace para a causa real.',
        checked_at: new Date().toISOString(),
        note: 'Somente leitura.',
      })
    } catch (e) {
      return json({ scope: 'diagnose', error: (e as Error).message }, 500)
    }
  }

  // ── Escopo "webhook": confere o endpoint e os eventos SEM alterar nada ──
  // (a configure-stripe-webhook ESCREVE; esta aqui só lê e compara.)
  if (body.scope === 'webhook') {
    const target = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-webhook`
    const wWarnings: string[] = []
    try {
      const list = await stripe.webhookEndpoints.list({ limit: 100 })
      const ep = list.data.find((e) => e.url === target)
      if (!ep) {
        wWarnings.push(`Nenhum endpoint de webhook aponta para ${target} — o Stripe não consegue avisar o app sobre pagamentos/ciclo.`)
        return json({
          ok: false, scope: 'webhook', esperado: { url: target, eventos: WEBHOOK_EVENTS },
          endpoint: null, endpoints_existentes: list.data.map((e) => ({ url: e.url, status: e.status, livemode: e.livemode })),
          warnings: wWarnings, checked_at: new Date().toISOString(),
        })
      }
      const enabled = ep.enabled_events ?? []
      const faltando = WEBHOOK_EVENTS.filter((e) => !enabled.includes(e) && !enabled.includes('*'))
      const extras = enabled.filter((e) => e !== '*' && !WEBHOOK_EVENTS.includes(e))
      if (ep.status !== 'enabled') wWarnings.push(`Endpoint está "${ep.status}" — precisa estar "enabled".`)
      if (!ep.livemode) wWarnings.push('Endpoint está em modo TESTE — não recebe eventos das cobranças reais.')
      if (faltando.length) wWarnings.push(`Eventos obrigatórios faltando: ${faltando.join(', ')}. Use "Configurar eventos do webhook".`)
      if (!Deno.env.get('STRIPE_WEBHOOK_SECRET')) wWarnings.push('STRIPE_WEBHOOK_SECRET ausente — a assinatura dos eventos não é validada.')

      return json({
        ok: wWarnings.length === 0,
        scope: 'webhook',
        endpoint: {
          id: ep.id, url: ep.url, status: ep.status, livemode: ep.livemode,
          eventos_ativos: enabled, eventos_faltando: faltando, eventos_extras: extras,
        },
        esperado: { url: target, eventos: WEBHOOK_EVENTS },
        webhook_secret_present: !!Deno.env.get('STRIPE_WEBHOOK_SECRET'),
        warnings: wWarnings,
        checked_at: new Date().toISOString(),
        note: 'Somente leitura: nenhum endpoint foi criado ou alterado.',
      })
    } catch (e) {
      return json({ ok: false, scope: 'webhook', error: (e as Error).message }, 500)
    }
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

  const warnings: string[] = []   // problemas reais — derrubam o `ok`
  const notes: string[] = []      // informativo — não derruba o `ok`
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

    // O secret legado STRIPE_PRICE_PLUS (antigo R$ 79,90) NÃO cobra nada: create-checkout,
    // manage-subscription e selftest usam STRIPE_PRICE_PLUS_3990/THERAPEUTIC. Ele só existe
    // como chave do mapa PLAN_BY_PRICE do webhook. Se estiver ilegível (ex.: price de uma
    // conta antiga), isso é informativo — não pode derrubar o `ok` da auditoria.
    if (priceEnv.plus_legacy_79) {
      const legacy = await auditPrice('plus_legacy_79', priceEnv.plus_legacy_79)
      prices.plus_legacy_79 = { ...legacy.row, cobra: false, observacao: 'Secret legado; não usado para cobrança.' }
      if (legacy.warnings.length > 0) {
        notes.push('Secret STRIPE_PRICE_PLUS aponta para um price inexistente nesta conta (provável sobra da conta antiga). Não afeta cobrança — pode ser removido dos secrets.')
      }
    }

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
  // `ok` = os preços que realmente cobram estão certos, o webhook valida assinatura e
  // não há problema real. Secret legado ilegível vira `notes`, não derruba nada.
  const ok = essentialOk && plusOk && webhookSecretPresent && warnings.length === 0
  // Go-live de verdade: além da config, a conta precisa poder cobrar em modo live.
  const prontoParaCobrar = ok && keyMode === 'live' && (account as { charges_enabled?: boolean })?.charges_enabled === true

  return json({
    ok,
    pronto_para_cobrar: prontoParaCobrar,
    mode: keyMode,
    key_present: !!secret,
    key_restricted: keyRestricted,
    webhook_secret_present: webhookSecretPresent,
    plus_price_source: plusSource,
    expected_amounts: { essential_brl: '19,90', plus_brl: '39,90' },
    account,
    prices,
    warnings,
    notes,
    checked_at: new Date().toISOString(),
    note: 'Auditoria somente-leitura. Nenhum objeto do Stripe foi criado, alterado ou removido. A chave secreta nunca é retornada.',
  })
})
