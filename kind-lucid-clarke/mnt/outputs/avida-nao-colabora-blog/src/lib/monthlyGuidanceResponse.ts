// Fonte única do prazo de resposta da Orientação Mensal (Admin e usuário
// devem calcular a mesma data prevista a partir do mesmo envio).
export const GUIDANCE_RESPONSE_SLA_DAYS = 7

export function guidanceResponseDueDate(createdAtIso: string): Date {
  return new Date(new Date(createdAtIso).getTime() + GUIDANCE_RESPONSE_SLA_DAYS * 86400_000)
}

export function guidanceDaysUntilDue(createdAtIso: string): number {
  return Math.ceil((guidanceResponseDueDate(createdAtIso).getTime() - Date.now()) / 86400_000)
}

export interface GuidanceLetter {
  title?: string
  user_request_summary?: string
  emotional_context_summary?: string
  gentle_guidance?: string
  practical_next_steps?: string[]
  connection_with_self_care_plan?: string
  suggested_reflection_question?: string
  final_message_draft?: string
  data_quality_notice?: string
  review_badge?: string
}

type GuidanceResponseSource = {
  finalResponseJson?: unknown
  aiDraftJson?: { final_response?: unknown } | null
  response?: string | null
}

export type ResolvedGuidanceResponse =
  | { letter: GuidanceLetter; fallback: '' }
  | { letter: undefined; fallback: string }
  | null

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isGuidanceLetter(value: unknown): value is GuidanceLetter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const letter = value as GuidanceLetter
  return Object.entries(letter).some(([key, field]) =>
    key === 'practical_next_steps'
      ? Array.isArray(field) && field.some(hasText)
      : hasText(field),
  )
}

// A coluna canônica prevalece; os dois formatos anteriores continuam legíveis.
export function resolveGuidanceResponse(source: GuidanceResponseSource): ResolvedGuidanceResponse {
  if (isGuidanceLetter(source.finalResponseJson)) {
    return { letter: source.finalResponseJson, fallback: '' }
  }
  if (isGuidanceLetter(source.aiDraftJson?.final_response)) {
    return { letter: source.aiDraftJson.final_response, fallback: '' }
  }
  if (hasText(source.response)) {
    return { letter: undefined, fallback: source.response }
  }
  return null
}

export function isGuidanceAnswered(status: string, source: GuidanceResponseSource): boolean {
  return status === 'answered' && resolveGuidanceResponse(source) !== null
}
