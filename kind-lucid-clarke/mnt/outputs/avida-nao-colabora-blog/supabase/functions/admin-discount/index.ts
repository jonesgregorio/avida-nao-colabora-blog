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

// Erro de REGRA (input inválido, usuário sem cliente no Stripe): volta 200 com
// ok:false de propósito — em não-2xx o supabase-js entrega só "non-2xx status" e
// a explicação nunca chegaria ao admin. Falha de auth/infra continua 4xx/5xx.
function regra(msg: string, extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, error: msg, ...extra }, 200)
}

interface Body {
  user_id: string
  action?: 'apply' | 'remove'
  discount_percent?: number
  discount_fixed?: number
  discount_code?: string | null
  discount_until?: string | null
  discount_reason?: string | null
}

// Meses (arredondando p/ cima) entre agora e a data limite — o Coupon do Stripe
// expressa duração em meses, não em data final.
function monthsUntil(until: string): number {
  const end = new Date(until).getTime()
  const diff = end - Date.now()
  if (!Number.isFinite(end) || diff <= 0) return 0
  return Math.max(1, Math.ceil(diff / (30 * 86_400_000)))
}

// Desconto administrativo COM efeito real na cobrança: cria um Coupon no Stripe e
// aplica na assinatura do usuário (ou no cliente, se ainda não assinou — aí vale
// no próximo checkout). Antes disso, as colunas discount_* eram só decorativas.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Não autorizado' }, 401)
  const { data: prof } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if ((prof as { role?: string } | null)?.role !== 'admin') return json({ error: 'Apenas admin' }, 403)

  let body: Body
  try { body = await req.json() } catch { return json({ error: 'Body inválido' }, 400) }
  if (!body.user_id) return json({ error: 'user_id obrigatório' }, 400)

  // Alvo: cliente e assinatura do usuário
  const { data: target } = await supabase
    .from('profiles').select('stripe_customer_id, discount_stripe_coupon_id, email')
    .eq('user_id', body.user_id).maybeSingle()
  const alvo = target as { stripe_customer_id?: string; discount_stripe_coupon_id?: string; email?: string } | null
  const customerId = alvo?.stripe_customer_id ?? null

  const { data: subRow } = await supabase
    .from('user_subscriptions').select('provider_subscription_id')
    .eq('user_id', body.user_id).maybeSingle()
  const subId = (subRow as { provider_subscription_id?: string } | null)?.provider_subscription_id ?? null

  // Tira o desconto de onde estiver aplicado. Nunca lança: se o objeto já sumiu
  // do Stripe, o efeito desejado (não ter desconto) já está valendo.
  async function removerDoStripe(): Promise<string[]> {
    const passos: string[] = []
    if (subId) {
      try { await stripe.subscriptions.deleteDiscount(subId); passos.push(`desconto removido da assinatura ${subId}`) }
      catch (e) { passos.push(`assinatura: ${(e as Error).message}`) }
    }
    if (customerId) {
      try { await stripe.customers.deleteDiscount(customerId); passos.push(`desconto removido do cliente ${customerId}`) }
      catch (e) { passos.push(`cliente: ${(e as Error).message}`) }
    }
    if (alvo?.discount_stripe_coupon_id) {
      try { await stripe.coupons.del(alvo.discount_stripe_coupon_id); passos.push(`cupom ${alvo.discount_stripe_coupon_id} apagado`) }
      catch (e) { passos.push(`cupom: ${(e as Error).message}`) }
    }
    return passos
  }

  try {
    // ── REMOVER ──
    if (body.action === 'remove') {
      const passos = await removerDoStripe()
      const { error } = await supabase.from('profiles').update({
        discount_percent: 0, discount_fixed: 0, discount_code: null,
        discount_until: null, discount_reason: null, discount_stripe_coupon_id: null,
      }).eq('user_id', body.user_id)
      if (error) throw new Error('Banco: ' + error.message)
      return json({ ok: true, action: 'remove', passos })
    }

    // ── APLICAR ──
    const percent = Number(body.discount_percent ?? 0)
    const fixed = Number(body.discount_fixed ?? 0)

    if (percent > 0 && fixed > 0) {
      return regra('Escolha só um: desconto em % OU valor fixo. Os dois juntos ficam ambíguos.')
    }
    if (percent <= 0 && fixed <= 0) {
      return regra('Informe um desconto em % (1-100) ou um valor fixo em R$.')
    }
    if (percent < 0 || percent > 100) return regra('Desconto em % deve ficar entre 1 e 100.')
    if (fixed < 0) return regra('Valor fixo não pode ser negativo.')

    // Precisa existir cliente no Stripe: sem isso não há onde pendurar o cupom.
    if (!customerId) {
      return regra('Este usuário ainda não tem cliente no Stripe (nunca iniciou um checkout), então o desconto não teria onde ser aplicado. Peça para iniciar uma assinatura, ou envie um código promocional do Stripe — o checkout já aceita.')
    }

    // Limpa qualquer desconto anterior para não empilhar cupons.
    const limpeza = await removerDoStripe()

    const until = body.discount_until || null
    const meses = until ? monthsUntil(until) : 0
    if (until && meses === 0) return regra('A data "válido até" já passou.')

    const coupon = await stripe.coupons.create({
      ...(percent > 0
        ? { percent_off: percent }
        : { amount_off: Math.round(fixed * 100), currency: 'brl' }),
      duration: until ? 'repeating' : 'forever',
      ...(until ? { duration_in_months: meses } : {}),
      name: body.discount_reason || body.discount_code || `Desconto administrativo — ${alvo?.email ?? body.user_id}`,
      metadata: { user_id: body.user_id, origem: 'admin', concedido_por: user.id },
    })

    // Assinatura ativa → vale já na próxima fatura. Sem assinatura → fica no
    // cliente e entra quando ele assinar.
    let aplicadoEm: string
    if (subId) {
      await stripe.subscriptions.update(subId, { coupon: coupon.id })
      aplicadoEm = `assinatura ${subId} (vale na próxima fatura)`
    } else {
      await stripe.customers.update(customerId, { coupon: coupon.id })
      aplicadoEm = `cliente ${customerId} (entra quando ele assinar)`
    }

    const { error } = await supabase.from('profiles').update({
      discount_percent: percent,
      discount_fixed: fixed,
      discount_code: body.discount_code || null,
      discount_until: until,
      discount_reason: body.discount_reason || null,
      discount_stripe_coupon_id: coupon.id,
    }).eq('user_id', body.user_id)
    if (error) throw new Error('Banco: ' + error.message)

    return json({
      ok: true,
      action: 'apply',
      cupom: coupon.id,
      resumo: percent > 0 ? `${percent}% de desconto` : `R$ ${fixed.toFixed(2).replace('.', ',')} de desconto`,
      duracao: until ? `${meses} mês(es), até ${new Date(until).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : 'enquanto a assinatura durar',
      aplicado_em: aplicadoEm,
      limpeza_anterior: limpeza,
    })
  } catch (e) {
    console.error('admin-discount:', (e as Error).message)
    return json({ error: (e as Error).message }, 500)
  }
})
