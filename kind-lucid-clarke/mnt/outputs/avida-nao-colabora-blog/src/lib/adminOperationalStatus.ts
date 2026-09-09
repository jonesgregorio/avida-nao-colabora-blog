import { supabase } from './supabase'

// Camada única de status operacional do Admin.
// Dashboard, sino/central de alertas e "Filas e falhas" devem consumir daqui —
// nunca reimplementar a regra de "o que é pendência" cada um do seu jeito.
//
// Fonte: RPC admin_queues_overview() (filas + incidentes ativos + histórico 24h).

export interface OperationalSnapshot {
  ok: boolean // a RPC principal respondeu (false = estado desconhecido, NÃO "sem problemas")
  generatedAt?: string
  queues: Record<string, number>
  failuresActive: Record<string, number>
  failures24h: Record<string, number>
}

// Filas que representam TRABALHO HUMANO/OPERACIONAL a fazer.
// Buckets sem sobreposição entre si e com TECH_FAILURE_KEYS.
export const ACTION_QUEUE_KEYS = [
  'guidance_pending',
  'tickets_open',
  'reports_pending_review',
  'care_plans_pending',
  'cancellations_to_handle',
  'personalization_overdue',
  'notifications_draft',
  'webhooks_stuck',
] as const

// Incidentes técnicos ATIVOS (última tentativa da frente ainda falhou).
export const TECH_FAILURE_KEYS = [
  'ai_errors',
  'emails_failed',
  'reports_failed',
  'care_plans_failed',
  'content_jobs_failed',
  'webhooks_failed',
] as const

const EMPTY: OperationalSnapshot = { ok: false, queues: {}, failuresActive: {}, failures24h: {} }

export async function fetchOperationalSnapshot(): Promise<OperationalSnapshot> {
  const { data, error } = await supabase.rpc('admin_queues_overview')
  if (error || !data || typeof data !== 'object') return { ...EMPTY }
  const snap = data as {
    generated_at?: string
    queues?: Record<string, number>
    failures_active?: Record<string, number>
    failures_24h?: Record<string, number>
  }
  return {
    ok: true,
    generatedAt: snap.generated_at,
    queues: snap.queues ?? {},
    failuresActive: snap.failures_active ?? snap.failures_24h ?? {},
    failures24h: snap.failures_24h ?? {},
  }
}

const sumKeys = (src: Record<string, number>, keys: readonly string[]) =>
  keys.reduce((total, key) => total + (Number(src[key]) || 0), 0)

/** Trabalho humano/operacional aguardando ação. */
export function actionItemsCount(s: OperationalSnapshot): number {
  return sumKeys(s.queues, ACTION_QUEUE_KEYS)
}

/** Incidentes técnicos ativos (IA, e-mail, jobs, webhooks, relatórios/planos com falha). */
export function techFailuresCount(s: OperationalSnapshot): number {
  return sumKeys(s.failuresActive, TECH_FAILURE_KEYS)
}

/** Total deduplicado do que precisa de atenção (ação + falhas técnicas). */
export function attentionTotal(s: OperationalSnapshot): number {
  return actionItemsCount(s) + techFailuresCount(s)
}

// Deep-link: ao abrir "Uso de IA" a partir de um alerta de falha de IA, deixa a
// tela pré-filtrada em Status = Erro (a mesma semântica de failures_active).
// One-shot: a tela consome e remove a chave no mount.
export const AI_USAGE_STATUS_KEY = 'admin-ai-usage-status'
export function markAiFailuresDeepLink(): void {
  try { localStorage.setItem(AI_USAGE_STATUS_KEY, 'error') } catch { /* storage indisponível não impede navegação */ }
}
export function consumeAiUsageStatusPreset(): string | null {
  try {
    const v = localStorage.getItem(AI_USAGE_STATUS_KEY)
    if (v) { localStorage.removeItem(AI_USAGE_STATUS_KEY); return v }
  } catch { /* noop */ }
  return null
}
