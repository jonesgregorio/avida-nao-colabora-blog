import { createClient } from 'npm:@supabase/supabase-js@2'

const SITE = Deno.env.get('SITE_URL') || Deno.env.get('APP_URL') || 'https://avidanaocolabora.com'
const DAY = 86_400_000
const MAX_PER_RUN = 40
const COOLDOWN_DAYS = 3

const cors = {
  'Access-Control-Allow-Origin': SITE,
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

const PLAN_RESOURCES: Record<string, string> = {
  essential: [
    '- Mapa Emocional completo para visualizar seus registros ao longo do tempo',
    '- Descobertas para perceber recorrências que começam a aparecer',
    '- Relatório Semanal, quando houver dados suficientes para formar uma leitura útil',
    '- Meu Jardim e Conteúdos Guiados completos',
    '- Diário sem limite mensal',
  ].join('\n'),
  plus: [
    '- Tudo o que faz parte do Essencial',
    '- Aprofundamentos do Diário, quando você quiser ir além do registro',
    '- Relatório Mensal Aprofundado',
    '- Plano de Autocuidado mensal, quando houver registros suficientes',
    '- Orientação Mensal por mensagem, conforme as regras de elegibilidade',
  ].join('\n'),
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Gratuito',
  essential: 'Essencial',
  plus: 'Plus',
  therapeutic: 'Plus',
  'therapeutic-plus': 'Plus',
}

interface Candidate {
  user_id: string
  email: string
  full_name: string | null
  plan: string
  created_at: string
  plan_activated_at: string | null
  last_seen_at: string | null
  checkins_total: number
  diaries_total: number
  last_nurture_email: string | null
  email_enabled: boolean
  receive_product_updates: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey)

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  let internal: string | null = null
  try {
    const { data } = await admin.rpc('get_automation_token')
    if (typeof data === 'string') internal = data
  } catch { /* sem token interno = só service role */ }
  if (![internal, serviceKey].filter(Boolean).includes(token)) return json({ error: 'Não autorizado' }, 401)

  const { data, error } = await admin.rpc('get_onboarding_email_candidates')
  if (error) return json({ error: error.message }, 500)

  const now = new Date()
  let sent = 0
  let skippedCooldown = 0
  let skippedCompleted = 0
  const byTemplate: Record<string, number> = {}

  async function send(candidate: Candidate, template: string, variables: Record<string, unknown>) {
    if (sent >= MAX_PER_RUN) return false
    const response = await fetch(`${url}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({
        user_id: candidate.user_id,
        to_email: candidate.email,
        template_key: template,
        variables,
        idempotency_key: `${template}:${candidate.user_id}`,
        related_entity_type: 'onboarding',
        related_entity_id: candidate.user_id,
        metadata: { kind: 'behavioral_onboarding', plan: candidate.plan },
      }),
    })
    if (!response.ok) return false
    const payload = await response.json().catch(() => ({})) as { skipped?: boolean; error?: string }
    if (payload.skipped || payload.error) return false
    sent += 1
    byTemplate[template] = (byTemplate[template] ?? 0) + 1
    return true
  }

  for (const raw of (data ?? []) as Candidate[]) {
    if (sent >= MAX_PER_RUN) break
    const candidate = raw
    if (!candidate.email_enabled || !candidate.receive_product_updates) continue

    const lastNurture = candidate.last_nurture_email ? new Date(candidate.last_nurture_email).getTime() : 0
    if (lastNurture && now.getTime() - lastNurture < COOLDOWN_DAYS * DAY) {
      skippedCooldown += 1
      continue
    }

    const accountAge = (now.getTime() - new Date(candidate.created_at).getTime()) / DAY
    const nome = (candidate.full_name || '').trim() || candidate.email.split('@')[0] || 'você'
    const common = { nome, link_preferencias: `${SITE}/perfil` }

    // Etapa 1: ainda não houve primeiro Check-in. Só entra depois de 2 dias,
    // para o e-mail de boas-vindas ter espaço e a pessoa poder descobrir o app sozinha.
    if (accountAge >= 2 && accountAge <= 14 && candidate.checkins_total === 0) {
      await send(candidate, 'value_onboarding_first_checkin', {
        ...common,
        cta_link: `${SITE}/`,
      })
      continue
    }

    // Etapa 2: já houve Check-in, mas nenhum registro de Diário. Nunca dispara se
    // a pessoa já escreveu no Diário — onboarding é comportamento, não calendário.
    if (accountAge >= 4 && accountAge <= 21 && candidate.checkins_total > 0 && candidate.diaries_total === 0) {
      await send(candidate, 'value_onboarding_diary', {
        ...common,
        cta_link: `${SITE}/diario`,
      })
      continue
    }

    // Plano pago: o e-mail plan_activated é imediato. Este retorno leve só é usado
    // quando passaram alguns dias E não há evidência de que a pessoa voltou ao site
    // depois da ativação. Quem já voltou não precisa de outro lembrete de recursos.
    const canonicalPlan = ['plus', 'therapeutic', 'therapeutic-plus'].includes(candidate.plan) ? 'plus' : candidate.plan
    if (canonicalPlan !== 'free' && candidate.plan_activated_at) {
      const activatedAt = new Date(candidate.plan_activated_at).getTime()
      const planAge = (now.getTime() - activatedAt) / DAY
      const lastSeen = candidate.last_seen_at ? new Date(candidate.last_seen_at).getTime() : 0
      const returnedAfterActivation = lastSeen > activatedAt + 6 * 60 * 60 * 1000
      if (planAge >= 3 && planAge <= 12 && !returnedAfterActivation) {
        await send(candidate, 'value_onboarding_plan_return', {
          ...common,
          plano: PLAN_LABEL[candidate.plan] || candidate.plan,
          recursos_do_plano: PLAN_RESOURCES[canonicalPlan] || '',
          cta_link: `${SITE}/meu-plano`,
        })
        continue
      }
    }

    skippedCompleted += 1
  }

  return json({
    ok: true,
    sent,
    max_per_run: MAX_PER_RUN,
    cooldown_days: COOLDOWN_DAYS,
    skipped_cooldown: skippedCooldown,
    skipped_no_pending_stage: skippedCompleted,
    by_template: byTemplate,
  })
})
