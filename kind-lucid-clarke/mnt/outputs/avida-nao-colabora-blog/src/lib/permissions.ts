import type { Plan } from '../types'

const PLAN_ORDER: Record<string, number> = {
  free: 0,
  essential: 1,
  plus: 2,
  // legados → mesmo tier do Plus
  therapeutic: 2,
  'therapeutic-plus': 2,
}

// Pisos por recurso — SOMENTE os recursos dos 3 planos oficiais (§17).
// Nada de meditações/pdf/suporte isolados, diário avançado, marcadores extras,
// recomendações, acesso antecipado, avaliações semanais, anúncios etc.
const FEATURE_PLAN_FLOOR: Record<string, Plan> = {
  // Gratuito
  articles_free: 'free',                 // blog aberto
  wellbeing_diary_5_month: 'free',       // diário emocional básico
  wellbeing_diary_limited: 'free',       // (alias de compat)
  diary_monthly_limit_5: 'free',         // (alias de compat)
  simple_mood_checkin: 'free',
  basic_self_assessment: 'free',         // questionário inicial
  biweekly_auto_challenges: 'free',      // algumas práticas guiadas

  // Essencial
  diary_unlimited: 'essential',          // diário ilimitado
  diary_mood_symptoms_summary: 'essential', // mapa emocional completo
  full_history: 'essential',             // histórico e gráficos
  simple_evolution_charts: 'essential',
  emotional_exercise_library: 'essential', // conteúdos guiados completos
  weekly_assessments: 'essential',       // relatório semanal automático

  // Plus
  personalized_self_care_plan: 'plus',            // plano de autocuidado mensal
  advanced_monthly_report: 'plus',                // relatório mensal aprofundado
  professional_comment_on_monthly_report: 'plus', // comentário profissional mensal
  monthly_message_guidance: 'plus',               // orientação mensal por mensagem
}

// Runtime cache from plan_feature_access table (populated via loadPlanAccess())
let runtimeAccess: Record<string, Record<string, boolean>> | null = null

export function canAccessFeature(userPlan: Plan | string | null | undefined, featureKey: string): boolean {
  const raw = String(userPlan || 'free')
  const norm = raw === 'therapeutic' || raw === 'therapeutic-plus' || raw === 'therapeutic_plus' ? 'plus' : raw

  // Cache runtime (plan_feature_access): tenta o plano e o normalizado. Se não houver
  // linha para o plano (ex.: banco ainda sem 'plus'), cai no fallback estático em vez
  // de bloquear tudo.
  if (runtimeAccess) {
    const row = runtimeAccess[raw] ?? runtimeAccess[norm]
    if (row) return row[featureKey] ?? false
  }

  const floor = FEATURE_PLAN_FLOOR[featureKey]
  if (!floor) return false
  return (PLAN_ORDER[norm] ?? 0) >= (PLAN_ORDER[floor] ?? 99)
}

export async function loadPlanAccess(supabaseClient: {
  from: (t: string) => { select: (cols: string) => Promise<{ data: Array<{ plan_key: string; feature_key: string; enabled: boolean }> | null }> }
}) {
  if (runtimeAccess) return runtimeAccess

  const { data } = await supabaseClient.from('plan_feature_access').select('plan_key,feature_key,enabled')
  if (!data || data.length === 0) return null

  const map: Record<string, Record<string, boolean>> = {}
  for (const row of data) {
    if (!map[row.plan_key]) map[row.plan_key] = {}
    map[row.plan_key][row.feature_key] = row.enabled
  }
  runtimeAccess = map
  return map
}

export function clearPermissionsCache() {
  runtimeAccess = null
}

export { PLAN_ORDER }
