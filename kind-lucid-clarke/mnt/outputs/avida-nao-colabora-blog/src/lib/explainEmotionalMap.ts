import { supabase } from './supabase'
import type { EmotionalSummary } from './emotionalAnalytics'

// ETAPA 3 — o cliente envia somente dados estruturados do Mapa Emocional.
// Não consulta nem transmite `text` do Diário ou respostas abertas de questionário.

export interface ExplainMapPreviousPeriod {
  period_start: string
  period_end: string
  active_days: number
  total_entries: number
  total_checkins?: number
  total_main_diaries?: number
  dominant_emotions?: EmotionalSummary['dominant_emotions']
  averages?: Partial<EmotionalSummary['averages']>
}

export interface ExplainMapQuestionnaireSignals {
  completedCount: number
  topTags: { tag: string; count: number }[]
}

export interface ExplainMapApiResult {
  title: string
  summary: string
  what_stood_out: string
  possible_connection: string
  something_to_observe: string
  positive_resource: string
  reflection_question: string
  data_quality_notice: string
}

// O card existente usa listas para organizar a leitura visual. A API segue o
// contrato exato do prompt e esta camada apenas adapta os campos, sem gerar
// conteúdo novo nem calcular métricas.
export interface ExplainMapResult {
  title: string
  what_stands_out: string
  possible_connections: string[]
  helpful_signals: string[]
  what_to_observe: string[]
  reflection_question: string
  data_quality_notice: string
}

interface ExplainMapApiResponse {
  ok: boolean
  ai_used?: boolean
  low_sample?: boolean
  cached?: boolean
  provider?: string | null
  model?: string | null
  generated_at?: string | null
  result?: ExplainMapApiResult
  message?: string
}

export interface ExplainMapResponse extends Omit<ExplainMapApiResponse, 'result'> {
  result?: ExplainMapResult
}

interface MonthlyConnectionPayload {
  context: string
  marker: string
  need: string
  care_action: string
  count: number
}

const EXPLAIN_MAP_TIMEOUT_MS = 20_000
const EXPLAIN_MAP_ERROR = 'Não foi possível gerar a leitura do mapa agora. Tente novamente em instantes.'

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string').map(v => String(v).trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter(v => typeof v === 'string').map(v => String(v).trim()).filter(Boolean)
    } catch { return [value.trim()] }
    return [value.trim()]
  }
  return []
}

async function loadMonthlyConnections(current: EmotionalSummary): Promise<MonthlyConnectionPayload[]> {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('context_tags,emotional_tags,need_tags,care_action_tags')
    .gte('date', current.period_start)
    .lt('date', current.period_end)

  if (error || !data?.length) return []

  const counts = new Map<string, MonthlyConnectionPayload>()
  for (const raw of data as Array<Record<string, unknown>>) {
    const contexts = asArray(raw.context_tags)
    const markers = asArray(raw.emotional_tags)
    const needs = asArray(raw.need_tags)
    const careActions = asArray(raw.care_action_tags)
    for (const context of contexts) for (const marker of markers) for (const need of needs) for (const care_action of careActions) {
      const key = `${context}\u0000${marker}\u0000${need}\u0000${care_action}`
      const existing = counts.get(key)
      counts.set(key, existing ? { ...existing, count: existing.count + 1 } : { context, marker, need, care_action, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5)
}

function adaptResult(result: ExplainMapApiResult | undefined): ExplainMapResult | undefined {
  if (!result) return undefined
  return {
    title: result.title,
    what_stands_out: [result.summary, result.what_stood_out].filter(Boolean).join(' '),
    possible_connections: result.possible_connection ? [result.possible_connection] : [],
    helpful_signals: result.positive_resource ? [result.positive_resource] : [],
    what_to_observe: result.something_to_observe ? [result.something_to_observe] : [],
    reflection_question: result.reflection_question,
    data_quality_notice: result.data_quality_notice,
  }
}

export async function explainEmotionalMap(input: {
  current: EmotionalSummary
  previous: ExplainMapPreviousPeriod | null
  questionnaire_signals: ExplainMapQuestionnaireSignals
  // Botão secundário "Atualizar leitura" — pula o cache de propósito.
  force?: boolean
}): Promise<ExplainMapResponse> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(EXPLAIN_MAP_ERROR)), EXPLAIN_MAP_TIMEOUT_MS)
  })

  try {
    const monthly_connections = await loadMonthlyConnections(input.current)
    const { data, error } = await Promise.race([
      supabase.functions.invoke<ExplainMapApiResponse>('explain-emotional-map', { body: { ...input, monthly_connections } }),
      timeout,
    ])
    if (error) throw new Error(EXPLAIN_MAP_ERROR)
    if (!data?.ok) throw new Error(EXPLAIN_MAP_ERROR)
    return { ...data, result: adaptResult(data.result) }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
