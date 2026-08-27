import { supabase } from './supabase'
import {
  INHERIT_LABEL,
  OFFICIAL_FEATURES,
  OWN_FEATURE_KEYS,
  PLAN_KEYS,
  resolveKey,
  type PlanKey,
} from './officialPlans'

export type CatalogSurface = 'pricing' | 'my_plan' | 'comparison' | 'upgrade'
export type CatalogFeatureKind = 'technical' | 'commercial'

export interface CatalogPlanAccess {
  enabled: boolean
  label: string | null
  description: string | null
}

export interface PlanFeatureCatalogItem {
  key: string
  name: string
  description: string
  category: string
  order: number
  kind: CatalogFeatureKind
  isSystem: boolean
  isActive: boolean
  showOnPricing: boolean
  showOnMyPlan: boolean
  showOnComparison: boolean
  showOnUpgrade: boolean
  plans: Record<PlanKey, CatalogPlanAccess>
}

export interface PlanFeatureCatalog {
  items: PlanFeatureCatalogItem[]
  source: 'database' | 'fallback'
}

interface FeatureRow {
  feature_key: string
  feature_name: string
  feature_description?: string | null
  category?: string | null
  display_order?: number | null
  feature_kind?: string | null
  is_system?: boolean | null
  is_active?: boolean | null
  show_on_pricing?: boolean | null
  show_on_my_plan?: boolean | null
  show_on_comparison?: boolean | null
  show_on_upgrade?: boolean | null
}

interface AccessRow {
  plan_key: string
  feature_key: string
  enabled?: boolean | null
  custom_label?: string | null
  custom_description?: string | null
}

const officialKeySet = new Set(OFFICIAL_FEATURES.map(feature => feature.key))

function emptyAccess(): Record<PlanKey, CatalogPlanAccess> {
  return {
    free: { enabled: false, label: null, description: null },
    essential: { enabled: false, label: null, description: null },
    plus: { enabled: false, label: null, description: null },
  }
}

/**
 * Fallback local. Esta camada é APENAS de apresentação: entitlement técnico
 * continua em officialPlans.ts e nunca depende deste catálogo dinâmico.
 */
export function buildFallbackPlanFeatureCatalog(): PlanFeatureCatalog {
  const items = OFFICIAL_FEATURES.map(feature => {
    const plans = emptyAccess()
    for (const plan of PLAN_KEYS) {
      plans[plan].enabled = OWN_FEATURE_KEYS[plan].includes(feature.key)
    }
    return {
      key: feature.key,
      name: feature.name,
      description: '',
      category: feature.category,
      order: feature.order,
      kind: 'technical' as const,
      isSystem: true,
      isActive: true,
      showOnPricing: true,
      showOnMyPlan: true,
      showOnComparison: true,
      showOnUpgrade: true,
      plans,
    }
  })
  return { items, source: 'fallback' }
}

function chooseCanonicalRows(rows: FeatureRow[]): FeatureRow[] {
  const canonical = new Map<string, FeatureRow>()
  const commercial: FeatureRow[] = []

  for (const row of rows) {
    const resolved = resolveKey(row.feature_key)
    const isCommercial = row.feature_kind === 'commercial' || row.is_system === false
    if (isCommercial) {
      commercial.push(row)
      continue
    }
    if (!officialKeySet.has(resolved)) continue
    const existing = canonical.get(resolved)
    // Prefere a linha cuja feature_key já é a chave canônica, evitando aliases legados.
    if (!existing || row.feature_key === resolved) canonical.set(resolved, row)
  }

  return [...canonical.values(), ...commercial]
}

export async function loadPlanFeatureCatalog(): Promise<PlanFeatureCatalog> {
  const fallback = buildFallbackPlanFeatureCatalog()
  try {
    const [{ data: featureRows, error: featureError }, { data: accessRows, error: accessError }] = await Promise.all([
      supabase
        .from('plan_features')
        .select('feature_key,feature_name,feature_description,category,display_order,feature_kind,is_system,is_active,show_on_pricing,show_on_my_plan,show_on_comparison,show_on_upgrade')
        .order('display_order', { ascending: true }),
      supabase
        .from('plan_feature_access')
        .select('plan_key,feature_key,enabled,custom_label,custom_description'),
    ])

    if (featureError || accessError || !Array.isArray(featureRows)) return fallback

    const chosenRows = chooseCanonicalRows(featureRows as FeatureRow[])
    if (chosenRows.length === 0) return fallback

    const accesses = new Map<string, CatalogPlanAccess>()
    for (const row of (accessRows || []) as AccessRow[]) {
      const plan = PLAN_KEYS.includes(row.plan_key as PlanKey) ? row.plan_key as PlanKey : null
      if (!plan) continue
      const resolved = resolveKey(row.feature_key)
      const mapKey = `${plan}:${resolved}`
      const current = accesses.get(mapKey)
      // Linha canônica prevalece sobre alias legado.
      if (!current || row.feature_key === resolved) {
        accesses.set(mapKey, {
          enabled: row.enabled === true,
          label: row.custom_label?.trim() || null,
          description: row.custom_description?.trim() || null,
        })
      }
    }

    const fallbackByKey = new Map(fallback.items.map(item => [item.key, item]))
    const items: PlanFeatureCatalogItem[] = chosenRows.map(row => {
      const key = row.feature_kind === 'commercial' || row.is_system === false
        ? row.feature_key
        : resolveKey(row.feature_key)
      const fallbackItem = fallbackByKey.get(key)
      const plans = emptyAccess()
      for (const plan of PLAN_KEYS) {
        const saved = accesses.get(`${plan}:${key}`)
        plans[plan] = saved ?? fallbackItem?.plans[plan] ?? { enabled: false, label: null, description: null }
      }
      return {
        key,
        name: row.feature_name?.trim() || fallbackItem?.name || key,
        description: row.feature_description?.trim() || fallbackItem?.description || '',
        category: row.category?.trim() || fallbackItem?.category || 'Outros',
        order: Number.isFinite(row.display_order) ? Number(row.display_order) : fallbackItem?.order ?? 999,
        kind: row.feature_kind === 'commercial' || row.is_system === false ? 'commercial' : 'technical',
        isSystem: row.is_system !== false,
        isActive: row.is_active !== false,
        showOnPricing: row.show_on_pricing !== false,
        showOnMyPlan: row.show_on_my_plan !== false,
        showOnComparison: row.show_on_comparison !== false,
        showOnUpgrade: row.show_on_upgrade !== false,
        plans,
      }
    })

    // Se alguma feature oficial ainda não existe na tabela, mantém o fallback dela.
    const seen = new Set(items.map(item => item.key))
    for (const item of fallback.items) if (!seen.has(item.key)) items.push(item)

    return { items: items.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)), source: 'database' }
  } catch {
    return fallback
  }
}

function visibleOnSurface(item: PlanFeatureCatalogItem, surface: CatalogSurface): boolean {
  if (!item.isActive) return false
  if (surface === 'pricing') return item.showOnPricing
  if (surface === 'my_plan') return item.showOnMyPlan
  if (surface === 'comparison') return item.showOnComparison
  return item.showOnUpgrade
}

/**
 * Mantém o desenho comercial atual: recursos oficiais próprios + “Tudo do ...”.
 * Itens comerciais criados no Admin são acrescentados apenas aos planos marcados.
 */
export function getCatalogPlanBenefits(
  catalog: PlanFeatureCatalog,
  plan: PlanKey,
  surface: CatalogSurface,
): { key: string; label: string; description: string; inheritedLabel?: boolean }[] {
  const byKey = new Map(catalog.items.map(item => [item.key, item]))
  const result: { key: string; label: string; description: string; inheritedLabel?: boolean }[] = []
  const inheritLabel = INHERIT_LABEL[plan]
  if (plan !== 'free' && inheritLabel) {
    result.push({ key: `inherit:${plan}`, label: inheritLabel, description: '', inheritedLabel: true })
  }

  for (const key of OWN_FEATURE_KEYS[plan]) {
    const item = byKey.get(key)
    if (!item || !visibleOnSurface(item, surface)) continue
    const access = item.plans[plan]
    result.push({
      key: item.key,
      label: access.label || item.name,
      description: access.description || item.description,
    })
  }

  for (const item of catalog.items) {
    if (item.kind !== 'commercial' || !visibleOnSurface(item, surface)) continue
    const access = item.plans[plan]
    if (!access.enabled) continue
    result.push({
      key: item.key,
      label: access.label || item.name,
      description: access.description || item.description,
    })
  }

  return result
}
