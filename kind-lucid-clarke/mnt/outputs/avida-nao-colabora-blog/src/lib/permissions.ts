import type { Plan } from '../types'
import {
  OFFICIAL_FEATURES,
  OWN_FEATURE_KEYS,
  PLAN_KEYS,
  PLAN_RANK,
  normalizePlan,
  resolveKey,
  type PlanKey,
} from './officialPlans'

// Compatibilidade para consumidores antigos: a ordem agora é um alias direto da
// hierarquia oficial, em vez de uma segunda tabela independente.
export const PLAN_ORDER = PLAN_RANK

// Descobre o piso de cada recurso a partir do catálogo oficial e das features
// próprias de cada plano. Aliases passam por resolveKey(), portanto não existe
// mais um segundo FEATURE_PLAN_FLOOR para manter manualmente.
function minimumPlanForFeature(featureKey: string): PlanKey | null {
  const canonicalKey = resolveKey(featureKey)
  const exists = OFFICIAL_FEATURES.some(feature => feature.key === canonicalKey)
  if (!exists) return null
  return PLAN_KEYS.find(plan => OWN_FEATURE_KEYS[plan].includes(canonicalKey)) ?? null
}

// Runtime cache from plan_feature_access table (populated via loadPlanAccess()).
let runtimeAccess: Record<string, Record<string, boolean>> | null = null

export function canAccessFeature(userPlan: Plan | string | null | undefined, featureKey: string): boolean {
  const raw = String(userPlan || 'free')
  const norm = normalizePlan(raw)
  const canonicalKey = resolveKey(featureKey)

  // Cache runtime (plan_feature_access): tenta o plano bruto e o normalizado. As
  // chaves são normalizadas ao carregar para que aliases legados não criem uma
  // matriz paralela de autorização.
  if (runtimeAccess) {
    const row = runtimeAccess[raw] ?? runtimeAccess[norm]
    if (row) return row[canonicalKey] ?? false
  }

  const floor = minimumPlanForFeature(canonicalKey)
  if (!floor) return false
  return PLAN_RANK[norm] >= PLAN_RANK[floor]
}

export async function loadPlanAccess(supabaseClient: {
  from: (t: string) => { select: (cols: string) => Promise<{ data: Array<{ plan_key: string; feature_key: string; enabled: boolean }> | null }> }
}) {
  if (runtimeAccess) return runtimeAccess

  const { data } = await supabaseClient.from('plan_feature_access').select('plan_key,feature_key,enabled')
  if (!data || data.length === 0) return null

  const map: Record<string, Record<string, boolean>> = {}
  for (const row of data) {
    const planKey = normalizePlan(row.plan_key)
    if (!map[planKey]) map[planKey] = {}
    map[planKey][resolveKey(row.feature_key)] = row.enabled
  }
  runtimeAccess = map
  return map
}

export function clearPermissionsCache() {
  runtimeAccess = null
}
