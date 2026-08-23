import { supabase } from './supabase'

export type DiaryCompanionAction = 'start' | 'mirror' | 'continue' | 'organize'

export interface DiarySuggestedTags {
  emotions: string[]
  contexts: string[]
  needs: string[]
  care_actions: string[]
  triggers: string[]
}

export interface DiaryMirror {
  title: string
  weight: string
  observation: string
  strength: string
  question: string
  pattern?: string
  suggested_tags: DiarySuggestedTags
  ai_used: boolean
  model?: string
}

export interface DiaryCompanionResponse {
  ok: boolean
  action: DiaryCompanionAction
  prompt?: string
  organized_text?: string
  mirror?: DiaryMirror
  message?: string
  ai_used?: boolean
  model?: string
}

interface CompanionInput {
  action: DiaryCompanionAction
  mood?: string
  text?: string
  entry_id?: string
  hour?: number
}

export async function askDiaryCompanion(input: CompanionInput): Promise<DiaryCompanionResponse> {
  const { data, error } = await supabase.functions.invoke<DiaryCompanionResponse>('diary-companion', { body: input })
  if (error) throw new Error(error.message || 'Não foi possível usar a ajuda de IA agora.')
  if (!data?.ok) throw new Error(data?.message || 'Não foi possível usar a ajuda de IA agora.')
  return data
}
