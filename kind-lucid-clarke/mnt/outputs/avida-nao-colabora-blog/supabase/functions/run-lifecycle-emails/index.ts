import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'

// ─── E-mails de ciclo de vida (cron diário) ──────────────────────────────────
// Dispara automaticamente, por regra, os templates: weekly_report_available,
// new_content_published, checkin_reminder, reengagement_inactive, trial_ending.
// Envia via a função send-transactional-email (renderização + idempotência).
// Respeita email_notifications e usa idempotency_key para NÃO duplicar.
// (card_expiring fica de fora: não há expiração de cartão no banco → exige Stripe.)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}
const SITE = Deno.env.get('SITE_URL') || Deno.env.get('APP_URL') || 'https://avidanaocolabora.com'
const MAX_PER_RUN = 60 // teto de envios por execução (o dedup cobre o resto nos dias seguintes)

function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }) }
function dayStamp(d = new Date()) { return d.toISOString().slice(0, 10) }
function monthStamp(d = new Date()) { return d.toISOString().slice(0, 7) }
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const wk = Math.ceil((((t.getTime() - yStart.getTime()) / 86400000) + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`
}
const PLAN_LABEL: Record<string, string> = { free: 'Gratuito', essential: 'Essencial', plus: 'Plus', therapeutic: 'Plus', 'therapeutic-plus': 'Plus' }
const PLAN_RANK: Record<string, number> = { free: 0, essential: 1, plus: 2, therapeutic: 2, 'therapeutic-plus': 2 }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey)

  // Auth: token interno do cron (mesmo padrão do run-automations) ou service role.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  let internal: string | null = null
  try { const { data } = await admin.rpc('get_automation_token'); if (typeof data === 'string') internal = data } catch { /* noop */ }
  if (![internal, serviceKey].filter(Boolean).includes(token)) return json({ error: 'Não autorizado' }, 401)

  const now = new Date()
  const isMonday = (now.getUTCDay() === 1)
  let sent = 0
  const summary: Record<string, number> = { weekly_report: 0, new_content: 0, checkin: 0, reengagement: 0, trial_ending: 0, card_expiring: 0 }

  // Envia um e-mail via send-transactional-email (idempotência protege duplicados).
  async function send(to: string, template_key: string, variables: Record<string, unknown>, idem: string, user_id: string | null) {
    if (sent >= MAX_PER_RUN) return false
    try {
      const r = await fetch(`${url}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ to_email: to, template_key, variables, idempotency_key: idem, user_id }),
      })
      if (r.ok) { sent++; return true }
    } catch { /* ignora e segue */ }
    return false
  }

  // ── Dados base ──
  const { data: profiles } = await admin.from('profiles')
    .select('user_id, email, full_name, plan, email_notifications, subscription_status, created_at, stripe_customer_id')
    .eq('email_notifications', true).not('email', 'is', null).limit(3000)
  const users = (profiles ?? []) as { user_id: string; email: string; full_name: string | null; plan: string; subscription_status: string | null; created_at: string; stripe_customer_id: string | null }[]

  // Última entrada de diário por usuário (últimos 45 dias)
  const since45 = new Date(now.getTime() - 45 * 86400000).toISOString()
  const { data: diary } = await admin.from('diary_entries').select('user_id, created_at').gte('created_at', since45).limit(20000)
  const lastEntry = new Map<string, number>()
  for (const d of (diary ?? []) as { user_id: string; created_at: string }[]) {
    const ts = new Date(d.created_at).getTime()
    if (!lastEntry.has(d.user_id) || ts > (lastEntry.get(d.user_id) as number)) lastEntry.set(d.user_id, ts)
  }

  const DAY = 86400000
  for (const u of users) {
    if (sent >= MAX_PER_RUN) break
    const nome = (u.full_name || '').split(' ')[0] || 'Olá'
    const accountAgeDays = (now.getTime() - new Date(u.created_at).getTime()) / DAY
    const last = lastEntry.get(u.user_id)
    const gapDays = last ? (now.getTime() - last) / DAY : (accountAgeDays >= 7 ? accountAgeDays : 0)

    // Reengajamento: sem diário há 30+ dias (1x/mês)
    if (gapDays >= 30) {
      if (await send(u.email, 'reengagement_inactive', { nome, link_site: SITE }, `reengagement:${u.user_id}:${monthStamp(now)}`, u.user_id)) summary.reengagement++
      continue
    }
    // Lembrete de check-in: sem diário entre 7 e 29 dias (1x/semana)
    if (gapDays >= 7) {
      if (await send(u.email, 'checkin_reminder', { nome, link_diario: `${SITE}/diario` }, `checkin:${u.user_id}:${isoWeek(now)}`, u.user_id)) summary.checkin++
    }
  }

  // ── Relatório semanal (só segundas, Essencial+) ──
  if (isMonday) {
    for (const u of users) {
      if (sent >= MAX_PER_RUN) break
      if ((PLAN_RANK[u.plan] ?? 0) < 1) continue
      if (u.subscription_status && !['active', 'trialing'].includes(u.subscription_status)) continue
      const nome = (u.full_name || '').split(' ')[0] || 'Olá'
      if (await send(u.email, 'weekly_report_available', { nome, link_relatorio: `${SITE}/meu-plano` }, `weekly_report:${u.user_id}:${isoWeek(now)}`, u.user_id)) summary.weekly_report++
    }
  }

  // ── Fim de teste (trial_end nos próximos 3 dias) ──
  try {
    const in3 = new Date(now.getTime() + 3 * DAY).toISOString()
    const { data: subs } = await admin.from('user_subscriptions')
      .select('user_id, plan_key, trial_end, status').eq('status', 'trialing')
      .gte('trial_end', now.toISOString()).lte('trial_end', in3).limit(500)
    const byId = new Map(users.map(u => [u.user_id, u]))
    for (const s of (subs ?? []) as { user_id: string; plan_key: string; trial_end: string }[]) {
      if (sent >= MAX_PER_RUN) break
      const u = byId.get(s.user_id); if (!u) continue
      const nome = (u.full_name || '').split(' ')[0] || 'Olá'
      const data_fim_teste = new Date(s.trial_end).toLocaleDateString('pt-BR')
      if (await send(u.email, 'trial_ending', { nome, plano: PLAN_LABEL[s.plan_key] ?? s.plan_key, data_fim_teste, link_meu_plano: `${SITE}/meu-plano` }, `trial_ending:${s.user_id}:${dayStamp(new Date(s.trial_end))}`, s.user_id)) summary.trial_ending++
    }
  } catch { /* tabela/coluna ausente — ignora */ }

  // ── Novo conteúdo publicado nas últimas 24h (1 por usuário/dia, respeita plano) ──
  try {
    const since1 = new Date(now.getTime() - DAY).toISOString()
    const { data: arts } = await admin.from('articles')
      .select('id, title, slug, summary, excerpt, plan_required, published_at')
      .eq('status', 'published').gte('published_at', since1)
      .order('published_at', { ascending: false }).limit(20)
    const articles = (arts ?? []) as { id: string; title: string; slug: string; summary: string | null; excerpt: string | null; plan_required: string | null; published_at: string }[]
    for (const u of users) {
      if (sent >= MAX_PER_RUN) break
      // pega o artigo mais recente que o usuário PODE acessar
      const a = articles.find(x => (PLAN_RANK[u.plan] ?? 0) >= (PLAN_RANK[x.plan_required || 'free'] ?? 0))
      if (!a) continue
      const nome = (u.full_name || '').split(' ')[0] || 'Olá'
      const resumo = (a.summary || a.excerpt || '').slice(0, 200)
      if (await send(u.email, 'new_content_published', { nome, titulo: a.title, resumo, link_conteudo: `${SITE}/blog/${a.slug}` }, `new_content:${u.user_id}:${dayStamp(now)}`, u.user_id)) summary.new_content++
    }
  } catch { /* ignora */ }

  // ── Cartão a vencer (via Stripe) — só nos dias 1 e 15, p/ limitar chamadas ──
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (stripeKey && [1, 15].includes(now.getUTCDate())) {
    try {
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion })
      const nowMonths = now.getUTCFullYear() * 12 + (now.getUTCMonth() + 1)
      const candidates = users.filter(u =>
        (PLAN_RANK[u.plan] ?? 0) >= 1 &&
        (!u.subscription_status || ['active', 'trialing'].includes(u.subscription_status)) &&
        u.stripe_customer_id)
      for (const u of candidates) {
        if (sent >= MAX_PER_RUN) break
        try {
          const cust = await stripe.customers.retrieve(u.stripe_customer_id!, { expand: ['invoice_settings.default_payment_method'] }) as { invoice_settings?: { default_payment_method?: { card?: { exp_month?: number; exp_year?: number } } } }
          let card = cust.invoice_settings?.default_payment_method?.card
          if (!card?.exp_month) {
            const pms = await stripe.paymentMethods.list({ customer: u.stripe_customer_id!, type: 'card', limit: 1 })
            card = (pms.data[0] as { card?: { exp_month?: number; exp_year?: number } } | undefined)?.card
          }
          if (!card?.exp_month || !card?.exp_year) continue
          const expMonths = card.exp_year * 12 + card.exp_month
          const diff = expMonths - nowMonths
          if (diff >= 0 && diff <= 1) { // vence este mês ou no próximo
            const nome = (u.full_name || '').split(' ')[0] || 'Olá'
            if (await send(u.email, 'card_expiring', { nome, plano: PLAN_LABEL[u.plan] ?? u.plan, link_meu_plano: `${SITE}/meu-plano` }, `card_expiring:${u.user_id}:${monthStamp(now)}`, u.user_id)) summary.card_expiring++
          }
        } catch { /* cliente sem cartão / erro Stripe — pula */ }
      }
    } catch { /* Stripe indisponível */ }
  }

  return json({ ok: true, sent, summary })
})
