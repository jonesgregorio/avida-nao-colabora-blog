import type { Plan } from '../types'

const PLAN_ORDER: Record<string, number> = {
  free: 0,
  essential: 1,
  plus: 2,
  // legados → mesmo tier do Plus
  therapeutic: 2,
  'therapeutic-plus': 2,
}

// Static fallback — pisos por recurso na nova estrutura de 3 planos.
const FEATURE_PLAN_FLOOR: Record<string, Plan> = {
  // Conteúdo (Conteúdos guiados)
  articles_free: 'free',
  biweekly_auto_challenges: 'free',
  guided_text_meditations: 'essential',
  emotional_exercise_library: 'essential',
  personalized_content_recommendations: 'essential',
  early_access_content: 'essential',

  // Diário emocional
  wellbeing_diary_limited: 'free',
  diary_monthly_limit_5: 'free',
  wellbeing_diary_5_month: 'free',
  simple_mood_checkin: 'free',
  diary_unlimited: 'essential',
  guided_diary_notes: 'essential',
  advanced_diary: 'essential',
  extra_emotional_markers: 'essential',
  extra_markers_sleep_depression_fear_compulsion_triggers_anxiety_selfesteem_energy: 'essential',

  // Avaliações / Mapa emocional
  basic_self_assessment: 'free',
  weekly_assessments: 'essential',
  deep_questionnaire: 'essential',
  simple_evolution_charts: 'essential',
  monthly_pdf_reports: 'essential',
  diary_mood_symptoms_summary: 'essential',
  evolution_highlights_no_clinical_analysis: 'essential',
  monthly_comparative_charts: 'essential',

  // Histórico
  limited_history: 'free',
  full_history: 'essential',

  // Plano de autocuidado (Plus)
  personalized_self_care_plan: 'plus',
  weekly_self_care_plan: 'essential',
  monthly_self_care_plan_review: 'plus',
  advanced_monthly_report: 'plus',

  // Orientação profissional (Plus)
  monthly_message_guidance: 'plus',
  professional_comment_on_monthly_report: 'plus',
  monthly_psychoanalyst_session_30min: 'plus',

  // Suporte
  priority_email_support: 'essential',
  maximum_priority_support: 'plus',

  // Anúncios
  ads_enabled: 'free',
  no_ads: 'essential',
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
