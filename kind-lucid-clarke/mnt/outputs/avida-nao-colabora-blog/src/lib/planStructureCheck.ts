import { supabase } from './supabase'
import { DEFAULT_PLAN_ACCESS, OFFICIAL_FEATURES, PLAN_KEYS } from './officialPlans'

export interface PlanStructureCheckResult {
  createdFeatures: number
  createdAccessRows: number
  accessDivergences: number
  totalExpectedFeatures: number
  totalExpectedAccessRows: number
}

interface ExistingFeatureRow {
  feature_key: string
}

interface ExistingAccessRow {
  plan_key: string
  feature_key: string
  enabled: boolean
}

/**
 * Verifica a estrutura mínima necessária para o catálogo de planos sem
 * sobrescrever configurações existentes. Ausências são criadas com o padrão
 * oficial; divergências são apenas contabilizadas para o Admin revisar.
 */
export async function verifyPlanStructure(): Promise<PlanStructureCheckResult> {
  const [{ data: featureRows, error: featureError }, { data: accessRows, error: accessError }] = await Promise.all([
    supabase.from('plan_features').select('feature_key'),
    supabase.from('plan_feature_access').select('plan_key,feature_key,enabled'),
  ])

  if (featureError) throw new Error(`Falha ao verificar funcionalidades: ${featureError.message}`)
  if (accessError) throw new Error(`Falha ao verificar vínculos dos planos: ${accessError.message}`)

  const existingFeatureKeys = new Set(((featureRows ?? []) as ExistingFeatureRow[]).map(row => row.feature_key))
  const now = new Date().toISOString()
  const missingFeatures = OFFICIAL_FEATURES
    .filter(feature => !existingFeatureKeys.has(feature.key))
    .map(feature => ({
      feature_key: feature.key,
      feature_name: feature.name,
      feature_description: '',
      category: feature.category,
      display_order: feature.order,
      is_implemented: true,
      updated_at: now,
    }))

  if (missingFeatures.length > 0) {
    const { error } = await supabase.from('plan_features').insert(missingFeatures)
    if (error) throw new Error(`Falha ao criar funcionalidades ausentes: ${error.message}`)
  }

  const existingAccess = new Map<string, boolean>()
  for (const row of (accessRows ?? []) as ExistingAccessRow[]) {
    existingAccess.set(`${row.plan_key}:${row.feature_key}`, row.enabled === true)
  }

  const missingAccess: { plan_key: string; feature_key: string; enabled: boolean; updated_at: string }[] = []
  let accessDivergences = 0
  for (const plan of PLAN_KEYS) {
    const defaults = new Set(DEFAULT_PLAN_ACCESS[plan])
    for (const feature of OFFICIAL_FEATURES) {
      const key = `${plan}:${feature.key}`
      const expected = defaults.has(feature.key)
      if (!existingAccess.has(key)) {
        missingAccess.push({
          plan_key: plan,
          feature_key: feature.key,
          enabled: expected,
          updated_at: now,
        })
      } else if (existingAccess.get(key) !== expected) {
        accessDivergences += 1
      }
    }
  }

  if (missingAccess.length > 0) {
    const { error } = await supabase.from('plan_feature_access').insert(missingAccess)
    if (error) throw new Error(`Falha ao criar vínculos ausentes: ${error.message}`)
  }

  return {
    createdFeatures: missingFeatures.length,
    createdAccessRows: missingAccess.length,
    accessDivergences,
    totalExpectedFeatures: OFFICIAL_FEATURES.length,
    totalExpectedAccessRows: PLAN_KEYS.length * OFFICIAL_FEATURES.length,
  }
}
