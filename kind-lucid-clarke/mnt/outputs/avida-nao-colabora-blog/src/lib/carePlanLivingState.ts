import { supabase } from './supabase'

export type CarePlanActionState = {
  action_key: string
  action_text: string
  state: 'active' | 'considering' | 'paused' | 'removed'
  outcome: string | null
  adapted_text: string | null
}

export async function loadCarePlanActionStates(userId: string, carePlanId: string): Promise<CarePlanActionState[]> {
  const { data, error } = await supabase
    .from('care_plan_action_state')
    .select('action_key,action_text,state,outcome,adapted_text')
    .eq('user_id', userId)
    .eq('care_plan_id', carePlanId)
  if (error) throw error
  return (data ?? []) as CarePlanActionState[]
}

export async function saveCarePlanActionState(input: {
  userId: string
  carePlanId: string
  actionKey: string
  actionText: string
  state: CarePlanActionState['state']
  outcome: string | null
  adaptedText: string | null
}): Promise<void> {
  const { error } = await supabase.from('care_plan_action_state').upsert({
    user_id: input.userId,
    care_plan_id: input.carePlanId,
    action_key: input.actionKey,
    action_text: input.actionText,
    state: input.state,
    outcome: input.outcome,
    adapted_text: input.adaptedText,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'care_plan_id,action_key' })
  if (error) throw error
}
