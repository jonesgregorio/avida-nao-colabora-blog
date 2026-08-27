import { DEFAULT_PLAN_ACCESS, OFFICIAL_FEATURES, PLAN_KEYS, type PlanKey } from './officialPlans'
import type { PlanFeatureCatalog } from './planFeatureCatalog'

export type PlanFeatureConsistencySeverity = 'error' | 'warning'

export interface PlanFeatureConsistencyIssue {
  id: string
  severity: PlanFeatureConsistencySeverity
  featureKey: string
  plan?: PlanKey
  title: string
  detail: string
}

const officialKeys = new Set(OFFICIAL_FEATURES.map(feature => feature.key))

export function inspectPlanFeatureCatalog(catalog: PlanFeatureCatalog): PlanFeatureConsistencyIssue[] {
  const issues: PlanFeatureConsistencyIssue[] = []
  const byKey = new Map(catalog.items.map(item => [item.key, item]))

  for (const feature of OFFICIAL_FEATURES) {
    const item = byKey.get(feature.key)
    if (!item) {
      issues.push({
        id: `missing:${feature.key}`,
        severity: 'error',
        featureKey: feature.key,
        title: `Funcionalidade técnica ausente: ${feature.name}`,
        detail: 'A chave oficial não está presente no catálogo carregado. O site deve usar o fallback até isso ser corrigido.',
      })
      continue
    }

    if (item.kind !== 'technical' || !item.isSystem) {
      issues.push({
        id: `kind:${feature.key}`,
        severity: 'error',
        featureKey: feature.key,
        title: `${item.name} perdeu a proteção de recurso técnico`,
        detail: 'Uma chave oficial deve continuar marcada como recurso do sistema e nunca virar apenas um benefício comercial.',
      })
    }

    for (const plan of PLAN_KEYS) {
      const expected = DEFAULT_PLAN_ACCESS[plan].includes(feature.key)
      const configured = item.plans[plan].enabled
      if (expected !== configured) {
        issues.push({
          id: `access:${feature.key}:${plan}`,
          severity: 'error',
          featureKey: feature.key,
          plan,
          title: `${item.name}: catálogo e acesso real divergem no plano ${plan}`,
          detail: expected
            ? 'O recurso é liberado pela regra técnica do produto, mas está desativado no catálogo de planos.'
            : 'O catálogo marca o recurso como disponível, mas a regra técnica do produto não libera esse recurso neste plano.',
        })
      }
    }
  }

  const names = new Map<string, string[]>()
  for (const item of catalog.items.filter(item => item.isActive)) {
    const normalized = item.name.trim().toLocaleLowerCase('pt-BR')
    if (normalized) names.set(normalized, [...(names.get(normalized) || []), item.key])

    if (item.kind === 'commercial' && !PLAN_KEYS.some(plan => item.plans[plan].enabled)) {
      issues.push({
        id: `commercial-without-plan:${item.key}`,
        severity: 'warning',
        featureKey: item.key,
        title: `${item.name} não aparece em nenhum plano`,
        detail: 'A funcionalidade comercial está ativa, mas nenhum dos três planos está marcado para exibi-la.',
      })
    }

    if (item.kind === 'commercial' && officialKeys.has(item.key)) {
      issues.push({
        id: `commercial-official-key:${item.key}`,
        severity: 'error',
        featureKey: item.key,
        title: `${item.name} usa uma chave reservada do sistema`,
        detail: 'Benefícios comerciais novos precisam usar uma chave custom_... e não podem reutilizar a chave de uma funcionalidade técnica.',
      })
    }
  }

  for (const [name, keys] of names) {
    if (keys.length <= 1) continue
    issues.push({
      id: `duplicate-name:${name}`,
      severity: 'warning',
      featureKey: keys[0],
      title: `Nome duplicado no catálogo: “${catalog.items.find(item => item.key === keys[0])?.name || name}”`,
      detail: `Este mesmo nome está sendo usado por ${keys.length} funcionalidades ativas. Isso pode deixar o comparativo confuso.`,
    })
  }

  return issues
}
