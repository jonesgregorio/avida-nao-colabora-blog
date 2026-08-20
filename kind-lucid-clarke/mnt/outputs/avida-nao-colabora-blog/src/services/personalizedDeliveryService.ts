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
 * O caller continua responsável pelo envio principal em
 * personalized_content_deliveries/user_personalization_tasks. Este serviço nunca
 * deve fingir sucesso quando o reflexo no módulo oficial falhar: o retorno `ok`
 * permite registrar/avisar a inconsistência de forma explícita.
 */
export async function sendPersonalizedDelivery(params: SendPersonalizedDeliveryParams): Promise<SendResult> {
  const { userId, adminId, contentType, targetArea, title, body, relatedGuidanceId } = params

  if (!body?.trim()) return { ok: false, error: 'Conteúdo vazio' }
  if (!userId) return { ok: false, error: 'Usuário não identificado' }

  const now = new Date().toISOString()

  if (GUIDANCE_TYPES.has(contentType) || targetArea === 'guidance') {
    return reflectInGuidance({ userId, adminId, body, relatedGuidanceId, now })
  }

  if (COMMENT_TYPES.has(contentType) || targetArea === 'professional_comments') {
    return reflectInProfessionalComments({ userId, adminId, title, body, now })
  }

  return { ok: true }
}

async function reflectInGuidance({
  userId, adminId, body, relatedGuidanceId, now,
}: {
  userId: string; adminId: string; body: string
  relatedGuidanceId?: string | null; now: string
}): Promise<SendResult> {
  if (relatedGuidanceId) {
    const { error } = await supabase.from('monthly_guidance_requests').update({
      response: body,
      status: 'answered',
      responded_at: now,
      responded_by: adminId,
    }).eq('id', relatedGuidanceId)
    return error ? { ok: false, error: `Falha ao atualizar orientação mensal: ${error.message}` } : { ok: true }
  }

  const monthKey = now.slice(0, 7)
  const { data: open, error: lookupError } = await supabase
    .from('monthly_guidance_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('month_key', monthKey)
    .in('status', ['open', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupError) return { ok: false, error: `Falha ao localizar orientação mensal: ${lookupError.message}` }
  if (!open?.id) return { ok: false, error: 'Nenhuma orientação mensal aberta foi encontrada para este usuário no mês atual.' }

  const { error: updateError } = await supabase.from('monthly_guidance_requests').update({
    response: body,
    status: 'answered',
    responded_at: now,
    responded_by: adminId,
  }).eq('id', open.id)

  return updateError
    ? { ok: false, error: `Falha ao refletir orientação mensal: ${updateError.message}` }
    : { ok: true }
}

async function reflectInProfessionalComments({
  userId, adminId, title, body, now,
}: {
  userId: string; adminId: string; title: string; body: string; now: string
}): Promise<SendResult> {
  const reportMonth = now.slice(0, 7)

  // professional_comments possui report_month como chave temporal. Não use
  // month_key/plan_key/status/updated_at: esses campos não fazem parte do schema
  // oficial desta tabela.
  const { data: existing, error: selectError } = await supabase
    .from('professional_comments')
    .select('id')
    .eq('user_id', userId)
    .eq('report_month', reportMonth)
    .eq('comment_text', body)
    .limit(1)
    .maybeSingle()

  if (selectError) return { ok: false, error: `Falha ao verificar comentário profissional: ${selectError.message}` }
  if (existing?.id) return { ok: true }

  const { error: insertError } = await supabase.from('professional_comments').insert({
    user_id: userId,
    professional_id: adminId || null,
    created_by: adminId || null,
    report_month: reportMonth,
    title,
    comment: body,
    comment_text: body,
    visibility: 'user',
    is_read: false,
    created_at: now,
  })

  return insertError
    ? { ok: false, error: `Falha ao gravar comentário profissional: ${insertError.message}` }
    : { ok: true }
}
