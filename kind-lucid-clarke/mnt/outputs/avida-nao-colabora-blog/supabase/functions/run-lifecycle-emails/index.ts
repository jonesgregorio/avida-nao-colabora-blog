import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'

// ─── E-mails de ciclo de vida (cron diário) ──────────────────────────────────
// Dispara automaticamente, por regra: lembretes de autocuidado por inatividade
// (selfcare_*, §095), weekly_report_available, new_content_published, trial_ending.
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
const tierOf = (p: string): 'free' | 'essential' | 'plus' => (PLAN_RANK[p] ?? 0) >= 2 ? 'plus' : (PLAN_RANK[p] ?? 0) === 1 ? 'essential' : 'free'

// ── Lembretes de autocuidado (095) ──────────────────────────────────────────
// CÓPIA POR PLANO. Regra de ouro: o Gratuito NUNCA vê recurso pago (§4). O tom é
// acolhedor, sem cobrança/culpa (§7/§8). O corpo abaixo entra como {{corpo}}; o
// rodapé (preferências + disclaimer) é fixo no template.
const CORPO_INATIVIDADE: Record<'free' | 'essential' | 'plus', string> = {
  free: 'Um check-in rápido pode ser um bom começo para entender como você está hoje. Mesmo com poucos minutos, você registra seu momento e acompanha seus últimos registros.',
  essential: 'Seus registros ajudam a formar uma visão mais clara da sua semana no Mapa Emocional e no relatório semanal. Um check-in rápido já pode ajudar você a perceber padrões com mais facilidade.',
  plus: 'Seus registros ajudam a deixar seu relatório mensal, plano de autocuidado e orientação mais conectados ao que você viveu de verdade. Um pequeno check-in já pode tornar a leitura do mês mais precisa.',
}
// CTA por plano (§4). Low-data sempre aponta para o check-in rápido.
const CTA: Record<'free' | 'essential' | 'plus', { label: string; path: string }> = {
  free: { label: 'Fazer check-in rápido', path: '/diario?modo=checkin' },
  essential: { label: 'Registrar como estou hoje', path: '/diario' },
  plus: { label: 'Registrar meu momento', path: '/diario?modo=checkin' },
}
const CTA_CHECKIN = { label: 'Fazer check-in rápido', path: '/diario?modo=checkin' }

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
  const diaDoMes = now.getUTCDate()
  const fimDoMes = diaDoMes >= 24
  let sent = 0
  const summary: Record<string, number> = { weekly_report: 0, new_content: 0, selfcare: 0, trial_ending: 0, card_expiring: 0 }

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
    .select('user_id, email, full_name, plan, email_notifications, subscription_status, created_at, stripe_customer_id, last_seen_at')
    .eq('email_notifications', true).not('email', 'is', null).limit(3000)
  const users = (profiles ?? []) as { user_id: string; email: string; full_name: string | null; plan: string; subscription_status: string | null; created_at: string; stripe_customer_id: string | null; last_seen_at: string | null }[]

  const DAY = 86400000

  // Atividade emocional (§13): última data + contagens da semana/mês por usuário.
  // Sinal = qualquer registro em diary_entries (checkin, diary, questionnaire,
  // evaluation). Distinguir tipos não é preciso: os gatilhos escalam pelo GAP.
  const since45 = new Date(now.getTime() - 45 * DAY).toISOString()
  const { data: diary } = await admin.from('diary_entries').select('user_id, created_at').gte('created_at', since45).limit(30000)
  const lastEntry = new Map<string, number>()
  const weekCount = new Map<string, number>()
  const monthCount = new Map<string, number>()
  const wk = isoWeek(now); const mo = monthStamp(now)
  for (const d of (diary ?? []) as { user_id: string; created_at: string }[]) {
    const dt = new Date(d.created_at); const ts = dt.getTime()
    if (!lastEntry.has(d.user_id) || ts > (lastEntry.get(d.user_id) as number)) lastEntry.set(d.user_id, ts)
    if (isoWeek(dt) === wk) weekCount.set(d.user_id, (weekCount.get(d.user_id) ?? 0) + 1)
    if (monthStamp(dt) === mo) monthCount.set(d.user_id, (monthCount.get(d.user_id) ?? 0) + 1)
  }

  // ── Anti-spam (§5): histórico de lembretes de autocuidado dos últimos 31 dias.
  const since31 = new Date(now.getTime() - 31 * DAY).toISOString()
  const { data: scLogs } = await admin.from('email_logs')
    .select('user_id, template_key, created_at')
    .like('template_key', 'selfcare_%')
    .gte('created_at', since31).limit(20000)
  const lastSelfcare = new Map<string, number>()   // ts do último lembrete
  const selfcareThisMonth = new Map<string, number>()
  const selfcareToday = new Set<string>()
  const hoje = dayStamp(now)
  for (const l of (scLogs ?? []) as { user_id: string | null; created_at: string }[]) {
    if (!l.user_id) continue
    const dt = new Date(l.created_at); const ts = dt.getTime()
    if (!lastSelfcare.has(l.user_id) || ts > (lastSelfcare.get(l.user_id) as number)) lastSelfcare.set(l.user_id, ts)
    if (monthStamp(dt) === mo) selfcareThisMonth.set(l.user_id, (selfcareThisMonth.get(l.user_id) ?? 0) + 1)
    if (dayStamp(dt) === hoje) selfcareToday.add(l.user_id)
  }

  // Preferências granulares (095). Ausência de linha/coluna = recebe (opt-out).
  const { data: prefsRows } = await admin.from('user_notification_preferences')
    .select('user_id, email_enabled, receive_selfcare_reminders, receive_report_reminders, receive_care_plan_reminders')
    .limit(20000)
  type Prefs = { email_enabled?: boolean; receive_selfcare_reminders?: boolean; receive_report_reminders?: boolean; receive_care_plan_reminders?: boolean }
  const prefs = new Map<string, Prefs>()
  for (const p of (prefsRows ?? []) as (Prefs & { user_id: string })[]) prefs.set(p.user_id, p)
  const prefOn = (v: boolean | undefined) => v !== false // default true

  // Resolve o ÚNICO gatilho mais relevante do usuário (prioridade §5), já
  // respeitando plano e preferências. null = não enviar.
  function resolverGatilho(u: typeof users[number]): { template: string; corpo: string; cta: { label: string; path: string }; categoria: 'selfcare' | 'report' | 'care_plan' } | null {
    const tier = tierOf(u.plan)
    const p = prefs.get(u.user_id) ?? {}
    if (p.email_enabled === false) return null // desligou tudo

    // "Atividade" = último REGISTRO (check-in/diário/questionário) OU último
    // ACESSO ao site (last_seen_at, 096). Assim quem navega sem registrar também
    // conta como ativo e não recebe lembrete — cobre o "acessou nas últimas 24h".
    const lastEntryTs = lastEntry.get(u.user_id)
    const lastSeenTs = u.last_seen_at ? new Date(u.last_seen_at).getTime() : undefined
    const last = Math.max(lastEntryTs ?? 0, lastSeenTs ?? 0) || undefined
    const accountAgeDays = (now.getTime() - new Date(u.created_at).getTime()) / DAY
    const gap = last ? (now.getTime() - last) / DAY : (accountAgeDays >= 3 ? accountAgeDays : 0)
    const wkN = weekCount.get(u.user_id) ?? 0
    const moN = monthCount.get(u.user_id) ?? 0
    const ativoHoje = last ? (now.getTime() - last) < DAY : false
    const assinaturaOk = !u.subscription_status || ['active', 'trialing'].includes(u.subscription_status)

    // 1) Plus, fim do mês, poucos registros no mês → relatório/plano do mês.
    if (tier === 'plus' && assinaturaOk && fimDoMes && moN < 4 && !ativoHoje) {
      if (prefOn(p.receive_report_reminders) || prefOn(p.receive_care_plan_reminders)) {
        return { template: 'selfcare_monthly_low_data', categoria: 'report',
          corpo: 'Seu relatório mensal e seu plano de autocuidado ficam mais úteis quando têm registros recentes. Um pequeno check-in pode ajudar a deixar a leitura do mês mais conectada ao que você viveu de verdade.',
          cta: CTA_CHECKIN }
      }
    }
    // 2) Essencial/Plus, poucos registros na semana, ainda ativo → relatório semanal.
    if (tier !== 'free' && assinaturaOk && wkN < 2 && !ativoHoje && gap < 7 && prefOn(p.receive_report_reminders)) {
      return { template: 'selfcare_weekly_low_data', categoria: 'report',
        corpo: 'Seus registros ajudam a formar uma visão mais clara da sua semana no Mapa Emocional e no relatório semanal. Um check-in rápido hoje já pode ajudar você a perceber padrões com mais facilidade.',
        cta: CTA_CHECKIN }
    }
    // 3–6) Inatividade escalonada. Todas exigem receive_selfcare_reminders.
    if (!prefOn(p.receive_selfcare_reminders)) return null
    const corpo = CORPO_INATIVIDADE[tier]
    const cta = CTA[tier]
    if (gap >= 30) return { template: 'selfcare_inactive_30d', corpo, cta, categoria: 'selfcare' }
    if (gap >= 14) return { template: 'selfcare_inactive_14d', corpo, cta, categoria: 'selfcare' }
    if (gap >= 7)  return { template: 'selfcare_inactive_7d', corpo, cta, categoria: 'selfcare' }
    if (gap >= 3)  return { template: 'selfcare_inactive_3d', corpo, cta, categoria: 'selfcare' }
    return null
  }

  for (const u of users) {
    if (sent >= MAX_PER_RUN) break

    // Limites de frequência (§5): 1/dia, 4/mês, intervalo mínimo de 5 dias.
    if (selfcareToday.has(u.user_id)) continue
    if ((selfcareThisMonth.get(u.user_id) ?? 0) >= 4) continue
    const last = lastSelfcare.get(u.user_id)
    if (last && (now.getTime() - last) < 5 * DAY) continue

    const g = resolverGatilho(u)
    if (!g) continue

    const nome = (u.full_name || '').split(' ')[0] || 'Olá'
    // Chave de idempotência inclui o template + semana → no máximo 1 do mesmo tipo
    // por semana, e o send-transactional-email bloqueia duplicados.
    const idem = `${g.template}:${u.user_id}:${isoWeek(now)}`
    const ok = await send(u.email, g.template, {
      nome,
      corpo: g.corpo,
      cta_label: g.cta.label,
      cta_link: `${SITE}${g.cta.path}`,
      link_preferencias: `${SITE}/perfil`,
      plano: PLAN_LABEL[u.plan] ?? u.plan,
    }, idem, u.user_id)
    if (ok) {
      summary.selfcare++
      // Atualiza o estado local para respeitar 1/dia dentro da mesma execução.
      selfcareToday.add(u.user_id)
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
