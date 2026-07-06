// ─── Motor de pendências de personalização ────────────────────────────────────
// Detecta automaticamente quais entregas personalizadas estão pendentes
// por usuário, conforme plano, período e histórico de envios.

import { supabase } from './supabase'
import { getContentTypeLabel } from './personalizedContentLabels'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskFrequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'on_guidance'
  | 'on_report'
  | 'on_session'
  | 'post_session'

export type TaskPriority = 'high' | 'medium' | 'low'
export type TaskStatus =
  | 'pending' | 'generated' | 'draft' | 'sent'
  | 'expired' | 'overdue' | 'cancelled' | 'not_applicable'

export type DueType =
  | 'end_of_week'
  | 'start_of_next_week'
  | 'day_of_month'
  | 'end_of_biweek'
  | 'end_of_month'
  | 'days_after_event'
  | 'working_days_after_event'
  | 'before_session'

export interface TaskDef {
  key: string
  title: string
  description: string
  contentType: string
  targetArea: string
  notificationTitle: string
  notificationBody: string
  frequency: TaskFrequency
  minPlan: string
  priority: TaskPriority
  dueType: DueType
  dueParam?: number
  dueNextMonth?: boolean
  expiresAfterDueDays: number | null
}

export interface PersonalizationTask {
  id: string
  user_id: string
  plan_key: string
  task_key: string
  task_title: string
  task_description: string | null
  content_type: string
  target_area: string | null
  period_key: string
  status: TaskStatus
  due_at: string | null
  expires_at: string | null
  related_report_id: string | null
  related_guidance_id: string | null
  related_session_id: string | null
  delivery_id: string | null
  data_snapshot: Record<string, unknown>
  generated_at: string | null
  sent_at: string | null
  completed_at: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
  // joined
  user_name?: string | null
  user_email?: string | null
}

// ── Planos ────────────────────────────────────────────────────────────────────

const PLAN_RANK: Record<string, number> = {
  free: 0, essential: 1, therapeutic: 2, 'therapeutic-plus': 3,
}

function hasPlan(userPlan: string, minPlan: string) {
  return (PLAN_RANK[userPlan] ?? 0) >= (PLAN_RANK[minPlan] ?? 99)
}

// ── Definições de pendências ──────────────────────────────────────────────────

export const TASK_DEFS: TaskDef[] = [
  // ── Gratuito ──
  {
    key: 'article_suggestion',
    title: 'Sugestão de artigo gratuito',
    description: 'Usuário tem direito a uma sugestão de artigo gratuito por semana.',
    contentType: 'article_suggestion',
    targetArea: 'para-voce',
    notificationTitle: 'Novo conteúdo para você',
    notificationBody: 'Separamos um artigo gratuito com base no seu momento atual.',
    frequency: 'weekly',
    minPlan: 'free',
    priority: 'low',
    dueType: 'end_of_week',
    expiresAfterDueDays: 3,
  },
  {
    key: 'mini_challenge',
    title: 'Mini-desafio quinzenal',
    description: 'Mini-desafio de autoconhecimento a cada 15 dias.',
    contentType: 'mini_challenge',
    targetArea: 'resumo',
    notificationTitle: 'Novo mini-desafio disponível',
    notificationBody: 'Seu mini-desafio quinzenal está pronto.',
    frequency: 'biweekly',
    minPlan: 'free',
    priority: 'low',
    dueType: 'end_of_biweek',
    expiresAfterDueDays: 5,
  },
  {
    key: 'diary_question',
    title: 'Pergunta simples para diário',
    description: 'Pergunta reflexiva para registrar no diário.',
    contentType: 'diary_question',
    targetArea: 'diary',
    notificationTitle: 'Pergunta do diário',
    notificationBody: 'Uma pergunta para você refletir e registrar no diário.',
    frequency: 'weekly',
    minPlan: 'free',
    priority: 'low',
    dueType: 'end_of_week',
    expiresAfterDueDays: 3,
  },
  {
    key: 'questionnaire_suggestion',
    title: 'Recomendação de questionário básico',
    description: 'Sugestão mensal de questionário básico de autoconhecimento.',
    contentType: 'questionnaire_suggestion',
    targetArea: 'my_evolution',
    notificationTitle: 'Questionário recomendado',
    notificationBody: 'Há um questionário recomendado com base no seu uso este mês.',
    frequency: 'monthly',
    minPlan: 'free',
    priority: 'low',
    dueType: 'day_of_month',
    dueParam: 10,
    expiresAfterDueDays: 20,
  },

  // ── Essencial ──
  {
    key: 'guided_meditation',
    title: 'Meditação guiada em texto',
    description: 'Meditação guiada em texto adaptada ao momento do usuário.',
    contentType: 'guided_meditation',
    targetArea: 'meditations',
    notificationTitle: 'Meditação guiada disponível',
    notificationBody: 'Sua meditação guiada da semana está pronta.',
    frequency: 'weekly',
    minPlan: 'essential',
    priority: 'low',
    dueType: 'end_of_week',
    expiresAfterDueDays: 3,
  },
  {
    key: 'emotional_exercise',
    title: 'Exercício emocional',
    description: 'Exercício prático de organização emocional.',
    contentType: 'emotional_exercise',
    targetArea: 'exercises',
    notificationTitle: 'Exercício emocional disponível',
    notificationBody: 'Um exercício emocional foi preparado para você esta semana.',
    frequency: 'weekly',
    minPlan: 'essential',
    priority: 'low',
    dueType: 'end_of_week',
    expiresAfterDueDays: 3,
  },
  {
    key: 'guided_diary_notes',
    title: 'Notas guiadas para diário',
    description: 'Sugestão de notas guiadas para enriquecer o diário.',
    contentType: 'guided_diary_notes',
    targetArea: 'diary',
    notificationTitle: 'Notas guiadas para o diário',
    notificationBody: 'Separamos algumas notas guiadas para seu diário desta semana.',
    frequency: 'weekly',
    minPlan: 'essential',
    priority: 'low',
    dueType: 'end_of_week',
    expiresAfterDueDays: 3,
  },
  {
    key: 'monthly_summary',
    title: 'Resumo mensal simples',
    description: 'Resumo mensal do uso e percepções da plataforma.',
    contentType: 'monthly_summary',
    targetArea: 'reports',
    notificationTitle: 'Resumo do mês disponível',
    notificationBody: 'Seu resumo mensal simples está disponível.',
    frequency: 'monthly',
    minPlan: 'essential',
    priority: 'medium',
    dueType: 'day_of_month',
    dueParam: 5,
    dueNextMonth: true,
    expiresAfterDueDays: null,
  },
  {
    key: 'evolution_highlights',
    title: 'Destaques de evolução',
    description: 'Destaques da evolução do usuário no mês, sem análise clínica.',
    contentType: 'evolution_highlights',
    targetArea: 'resumo',
    notificationTitle: 'Destaques do seu mês',
    notificationBody: 'Seus destaques de evolução do mês estão disponíveis.',
    frequency: 'monthly',
    minPlan: 'essential',
    priority: 'medium',
    dueType: 'day_of_month',
    dueParam: 5,
    dueNextMonth: true,
    expiresAfterDueDays: null,
  },
  {
    key: 'report_suggestion',
    title: 'Sugestão de relatório mensal',
    description: 'Sugestão de relatório para o usuário gerar no mês.',
    contentType: 'report_suggestion',
    targetArea: 'reports',
    notificationTitle: 'Hora de gerar seu relatório',
    notificationBody: 'Este é um bom momento para gerar seu relatório mensal.',
    frequency: 'monthly',
    minPlan: 'essential',
    priority: 'medium',
    dueType: 'day_of_month',
    dueParam: 5,
    dueNextMonth: true,
    expiresAfterDueDays: null,
  },

  // ── Terapêutico ──
  {
    key: 'weekly_self_care',
    title: 'Plano semanal de autocuidado',
    description: 'Plano semanal de autocuidado personalizado.',
    contentType: 'weekly_self_care',
    targetArea: 'self_care_plan',
    notificationTitle: 'Seu plano semanal está pronto',
    notificationBody: 'Seu plano semanal de autocuidado está disponível.',
    frequency: 'weekly',
    minPlan: 'therapeutic',
    priority: 'medium',
    dueType: 'start_of_next_week',
    expiresAfterDueDays: 5,
  },
  {
    key: 'content_recommendations',
    title: 'Recomendações personalizadas de conteúdo',
    description: 'Recomendações semanais de conteúdo baseadas no uso do usuário.',
    contentType: 'content_recommendations',
    targetArea: 'para-voce',
    notificationTitle: 'Recomendações da semana',
    notificationBody: 'Preparamos recomendações personalizadas para você esta semana.',
    frequency: 'weekly',
    minPlan: 'therapeutic',
    priority: 'medium',
    dueType: 'end_of_week',
    expiresAfterDueDays: 3,
  },
  {
    key: 'self_care_plan',
    title: 'Plano de autocuidado personalizado',
    description: 'Plano mensal de autocuidado adaptado ao perfil do usuário.',
    contentType: 'self_care_plan',
    targetArea: 'self_care_plan',
    notificationTitle: 'Seu plano de autocuidado',
    notificationBody: 'Seu plano de autocuidado personalizado do mês está disponível.',
    frequency: 'monthly',
    minPlan: 'therapeutic',
    priority: 'medium',
    dueType: 'day_of_month',
    dueParam: 5,
    expiresAfterDueDays: null,
  },
  {
    key: 'advanced_monthly_report',
    title: 'Relatório mensal avançado',
    description: 'Relatório mensal avançado com análise de uso e evolução.',
    contentType: 'advanced_monthly_report',
    targetArea: 'reports',
    notificationTitle: 'Relatório avançado disponível',
    notificationBody: 'Seu relatório mensal avançado está disponível.',
    frequency: 'monthly',
    minPlan: 'therapeutic',
    priority: 'medium',
    dueType: 'day_of_month',
    dueParam: 5,
    dueNextMonth: true,
    expiresAfterDueDays: null,
  },
  {
    key: 'monthly_guidance_reply',
    title: 'Orientação mensal por mensagem',
    description: 'Usuário enviou orientação mensal aguardando resposta.',
    contentType: 'monthly_guidance_draft',
    targetArea: 'guidance',
    notificationTitle: 'Sua orientação mensal foi respondida',
    notificationBody: 'A equipe respondeu sua orientação mensal.',
    frequency: 'on_guidance',
    minPlan: 'therapeutic',
    priority: 'high',
    dueType: 'working_days_after_event',
    dueParam: 3,
    expiresAfterDueDays: null,
  },
  {
    key: 'trail_suggestion',
    title: 'Sugestão de trilha',
    description: 'Sugestão mensal de trilha baseada nos marcadores do usuário.',
    contentType: 'trail_suggestion',
    targetArea: 'my_evolution',
    notificationTitle: 'Sugestão de trilha disponível',
    notificationBody: 'Separamos uma sugestão de trilha para você este mês.',
    frequency: 'monthly',
    minPlan: 'therapeutic',
    priority: 'low',
    dueType: 'day_of_month',
    dueParam: 10,
    expiresAfterDueDays: 20,
  },
  {
    key: 'next_steps',
    title: 'Próximos passos de autocuidado',
    description: 'Sugestão mensal de próximos passos de autocuidado.',
    contentType: 'next_steps',
    targetArea: 'my_evolution',
    notificationTitle: 'Próximos passos disponíveis',
    notificationBody: 'Seus próximos passos de autocuidado para este mês estão prontos.',
    frequency: 'monthly',
    minPlan: 'therapeutic',
    priority: 'low',
    dueType: 'day_of_month',
    dueParam: 10,
    expiresAfterDueDays: 20,
  },

  // ── Terapêutico Plus ──
  {
    key: 'monthly_plan_review',
    title: 'Revisão mensal do plano de autocuidado',
    description: 'Revisão mensal do plano de autocuidado do usuário.',
    contentType: 'monthly_review',
    targetArea: 'self_care_plan',
    notificationTitle: 'Revisão mensal disponível',
    notificationBody: 'A revisão mensal do seu plano de autocuidado está disponível.',
    frequency: 'monthly',
    minPlan: 'therapeutic-plus',
    priority: 'high',
    dueType: 'day_of_month',
    dueParam: 10,
    expiresAfterDueDays: null,
  },
  {
    key: 'professional_comment',
    title: 'Comentário individual sobre relatório',
    description: 'Usuário gerou relatório mensal e aguarda comentário profissional.',
    contentType: 'professional_comment',
    targetArea: 'professional_comments',
    notificationTitle: 'Comentário sobre seu relatório disponível',
    notificationBody: 'Seu comentário individual sobre o relatório do mês está disponível.',
    frequency: 'on_report',
    minPlan: 'therapeutic-plus',
    priority: 'high',
    dueType: 'days_after_event',
    dueParam: 5,
    expiresAfterDueDays: null,
  },
  {
    key: 'session_themes',
    title: 'Sugestões de temas para sessão',
    description: 'Sessão solicitada/agendada — preparar sugestões de temas.',
    contentType: 'session_themes',
    targetArea: 'session_plus',
    notificationTitle: 'Sugestões para sua sessão',
    notificationBody: 'Preparamos sugestões de temas para sua próxima sessão.',
    frequency: 'on_session',
    minPlan: 'therapeutic-plus',
    priority: 'high',
    dueType: 'before_session',
    expiresAfterDueDays: null,
  },
  {
    key: 'post_session_message',
    title: 'Mensagem personalizada pós-sessão',
    description: 'Sessão realizada — enviar mensagem personalizada de acompanhamento.',
    contentType: 'post_session_message',
    targetArea: 'session_plus',
    notificationTitle: 'Mensagem pós-sessão disponível',
    notificationBody: 'Preparamos uma mensagem personalizada após sua sessão.',
    frequency: 'post_session',
    minPlan: 'therapeutic-plus',
    priority: 'high',
    dueType: 'days_after_event',
    dueParam: 2,
    expiresAfterDueDays: 5,
  },
]

export function getTaskDefsForPlan(plan: string): TaskDef[] {
  return TASK_DEFS.filter(d => hasPlan(plan, d.minPlan))
}

// ── Period key helpers ────────────────────────────────────────────────────────

export function weekKey(d = new Date()): string {
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export function biweekKey(d = new Date()): string {
  const half = d.getDate() <= 15 ? 'H1' : 'H2'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${half}`
}

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function periodKeyForDef(def: TaskDef, d = new Date(), eventId?: string): string {
  switch (def.frequency) {
    case 'weekly': return weekKey(d)
    case 'biweekly': return biweekKey(d)
    case 'monthly': return monthKey(d)
    case 'on_guidance': return `guidance-${eventId ?? 'unknown'}`
    case 'on_report': return `report-${eventId ?? 'unknown'}`
    case 'on_session': return `session-${eventId ?? 'unknown'}`
    case 'post_session': return `postsession-${eventId ?? 'unknown'}`
    default: return monthKey(d)
  }
}

// ── Due date helpers ──────────────────────────────────────────────────────────

function lastDayOfMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function endOfWeek(d = new Date()): Date {
  const r = new Date(d)
  r.setDate(d.getDate() + (7 - (d.getDay() === 0 ? 7 : d.getDay())))
  r.setHours(23, 59, 59, 999)
  return r
}

function startOfNextWeek(d = new Date()): Date {
  const r = new Date(d)
  const daysUntilMonday = (8 - d.getDay()) % 7 || 7
  r.setDate(d.getDate() + daysUntilMonday)
  r.setHours(23, 59, 59, 999)
  return r
}

function endOfBiweek(d = new Date()): Date {
  const endDay = d.getDate() <= 15 ? 15 : lastDayOfMonth(d)
  return new Date(d.getFullYear(), d.getMonth(), endDay, 23, 59, 59)
}

function endOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), lastDayOfMonth(d), 23, 59, 59)
}

function dayOfMonth(day: number, d = new Date(), nextMonth = false): Date {
  if (nextMonth) return new Date(d.getFullYear(), d.getMonth() + 1, day, 23, 59, 59)
  return new Date(d.getFullYear(), d.getMonth(), day, 23, 59, 59)
}

function addWorkingDays(d: Date, days: number): Date {
  const r = new Date(d)
  let added = 0
  while (added < days) {
    r.setDate(r.getDate() + 1)
    if (r.getDay() !== 0 && r.getDay() !== 6) added++
  }
  return r
}

export function dueDateForDef(def: TaskDef, now = new Date(), eventDate?: Date): Date {
  switch (def.dueType) {
    case 'end_of_week': return endOfWeek(now)
    case 'start_of_next_week': return startOfNextWeek(now)
    case 'end_of_biweek': return endOfBiweek(now)
    case 'end_of_month': return endOfMonth(now)
    case 'day_of_month': return dayOfMonth(def.dueParam ?? 5, now, def.dueNextMonth)
    case 'days_after_event':
      if (!eventDate) return dayOfMonth(def.dueParam ?? 5, now)
      return new Date(eventDate.getTime() + (def.dueParam ?? 3) * 86400000)
    case 'working_days_after_event':
      if (!eventDate) return addWorkingDays(now, def.dueParam ?? 3)
      return addWorkingDays(eventDate, def.dueParam ?? 3)
    case 'before_session':
      if (eventDate) {
        const r = new Date(eventDate)
        r.setDate(r.getDate() - 1)
        return r
      }
      return endOfWeek(now)
    default: return endOfMonth(now)
  }
}

export function computeTaskStatus(dueAt: Date | null, expiresAt: Date | null, now = new Date()): 'pending' | 'overdue' | 'expired' {
  if (!dueAt) return 'pending'
  if (expiresAt && now > expiresAt) return 'expired'
  if (now > dueAt) return 'overdue'
  return 'pending'
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

export interface TaskSnapshot {
  plan: string
  task: string
  period: string
  diaryCount: number
  topMarkers: string[]
  avgMood: number | null
  questionnaireCount: number
  articlesRead: number
  savedCount: number
  reportSummary?: string
  sessionInfo?: string
  guidanceText?: string
}

// ── Engine principal ──────────────────────────────────────────────────────────

interface ProfileRow {
  user_id: string
  full_name: string | null
  email: string | null
  plan: string
}

interface GuidanceRow { id: string; user_id: string; created_at: string; message?: string }
interface ReportRow { id: string; user_id: string; created_at: string; month_key: string }
interface SessionRow { id: string; user_id: string; created_at: string; status: string; scheduled_at?: string; completed_at?: string }

export async function refreshTasksForAllUsers(): Promise<{ created: number; updated: number; errors: string[] }> {
  const now = new Date()
  const errors: string[] = []
  let created = 0
  let updated = 0

  // ── 1. Carregar perfis ──
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, plan')
    .not('plan', 'is', null)
    .limit(500)
  if (profErr) { errors.push('profiles: ' + profErr.message); return { created, updated, errors } }

  const curMonth = monthKey(now)
  const curWeek = weekKey(now)
  const curBiweek = biweekKey(now)

  // ── 2. Carregar pendências existentes (todos os status para dedup correto) ──
  const { data: existingTasks } = await supabase
    .from('user_personalization_tasks')
    .select('id, user_id, task_key, period_key, status, due_at, expires_at')

  const existingSet = new Set(
    (existingTasks ?? []).map((t: { user_id: string; task_key: string; period_key: string }) => `${t.user_id}|${t.task_key}|${t.period_key}`)
  )
  const existingMap = new Map(
    (existingTasks ?? []).map((t: { user_id: string; task_key: string; period_key: string; id: string; status: string; due_at: string | null; expires_at: string | null }) => [`${t.user_id}|${t.task_key}|${t.period_key}`, t])
  )

  // ── 3. Eventos ──
  const [
    { data: guidances },
    { data: reports },
    { data: activeSessions },
    { data: completedSessions },
  ] = await Promise.all([
    supabase.from('monthly_guidance_requests').select('id, user_id, created_at').eq('status', 'open'),
    supabase.from('monthly_reports').select('id, user_id, created_at, month_key').eq('month_key', curMonth),
    supabase.from('user_sessions').select('id, user_id, created_at, status, scheduled_at').in('status', ['requested', 'scheduled']),
    supabase.from('user_sessions')
      .select('id, user_id, created_at, completed_at')
      .eq('status', 'completed')
      .gte('completed_at', new Date(now.getTime() - 10 * 86400000).toISOString()),
  ])

  const guidanceByUser: Record<string, GuidanceRow[]> = {}
  for (const g of (guidances ?? []) as GuidanceRow[]) {
    if (!guidanceByUser[g.user_id]) guidanceByUser[g.user_id] = []
    guidanceByUser[g.user_id].push(g)
  }
  const reportByUser: Record<string, ReportRow[]> = {}
  for (const r of (reports ?? []) as ReportRow[]) {
    if (!reportByUser[r.user_id]) reportByUser[r.user_id] = []
    reportByUser[r.user_id].push(r)
  }
  const activeSessionByUser: Record<string, SessionRow[]> = {}
  for (const s of (activeSessions ?? []) as SessionRow[]) {
    if (!activeSessionByUser[s.user_id]) activeSessionByUser[s.user_id] = []
    activeSessionByUser[s.user_id].push(s)
  }
  const completedSessionByUser: Record<string, SessionRow[]> = {}
  for (const s of (completedSessions ?? []) as SessionRow[]) {
    if (!completedSessionByUser[s.user_id]) completedSessionByUser[s.user_id] = []
    completedSessionByUser[s.user_id].push(s)
  }

  // ── 4. Processar cada usuário ──
  const toInsert: Record<string, unknown>[] = []
  const toUpdate: { id: string; status: string; updated_at: string }[] = []

  for (const profile of (profiles ?? []) as ProfileRow[]) {
    const uid = profile.user_id
    const plan = profile.plan ?? 'free'
    const defs = getTaskDefsForPlan(plan)

    for (const def of defs) {
      const buildAndQueue = (periodKey: string, eventDate?: Date, eventId?: string, relatedIds?: Record<string, string>) => {
        const compositeKey = `${uid}|${def.key}|${periodKey}`
        const dueAt = dueDateForDef(def, now, eventDate)
        const expiresAt = def.expiresAfterDueDays !== null
          ? new Date(dueAt.getTime() + def.expiresAfterDueDays * 86400000)
          : null
        const status = computeTaskStatus(dueAt, expiresAt, now)

        if (existingSet.has(compositeKey)) {
          // Update status if needed
          const existing = existingMap.get(compositeKey)
          if (existing && existing.status === 'pending' && status !== 'pending') {
            toUpdate.push({ id: existing.id, status, updated_at: now.toISOString() })
          }
          return
        }

        toInsert.push({
          user_id: uid,
          plan_key: plan,
          task_key: def.key,
          task_title: def.title,
          task_description: def.description,
          content_type: def.contentType,
          target_area: def.targetArea,
          period_key: periodKey,
          status,
          due_at: dueAt.toISOString(),
          expires_at: expiresAt?.toISOString() ?? null,
          related_guidance_id: relatedIds?.guidance_id ?? null,
          related_report_id: relatedIds?.report_id ?? null,
          related_session_id: relatedIds?.session_id ?? null,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
      }

      if (def.frequency === 'weekly') {
        buildAndQueue(curWeek)
      } else if (def.frequency === 'biweekly') {
        buildAndQueue(curBiweek)
      } else if (def.frequency === 'monthly') {
        // Skip monthly_session if user already has a session this month
        if (def.key === 'monthly_session') {
          const hasSession = [...(activeSessionByUser[uid] ?? []), ...(completedSessionByUser[uid] ?? [])].length > 0
          if (hasSession) continue
        }
        buildAndQueue(curMonth)
      } else if (def.frequency === 'on_guidance') {
        for (const g of (guidanceByUser[uid] ?? [])) {
          buildAndQueue(`guidance-${g.id}`, new Date(g.created_at), g.id, { guidance_id: g.id })
        }
      } else if (def.frequency === 'on_report') {
        for (const r of (reportByUser[uid] ?? [])) {
          buildAndQueue(`report-${r.id}`, new Date(r.created_at), r.id, { report_id: r.id })
        }
      } else if (def.frequency === 'on_session') {
        for (const s of (activeSessionByUser[uid] ?? [])) {
          const eventDate = s.scheduled_at ? new Date(s.scheduled_at) : undefined
          buildAndQueue(`session-${s.id}`, eventDate, s.id, { session_id: s.id })
        }
      } else if (def.frequency === 'post_session') {
        for (const s of (completedSessionByUser[uid] ?? [])) {
          buildAndQueue(`postsession-${s.id}`, s.completed_at ? new Date(s.completed_at) : undefined, s.id, { session_id: s.id })
        }
      }
    }
  }

  // ── 5. Inserir novas tarefas em batches ──
  const BATCH = 50
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { error } = await supabase
      .from('user_personalization_tasks')
      .upsert(batch, { onConflict: 'user_id,task_key,period_key', ignoreDuplicates: true })
    if (error) errors.push('insert: ' + error.message)
    else created += batch.length
  }

  // ── 6. Atualizar status de atrasadas/expiradas ──
  for (const upd of toUpdate) {
    const { error } = await supabase
      .from('user_personalization_tasks')
      .update({ status: upd.status, updated_at: upd.updated_at })
      .eq('id', upd.id)
    if (error) errors.push('update: ' + error.message)
    else updated++
  }

  return { created, updated, errors }
}

export async function loadAllOpenTasks(): Promise<PersonalizationTask[]> {
  const { data, error } = await supabase
    .from('user_personalization_tasks')
    .select('*')
    .not('status', 'in', '("sent","resolved","cancelled","not_applicable","expired")')
    .order('due_at', { ascending: true })
    .limit(1000)
  if (error) return []
  return (data ?? []) as PersonalizationTask[]
}

export async function loadAllTasksForAdmin(limit = 1000): Promise<PersonalizationTask[]> {
  const { data } = await supabase
    .from('user_personalization_tasks')
    .select('*')
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as PersonalizationTask[]
}

export async function loadTasksForUser(userId: string): Promise<PersonalizationTask[]> {
  const { data } = await supabase
    .from('user_personalization_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('due_at', { ascending: true })
    .limit(200)
  return (data ?? []) as PersonalizationTask[]
}

// ── Due date display ──────────────────────────────────────────────────────────

export function formatDueLabel(dueAt: string | null): string {
  if (!dueAt) return '—'
  const d = new Date(dueAt)
  const now = new Date()
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0) return `Atrasado há ${Math.abs(diffDays)} dia${Math.abs(diffDays) !== 1 ? 's' : ''}`
  if (diffDays === 0) return 'Vence hoje'
  if (diffDays === 1) return 'Vence amanhã'
  return `Faltam ${diffDays} dias`
}

export function dueBadgeColors(status: TaskStatus, dueAt: string | null): string {
  if (status === 'sent') return 'bg-emerald-100 text-emerald-800'
  if (status === 'draft') return 'bg-blue-100 text-blue-700'
  if (status === 'expired') return 'bg-stone-100 text-stone-500'
  if (status === 'overdue') return 'bg-red-100 text-red-700'
  if (status === 'cancelled') return 'bg-stone-100 text-stone-400'
  // pending: check days remaining
  if (dueAt) {
    const diffDays = Math.round((new Date(dueAt).getTime() - Date.now()) / 86400000)
    if (diffDays === 0) return 'bg-orange-100 text-orange-700'
    if (diffDays <= 2) return 'bg-yellow-100 text-yellow-700'
    return 'bg-emerald-50 text-emerald-700'
  }
  return 'bg-stone-100 text-stone-600'
}

export function calculateTaskPriority(task: { status: string; due_at: string | null }): TaskPriority {
  if (!task.due_at) return 'low'
  const diffDays = Math.floor((new Date(task.due_at).getTime() - Date.now()) / 86400000)
  if (task.status === 'overdue' || diffDays <= 2) return 'high'
  if (diffDays <= 7) return 'medium'
  return 'low'
}

export function priorityBadgeColors(p: TaskPriority): string {
  if (p === 'high') return 'bg-red-50 text-red-600 border-red-200'
  if (p === 'medium') return 'bg-yellow-50 text-yellow-700 border-yellow-200'
  return 'bg-stone-50 text-stone-500 border-stone-200'
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'Alta', medium: 'Média', low: 'Baixa',
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  generated: 'Gerado',
  draft: 'Rascunho',
  sent: 'Enviado',
  resolved: 'Resolvido',
  expired: 'Expirado',
  overdue: 'Atrasado',
  cancelled: 'Cancelado',
  not_applicable: 'N/A',
}

export const TARGET_AREA_LABELS: Record<string, string> = {
  'para-voce': 'Para você',
  resumo: 'Mapa emocional → Resumo',
  diary: 'Diário',
  meditations: 'Meditações',
  exercises: 'Exercícios',
  reports: 'Relatórios',
  self_care_plan: 'Plano de autocuidado',
  guidance: 'Orientação profissional',
  professional_comments: 'Comentário profissional',
  session_plus: 'Orientação profissional',
  my_evolution: 'Mapa emocional',
}

// PERSONALIZED_CONTENT_LABELS mantido para compatibilidade com código legado.
// Fonte autoritativa agora é src/lib/personalizedContentLabels.ts
export const PERSONALIZED_CONTENT_LABELS: Record<string, string> = {
  article_suggestion: 'Sugestão de artigo',
  mini_challenge: 'Mini-desafio',
  diary_question: 'Pergunta para o diário',
  guided_meditation: 'Meditação guiada',
  emotional_exercise: 'Exercício emocional',
  monthly_summary: 'Resumo mensal',
  advanced_report: 'Relatório avançado',
  advanced_monthly_report: 'Relatório mensal avançado',
  weekly_self_care: 'Plano semanal de autocuidado',
  self_care_plan: 'Plano de autocuidado',
  monthly_review: 'Revisão mensal do plano',
  guidance_response: 'Resposta da orientação mensal',
  monthly_guidance_draft: 'Rascunho de orientação mensal',
  professional_comment: 'Comentário profissional',
  session_themes: 'Sugestões para sessão',
  session_summary: 'Resumo de sessão',
  post_session_message: 'Mensagem pós-sessão',
  content_recommendations: 'Recomendações personalizadas',
  guided_diary_notes: 'Notas guiadas para o diário',
  evolution_highlights: 'Destaques de evolução',
  report_suggestion: 'Sugestão de relatório',
  questionnaire_suggestion: 'Questionário recomendado',
  trail_suggestion: 'Sugestão de trilha',
  next_steps: 'Próximos passos de autocuidado',
}

// Wrapper que delega para a fonte central de labels.
export function getPersonalizedContentLabel(contentType: string): string {
  return getContentTypeLabel(contentType)
}

export const ACTION_VIEW_MAP: Record<string, string> = {
  'para-voce': 'my-evolution',
  resumo: 'my-evolution',
  diary: 'diary',
  meditations: 'meditations',
  exercises: 'my-evolution',
  reports: 'my-evolution',
  self_care_plan: 'my-evolution',
  guidance: 'my-evolution',
  professional_comments: 'my-evolution',
  session_plus: 'my-evolution',
  my_evolution: 'my-evolution',
}

// ── Prompt da IA por tipo de pendência ───────────────────────────────────────

export function buildTaskPrompt(task: { task_key: string; task_title: string; plan_key: string }, snapshot: TaskSnapshot): string {
  const planLabel = { free: 'Gratuito', essential: 'Essencial', therapeutic: 'Terapêutico', 'therapeutic-plus': 'Terapêutico Plus' }[task.plan_key] ?? task.plan_key
  const snapshotText = JSON.stringify(snapshot, null, 2)

  return `Você é um assistente de personalização do projeto "A Vida Não Colabora".
Sua tarefa é gerar exatamente o conteúdo correspondente a esta pendência administrativa.

PENDÊNCIA: ${task.task_title}
PLANO: ${planLabel}
DESTINO: ${TARGET_AREA_LABELS[snapshot.period] ?? snapshot.period}

REGRAS OBRIGATÓRIAS:
- Respeite rigorosamente o plano ${planLabel} e gere APENAS o conteúdo da pendência solicitada.
- Não gere conteúdo de outro tipo além do solicitado: "${task.task_title}".
- Não faça diagnóstico. Não afirme que o usuário tem transtorno.
- Não use linguagem clínica conclusiva. Não prometa cura.
- Não substitua acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.
- Use linguagem acolhedora, simples, prática, sem caráter clínico.
- Use expressões como "com base nos seus registros", "apareceu com frequência", "pode ser útil observar", "uma possibilidade de cuidado", "sem cobrança de perfeição".
- O conteúdo será revisado pelo admin antes de ser enviado ao usuário.

DADOS AGREGADOS DO USUÁRIO (resumo, sem identificação pessoal):
${snapshotText}

Gere agora o conteúdo completo para a pendência "${task.task_title}".
Comece com um título curto entre **asteriscos**, seguido do conteúdo principal.
Não inclua meta-comentários, apenas o conteúdo final pronto para revisão.`
}

export async function generateContentForTask(task: { task_key: string; task_title: string; plan_key: string }, snapshot: TaskSnapshot): Promise<string> {
  const prompt = buildTaskPrompt(task, snapshot)
  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai',
        seed: Math.floor(Math.random() * 9999),
      }),
      signal: AbortSignal.timeout(35000),
    })
    if (!res.ok) throw new Error('AI indisponível')
    return (await res.text()).trim()
  } catch {
    return `**${task.task_title}**\n\nConteúdo gerado localmente como fallback. Edite antes de enviar.`
  }
}
