export type PricingPlanKey = 'free' | 'essential' | 'plus'
export type PricingPlanAction = 'auth' | 'current' | 'checkout' | 'manage'

export function resolvePricingPlanAction(
  hasUser: boolean,
  currentPlan: PricingPlanKey,
  targetPlan: PricingPlanKey,
): PricingPlanAction {
  if (!hasUser) return 'auth'
  if (currentPlan === targetPlan) return 'current'
  if (currentPlan !== 'free') return 'manage'
  return 'checkout'
}
