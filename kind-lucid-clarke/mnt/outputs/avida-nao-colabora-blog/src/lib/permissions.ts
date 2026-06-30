import type { Plan } from '../types'

const PLAN_ORDER: Record<string, number> = {
  free: 0,
  essential: 1,
  therapeutic: 2,
  'therapeutic-plus': 3,
}

// Static fallback — chaves oficiais da versão final dos planos
const FEATURE_PLAN_FLOOR: Record<string, Plan> = {
  // Conteúdo
  articles_free: 'free',
  guided_text_meditations: 'essential',
  emotional_exercise_library: 'essential',
  personalized_content_recommendations: 'therapeutic',
  early_access_content: 'therapeutic',

  // Diário
  wellbeing_diary_limited: 'free',
  diary_monthly_limit_5: 'free',
  simple_mood_checkin: 'free',
  diary_unlimited: 'essential',
  guided_diary_notes: 'essential',
  advanced_diary: 'therapeutic',
  extra_markers_sleep_depression_fear_compulsion_triggers_anxiety_selfesteem_energy: 'therapeutic',

  // Avaliações
  basic_self_assessment: 'free',
  biweekly_auto_challenges: 'free',
  weekly_assessments: 'essential',
  deep_questionnaire: 'therapeutic',

  // Relatórios
  monthly_pdf_reports: 'essential',
  diary_mood_symptoms_summary: 'essential',
  evolution_highlights_no_clinical_analysis: 'essential',
  simple_evolution_charts: 'essential',
  monthly_comparative_charts: 'therapeutic',
  advanced_monthly_report: 'therapeutic',

  // Histórico
  limited_history: 'free',
  full_history: 'essential',

  // Autocuidado
  personalized_self_care_plan: 'therapeutic',
  weekly_self_care_plan: 'therapeutic',
  monthly_self_care_plan_review: 'therapeutic-plus',

  // Suporte
  priority_email_support: 'essential',
  maximum_priority_support: 'therapeutic-plus',

  // Sessão / Profissional
  monthly_message_guidance: 'therapeutic',
  monthly_psychoanalyst_session_30min: 'therapeutic-plus',
  professional_comment_on_monthly_report: 'therapeutic-plus',

  // Anúncios
  ads_enabled: 'free',
  no_ads: 'essential',
}

// Runtime cache from plan_feature_access table (populated via loadPlanAccess())
let runtimeAccess: Record<string, Record<string, boolean>> | null = null

export function canAccessFeature(userPlan: Plan | string | null | undefined, featureKey: string): boolean {
  const plan = (userPlan || 'free') as Plan

  // Use runtime cache if available
  if (runtimeAccess) {
    return runtimeAccess[plan]?.[featureKey] ?? false
  }

  // Fallback to static map
  const floor = FEATURE_PLAN_FLOOR[featureKey]
  if (!floor) return false
  return PLAN_ORDER[plan] >= PLAN_ORDER[floor]
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
