import { supabase } from '../lib/supabase'

export interface SendPersonalizedDeliveryParams {
  taskId: string
  deliveryId: string
  userId: string
  adminId: string
  contentType: string
  targetArea: string | null
  title: string
  body: string
  planKey?: string | null
  relatedGuidanceId?: string | null
}

export interface SendResult {
  ok: boolean
  error?: string
}

// Tipos que refletem em monthly_guidance_requests
const GUIDANCE_TYPES = new Set([
  'guidance', 'monthly_guidance', 'guidance_response',
])

// Tipos que refletem em professional_comments
const COMMENT_TYPES = new Set([
  'professional_comment', 'report_comment', 'monthly_report_comment',
])

/**
 * Reflete o conteúdo enviado nos módulos oficiais corretos
 * (monthly_guidance_requests, professional_comments).
 *
 * Esta função é chamada APÓS o envio principal já ter sido registrado
 * em personalized_content_deliveries e user_personalization_tasks.
 * Se falhar, o envio principal não é desfeito.
 */
export async function sendPersonalizedDelivery(params: SendPersonalizedDeliveryParams): Promise<SendResult> {
  const { userId, adminId, contentType, targetArea, title, body, planKey, relatedGuidanceId } = params

  if (!body?.trim()) return { ok: false, error: 'Conteúdo vazio' }
  if (!userId) return { ok: false, error: 'Usuário não identificado' }

  const now = new Date().toISOString()

  // Reflexo em monthly_guidance_requests
  if (GUIDANCE_TYPES.has(contentType) || targetArea === 'guidance') {
    await reflectInGuidance({ userId, adminId, body, relatedGuidanceId, now })
  }

  // Reflexo em professional_comments
  if (COMMENT_TYPES.has(contentType) || targetArea === 'professional_comments') {
    await reflectInProfessionalComments({ userId, adminId, title, body, planKey, now })
  }

  return { ok: true }
}

async function reflectInGuidance({
  userId, adminId, body, relatedGuidanceId, now,
}: {
  userId: string; adminId: string; body: string
  relatedGuidanceId?: string | null; now: string
}) {
  if (relatedGuidanceId) {
    await supabase.from('monthly_guidance_requests').update({
      response: body,
      status: 'answered',
      responded_at: now,
      responded_by: adminId,
    }).eq('id', relatedGuidanceId)
    return
  }

  // Tenta localizar orientação aberta do usuário no mês atual
  const monthKey = now.slice(0, 7)
  const { data: open } = await supabase
    .from('monthly_guidance_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('month_key', monthKey)
    .in('status', ['open', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (open?.id) {
    await supabase.from('monthly_guidance_requests').update({
      response: body,
      status: 'answered',
      responded_at: now,
      responded_by: adminId,
    }).eq('id', open.id)
  }
}

async function reflectInProfessionalComments({
  userId, adminId, title, body, planKey, now,
}: {
  userId: string; adminId: string; title: string; body: string
  planKey?: string | null; now: string
}) {
  const monthKey = now.slice(0, 7)

  // Verifica se já existe um registro para este mês/usuário (evita duplicata)
  const { data: existing } = await supabase
    .from('professional_comments')
    .select('id')
    .eq('user_id', userId)
    .eq('month_key', monthKey)
    .eq('comment_text', body)
    .limit(1)
    .maybeSingle()

  if (existing?.id) return // já refletido

  await supabase.from('professional_comments').insert({
    user_id: userId,
    professional_id: adminId,
    month_key: monthKey,
    report_month: monthKey,
    title,
    comment: body,
    comment_text: body,
    plan_key: planKey ?? null,
    status: 'sent',
    created_at: now,
    updated_at: now,
  })
}
