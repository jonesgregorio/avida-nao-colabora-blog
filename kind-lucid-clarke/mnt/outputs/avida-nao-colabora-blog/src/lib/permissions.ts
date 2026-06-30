import type { Plan } from '../types'

const PLAN_ORDER: Record<string, number> = {
  free: 0,
  essential: 1,
  therapeutic: 2,
  'therapeutic-plus': 3,
}

// Static fallback map: feature_key → minimum plan required
const FEATURE_PLAN_FLOOR: Record<string, Plan> = {
  articles_free: 'free',
  basic_questionnaire: 'free',
  diary_limited: 'free',
  saved_items_limited: 'free',

  articles_premium: 'essential',
  diary_unlimited: 'essential',
  guided_notes: 'essential',
  diary_summary: 'essential',
  saved_items_unlimited: 'essential',
  weekly_evaluations: 'essential',
  simple_charts: 'essential',
  monthly_pdf_report: 'essential',
  guided_meditations: 'essential',
  exercise_library: 'essential',
  no_ads: 'essential',
  priority_email_support: 'essential',

  premium_trails: 'therapeutic',
  deep_questionnaire: 'therapeutic',
  diary_advanced: 'therapeutic',
  advanced_charts: 'therapeutic',
  advanced_pdf_report: 'therapeutic',
  personalized_recommendations: 'therapeutic',
  personalized_self_care_plan: 'therapeutic',
  automatic_personalized_content: 'therapeutic',
  early_access: 'therapeutic',
  monthly_group_guidance: 'therapeutic',

  individual_session: 'therapeutic-plus',
  session_preparation: 'therapeutic-plus',
  professional_summary: 'therapeutic-plus',
  professional_comment: 'therapeutic-plus',
  session_reminders: 'therapeutic-plus',
  saved_items_session: 'therapeutic-plus',
  maximum_support: 'therapeutic-plus',
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
