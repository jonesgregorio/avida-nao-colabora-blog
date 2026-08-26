// Camada de compatibilidade para as telas de comparação.
// Os dados reais vivem em officialPlans.ts; este arquivo apenas mantém os nomes
// de export já consumidos por Pricing e Meu Plano.
import {
  OFFICIAL_PLAN_COMPARISON,
  PUBLIC_PLAN_FEATURES,
  type PlanCompareValue,
  type PlanKey,
} from './officialPlans'

export type { PlanCompareValue } from './officialPlans'

export interface PlanCompareRow {
  label: string
  values: Record<PlanKey, PlanCompareValue>
}

export const PLAN_COMPARE_ROWS: PlanCompareRow[] = OFFICIAL_PLAN_COMPARISON.map(row => ({
  label: row.label,
  values: row.values,
}))

export const PLAN_BENEFITS: Record<PlanKey, string[]> = PUBLIC_PLAN_FEATURES
