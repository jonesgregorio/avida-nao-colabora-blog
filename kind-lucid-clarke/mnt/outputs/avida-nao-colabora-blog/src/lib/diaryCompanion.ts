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

const DIARY_COMPANION_TIMEOUT_MS = 26_000

export async function askDiaryCompanion(input: CompanionInput): Promise<DiaryCompanionResponse> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('A ajuda de IA demorou mais que o esperado. Seu texto continua intacto e você pode seguir sem ela.')), DIARY_COMPANION_TIMEOUT_MS)
  })

  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke<DiaryCompanionResponse>('diary-companion', { body: input }),
      timeout,
    ])
    if (error) throw new Error(error.message || 'Não foi possível usar a ajuda de IA agora.')
    if (!data?.ok) throw new Error(data?.message || 'Não foi possível usar a ajuda de IA agora.')
    return data
  } finally {
    if (timer) clearTimeout(timer)
  }
}
