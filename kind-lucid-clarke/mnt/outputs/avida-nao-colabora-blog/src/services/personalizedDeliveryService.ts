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

export async function sendPersonalizedDelivery(params: SendPersonalizedDeliveryParams): Promise<SendResult> {
  const { taskId, deliveryId, userId, adminId, contentType, targetArea, title, body, planKey, relatedGuidanceId } = params

  if (!body?.trim()) return { ok: false, error: 'Conteúdo vazio' }
  if (!userId) return { ok: false, error: 'Usuário não identificado' }
  if (!deliveryId) return { ok: false, error: 'Entrega não encontrada' }

  const now = new Date().toISOString()

  // 1. Atualizar delivery para status sent
  const { error: delivError } = await supabase
    .from('personalized_content_deliveries')
    .update({ status: 'sent', sent_at: now })
    .eq('id', deliveryId)
  if (delivError) return { ok: false, error: `Erro ao marcar entrega como enviada: ${delivError.message}` }

  // 2. Atualizar task para resolved
  const { error: taskError } = await supabase
    .from('user_personalization_tasks')
    .update({ status: 'resolved', delivery_id: deliveryId })
    .eq('id', taskId)
  if (taskError) return { ok: false, error: `Erro ao atualizar tarefa: ${taskError.message}` }

  // 3. Criar notificação para o usuário
  await supabase.from('notifications').insert({
    user_id: userId,
    title: 'Novo conteúdo personalizado disponível',
    body: `A equipe preparou "${title}" especialmente para você.`,
    type: 'personalized_content',
    action_view: targetArea ?? 'my_evolution',
    action_label: 'Ver conteúdo',
    is_read: false,
    created_at: now,
  })

  // 4. Reflexo em módulos específicos
  if (GUIDANCE_TYPES.has(contentType)) {
    await reflectInGuidance({ userId, adminId, title, body, relatedGuidanceId, now })
  }

  if (COMMENT_TYPES.has(contentType)) {
    await reflectInProfessionalComments({ userId, adminId, title, body, planKey, now })
  }

  return { ok: true }
}

async function reflectInGuidance({
  userId, adminId, title, body, relatedGuidanceId, now,
}: {
  userId: string; adminId: string; title: string; body: string
  relatedGuidanceId?: string | null; now: string
}) {
  if (relatedGuidanceId) {
    // Atualiza a orientação existente diretamente
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
