// Normaliza o `records_summary` persistido do Plano de Autocuidado (monthly_care_plans)
// para exibição em "Base deste plano" — no Admin e, em versão resumida, para o usuário.
//
// Existem hoje DOIS geradores que escrevem nessa mesma coluna jsonb com formatos
// diferentes: a automação por cron (supabase/functions/run-emotional-automations,
// snake_case: active_days/total_checkins/total_main_diaries) e a geração manual no
// Admin (src/lib/careePlanAI.ts, camelCase: activeDays/checkinCount/diaryCount).
// Este normalizador lê os dois formatos sem exigir migração de dados históricos.
export interface CarePlanBasis {
  activeDays: number
  checkinCount: number
  diaryCount: number
  emotionalMarkers: string[]
  contexts: string[]
  needs: string[]
  careActions: string[]
  realTriggers: string[]
  dataQualityMessage: string | null
}

function tagList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map(item => (item && typeof item === 'object' ? String((item as Record<string, unknown>).tag ?? '') : ''))
    .filter(Boolean)
}

function numberOf(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

export function normalizeCarePlanBasis(raw: Record<string, unknown> | null | undefined): CarePlanBasis | null {
  if (!raw || typeof raw !== 'object') return null
  const dataQuality = raw.data_quality && typeof raw.data_quality === 'object'
    ? raw.data_quality as Record<string, unknown>
    : null
  return {
    activeDays: numberOf(raw.active_days ?? raw.activeDays),
    checkinCount: numberOf(raw.total_checkins ?? raw.checkinCount),
    diaryCount: numberOf(raw.total_main_diaries ?? raw.diaryCount),
    emotionalMarkers: tagList(raw.emotional_markers ?? raw.emotionalMarkers),
    contexts: tagList(raw.contexts),
    needs: tagList(raw.needs),
    careActions: tagList(raw.care_actions ?? raw.careActions),
    realTriggers: tagList(raw.real_triggers ?? raw.realTriggers),
    dataQualityMessage: typeof dataQuality?.message === 'string' ? dataQuality.message : null,
  }
}

/** Versão resumida e natural para o usuário, sem menção a IA. */
export function describeCarePlanBasis(basis: CarePlanBasis, monthLabel: string): string {
  const parts: string[] = []
  if (basis.checkinCount > 0) parts.push(`${basis.checkinCount} check-in${basis.checkinCount === 1 ? '' : 's'}`)
  if (basis.diaryCount > 0) parts.push(`${basis.diaryCount} registro${basis.diaryCount === 1 ? '' : 's'} de diário`)
  if (!parts.length) return `Este plano considera seus registros de ${monthLabel}.`
  return `Este plano considera seus registros de ${monthLabel}, incluindo ${parts.join(' e ')}.`
}
