import { supabase } from './supabase'
import type { EmotionalSummary } from './emotionalAnalytics'

// "Entender meu mapa com IA" (MISSÃO GERAL, PARTE 3): só envia o resumo
// estruturado já calculado no cliente (nunca diário bruto, nunca respostas
// abertas de questionário).

export interface ExplainMapPreviousPeriod {
  period_start: string
  period_end: string
  active_days: number
  total_entries: number
  dominant_emotions?: EmotionalSummary['dominant_emotions']
  averages?: Partial<EmotionalSummary['averages']>
}

export interface ExplainMapQuestionnaireSignals {
  completedCount: number
  topTags: { tag: string; count: number }[]
}

export interface ExplainMapResult {
  what_stood_out: string
  what_changed: string
  worth_observing: string
  reflection_question: string
}

export interface ExplainMapResponse {
  ok: boolean
  ai_used?: boolean
  low_sample?: boolean
  result?: ExplainMapResult
  message?: string
}

const EXPLAIN_MAP_TIMEOUT_MS = 20_000

export async function explainEmotionalMap(input: {
  current: EmotionalSummary
  previous: ExplainMapPreviousPeriod | null
  questionnaire_signals: ExplainMapQuestionnaireSignals
}): Promise<ExplainMapResponse> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('A leitura por IA demorou mais que o esperado. Tente novamente em instantes.')), EXPLAIN_MAP_TIMEOUT_MS)
  })

  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke<ExplainMapResponse>('explain-emotional-map', { body: input }),
      timeout,
    ])
    if (error) throw new Error(error.message || 'Não foi possível gerar a leitura do mapa agora.')
    if (!data?.ok) throw new Error(data?.message || 'Não foi possível gerar a leitura do mapa agora.')
    return data
  } finally {
    if (timer) clearTimeout(timer)
  }
}
