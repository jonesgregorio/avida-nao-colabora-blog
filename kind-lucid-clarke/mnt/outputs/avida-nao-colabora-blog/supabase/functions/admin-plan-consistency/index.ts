import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdminAal2 } from '../_shared/adminAuth.ts'

// ─────────────────────────────────────────────────────────────────────────
// Verificador de consistência dos Planos e Assinaturas (Etapa 9).
// Só APONTA divergências — nunca corrige nada automaticamente. Compara:
//   catálogo (plan_features/plan_feature_access) × recursos técnicos oficiais
//   preço no banco × preço real configurado no Stripe
// Read-only: nenhuma escrita em nenhuma tabela nem no Stripe.
// ─────────────────────────────────────────────────────────────────────────

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' as Stripe.LatestApiVersion })
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Severity = 'critical' | 'warning' | 'info'
type Area = 'catalog' | 'plans' | 'prices' | 'stripe'
interface Finding { severity: Severity; area: Area; message: string }

// Mesma lista dos 13 recursos técnicos oficiais usada no frontend
// (officialPlans.ts) — duplicada aqui só com as chaves, pois Edge Functions
// não importam código de src/. Mantida em sincronia manual; um teste em
// tests/ trava o número de chaves para lembrar de atualizar os dois lados
// se o catálogo oficial mudar.
const OFFICIAL_FEATURE_KEYS = [
  'checkin_daily', 'articles_free', 'wellbeing_diary_5_month', 'diary_voice',
  'basic_self_assessment', 'biweekly_auto_challenges',
  'diary_unlimited', 'diary_mood_symptoms_summary', 'discoveries', 'full_history',
  'emotional_exercise_library', 'weekly_assessments', 'my_garden',
  'diary_deepenings', 'personalized_self_care_plan', 'advanced_monthly_report',
  'monthly_message_guidance',
]
const PAID_PLAN_KEYS = ['essential', 'plus'] as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const findings: Finding[] = []

  try {
    const [{ data: planConfigs }, { data: featureRows }, { data: accessRows }] = await Promise.all([
      supabase.from('plan_configs').select('plan_key, label, price, price_cents, price_currency, stripe_price_id, stripe_product_id, active'),
      supabase.from('plan_features').select('feature_key, feature_kind, is_system, is_active, show_on_pricing, show_on_my_plan, show_on_comparison, show_on_upgrade'),
      supabase.from('plan_feature_access').select('plan_key, feature_key, enabled'),
    ])

    // ── Catálogo ────────────────────────────────────────────────────────
    const features = (featureRows ?? []) as { feature_key: string; feature_kind: string | null; is_system: boolean | null; is_active: boolean | null; show_on_pricing: boolean | null; show_on_my_plan: boolean | null; show_on_comparison: boolean | null; show_on_upgrade: boolean | null }[]
    const seenKeys = new Map<string, number>()
    for (const f of features) seenKeys.set(f.feature_key, (seenKeys.get(f.feature_key) ?? 0) + 1)
    for (const [key, count] of seenKeys) {
      if (count > 1) findings.push({ severity: 'warning', area: 'catalog', message: `Recurso "${key}" aparece ${count} vezes no catálogo (feature_key duplicada).` })
    }

    const presentTechnicalKeys = new Set(features.filter(f => f.is_system !== false && f.feature_kind !== 'commercial').map(f => f.feature_key))
    for (const key of OFFICIAL_FEATURE_KEYS) {
      if (!presentTechnicalKeys.has(key)) {
        findings.push({ severity: 'info', area: 'catalog', message: `Recurso técnico oficial "${key}" não tem linha própria no catálogo — usando o padrão do código (não é um erro, só falta personalização comercial).` })
      }
    }
    for (const f of features) {
      const isCommercial = f.feature_kind === 'commercial' || f.is_system === false
      const isKnownTechnical = OFFICIAL_FEATURE_KEYS.includes(f.feature_key)
      if (isCommercial && isKnownTechnical) {
        findings.push({ severity: 'critical', area: 'catalog', message: `Recurso técnico oficial "${f.feature_key}" está marcado como comercial no catálogo — isso pode fazer parecer que um recurso do produto é só um rótulo de marketing.` })
      }
      const advertisedAnywhere = f.show_on_pricing || f.show_on_my_plan || f.show_on_comparison || f.show_on_upgrade
      if (f.is_active === false && advertisedAnywhere) {
        findings.push({ severity: 'warning', area: 'catalog', message: `Recurso "${f.feature_key}" está arquivado (inativo) mas ainda marcado para aparecer em alguma tela.` })
      }
    }

    const access = (accessRows ?? []) as { plan_key: string; feature_key: string; enabled: boolean | null }[]
    const commercialKeys = new Set(features.filter(f => f.feature_kind === 'commercial' || f.is_system === false).map(f => f.feature_key))
    for (const key of commercialKeys) {
      const grantedSomewhere = access.some(a => a.feature_key === key && a.enabled === true)
      if (!grantedSomewhere) {
        findings.push({ severity: 'warning', area: 'catalog', message: `Benefício comercial "${key}" não está habilitado para nenhum plano — não aparece em lugar nenhum do site.` })
      }
    }

    // ── Planos e preços (banco) ─────────────────────────────────────────
    const configs = (planConfigs ?? []) as { plan_key: string; label: string; price: string; price_cents: number | null; price_currency: string | null; stripe_price_id: string | null; stripe_product_id: string | null; active: boolean }[]
    for (const cfg of configs) {
      if (!cfg.active) {
        findings.push({ severity: 'info', area: 'plans', message: `Plano "${cfg.label}" está marcado como inativo — não aceita novas assinaturas nem trocas (assinantes atuais não são afetados).` })
      }
    }

    // ── Stripe (comparação ao vivo) ──────────────────────────────────────
    for (const plan of PAID_PLAN_KEYS) {
      const cfg = configs.find(c => c.plan_key === plan)
      if (!cfg) {
        findings.push({ severity: 'warning', area: 'plans', message: `Plano "${plan}" não tem linha em plan_configs.` })
        continue
      }
      if (!cfg.stripe_price_id) {
        findings.push({ severity: 'critical', area: 'stripe', message: `Plano "${cfg.label}" não tem stripe_price_id configurado no banco.` })
        continue
      }
      let price: Stripe.Price
      try {
        price = await stripe.prices.retrieve(cfg.stripe_price_id)
      } catch {
        findings.push({ severity: 'critical', area: 'stripe', message: `Plano "${cfg.label}": Price ID "${cfg.stripe_price_id}" não existe mais no Stripe.` })
        continue
      }
      if (!price.active) {
        findings.push({ severity: 'warning', area: 'stripe', message: `Plano "${cfg.label}": o Price atual no Stripe está arquivado (active=false) — novas assinaturas vão falhar.` })
      }
      if (price.currency !== 'brl') {
        findings.push({ severity: 'critical', area: 'stripe', message: `Plano "${cfg.label}": moeda do Price no Stripe é "${price.currency}", esperado "brl".` })
      }
      const stripeProductId = typeof price.product === 'string' ? price.product : price.product.id
      if (cfg.stripe_product_id && stripeProductId !== cfg.stripe_product_id) {
        findings.push({ severity: 'warning', area: 'stripe', message: `Plano "${cfg.label}": produto do Price no Stripe (${stripeProductId}) é diferente do produto salvo no banco (${cfg.stripe_product_id}).` })
      }
      if (typeof cfg.price_cents === 'number' && typeof price.unit_amount === 'number' && cfg.price_cents !== price.unit_amount) {
        const bancoFmt = (cfg.price_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const stripeFmt = (price.unit_amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        findings.push({ severity: 'critical', area: 'prices', message: `Plano "${cfg.label}" é exibido por ${bancoFmt} no banco, mas o Stripe está configurado para ${stripeFmt}.` })
      }
      // price (texto de exibição) × price_cents: devem sempre bater, já que
      // admin-plan-pricing sincroniza os dois juntos. Se divergirem, algo
      // gravou price_cents ou price fora desse fluxo (ex.: edição direta no banco).
      const expectedDisplay = typeof cfg.price_cents === 'number' ? (cfg.price_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null
      if (expectedDisplay && cfg.price && cfg.price.replace(/\s/g, '') !== expectedDisplay.replace(/\s/g, '')) {
        findings.push({ severity: 'warning', area: 'prices', message: `Plano "${cfg.label}": texto de exibição ("${cfg.price}") não bate com o valor numérico salvo (${expectedDisplay}).` })
      }
    }

    return json({ ok: true, checked_at: new Date().toISOString(), findings })
  } catch (e) {
    console.error('admin-plan-consistency:', (e as Error).message)
    return json({ error: 'Não foi possível concluir a verificação agora.' }, 500)
  }
})
