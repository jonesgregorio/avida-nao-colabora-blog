// ─────────────────────────────────────────────────────────────────────────────
// Player por etapas dos Conteúdos Guiados. Um artigo sem etapas cadastradas
// nunca passa por aqui — continua sendo lido normalmente em ArticleView.tsx.
// Progresso é sempre do próprio usuário (RLS em guided_content_progress).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'

export interface GuidedStep {
  id: string
  article_id: string
  step_order: number
  title: string
  instruction: string
  duration_seconds: number | null
}

export type GuidedProgressStatus = 'not_started' | 'in_progress' | 'paused' | 'completed'

export interface GuidedProgress {
  status: GuidedProgressStatus
  current_step_order: number
  reflection_text: string | null
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
}

export async function loadGuidedSteps(articleId: string): Promise<GuidedStep[]> {
  const { data, error } = await supabase
    .from('guided_content_steps')
    .select('id,article_id,step_order,title,instruction,duration_seconds')
    .eq('article_id', articleId)
    .order('step_order', { ascending: true })
  if (error) return []
  return (data ?? []) as GuidedStep[]
}

export async function loadGuidedProgress(userId: string, articleId: string): Promise<GuidedProgress | null> {
  const { data, error } = await supabase
    .from('guided_content_progress')
    .select('status,current_step_order,reflection_text,started_at,paused_at,completed_at')
    .eq('user_id', userId)
    .eq('article_id', articleId)
    .maybeSingle()
  if (error || !data) return null
  return data as GuidedProgress
}

async function upsertProgress(userId: string, articleId: string, patch: Partial<GuidedProgress>): Promise<void> {
  await supabase.from('guided_content_progress').upsert(
    { user_id: userId, article_id: articleId, updated_at: new Date().toISOString(), ...patch },
    { onConflict: 'user_id,article_id' },
  )
}

export async function startGuidedContent(userId: string, articleId: string): Promise<void> {
  await upsertProgress(userId, articleId, {
    status: 'in_progress', current_step_order: 0, started_at: new Date().toISOString(), paused_at: null, completed_at: null,
  })
}

export async function advanceGuidedStep(userId: string, articleId: string, stepOrder: number): Promise<void> {
  await upsertProgress(userId, articleId, { status: 'in_progress', current_step_order: stepOrder, paused_at: null })
}

export async function pauseGuidedContent(userId: string, articleId: string, currentStepOrder: number): Promise<void> {
  await upsertProgress(userId, articleId, { status: 'paused', current_step_order: currentStepOrder, paused_at: new Date().toISOString() })
}

export async function resumeGuidedContent(userId: string, articleId: string, currentStepOrder: number): Promise<void> {
  await upsertProgress(userId, articleId, { status: 'in_progress', current_step_order: currentStepOrder, paused_at: null })
}

export async function completeGuidedContent(userId: string, articleId: string, reflection?: string): Promise<void> {
  await upsertProgress(userId, articleId, {
    status: 'completed', completed_at: new Date().toISOString(), paused_at: null,
    ...(reflection?.trim() ? { reflection_text: reflection.trim().slice(0, 2000) } : {}),
  })
}
