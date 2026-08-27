// Fonte oficial única do SLA de suporte por plano.
// Qualquer tela (usuário ou Admin) que exiba ou calcule prazo de resposta deve consumir daqui.
import { normalizePlan, type PlanKey } from './officialPlans.ts'

export const SUPPORT_SLA_HOURS: Record<PlanKey, number> = {
  free: 72,
  essential: 48,
  plus: 24,
}

export function getSupportSlaHours(plan: string | null | undefined): number {
  return SUPPORT_SLA_HOURS[normalizePlan(plan)]
}

export function getSupportSlaLabel(plan: string | null | undefined): string {
  return `até ${getSupportSlaHours(plan)}h úteis`
}
