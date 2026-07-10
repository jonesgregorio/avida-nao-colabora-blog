// ─── Gatilhos de e-mail transacional (client-side) ──────────────────────────────
// Cada função monta template_key + variáveis + idempotency_key e chama a Edge
// Function send-transactional-email. NUNCA quebra o fluxo do usuário: em caso de
// erro, apenas registra no console (o log real fica em email_logs).
//
// Eventos de PAGAMENTO/PLANO NÃO ficam aqui — são disparados server-side no
// webhook Stripe (nunca confiar no cliente para pagamento).

import { supabase } from './supabase'

const APP: string =
  (import.meta.env?.VITE_APP_URL as string | undefined) ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://avidanaocolabora.com')

// Links para dentro da conta (conteúdo sensível fica sempre dentro do app)
export const LINKS = {
  login:        `${APP}/login`,
  meuPlano:     `${APP}/meu-plano`,
  suporte:      `${APP}/suporte`,
  orientacoes:  `${APP}/guia-mensal`,
  minhaEvolucao:`${APP}/minha-evolucao`,
  relatorios:   `${APP}/meu-relatorio`,
  paraVoce:     `${APP}/minha-evolucao`,
  pagamento:    `${APP}/meu-plano`,
}

interface EmailArgs {
  userId?: string | null
  toEmail: string
  templateKey: string
  variables?: Record<string, unknown>
  relatedType?: string
  relatedId?: string
  idempotencyKey?: string
}

export async function sendTransactionalEmail(args: EmailArgs): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        user_id: args.userId ?? undefined,
        to_email: args.toEmail,
        template_key: args.templateKey,
        variables: args.variables ?? {},
        related_entity_type: args.relatedType,
        related_entity_id: args.relatedId,
        idempotency_key: args.idempotencyKey,
      },
    })
    if (error) return { ok: false, error: error.message }
    const d = data as { ok?: boolean; skipped?: boolean; error?: string } | null
    if (d?.error) return { ok: false, error: d.error }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Nunca propaga: e-mail é secundário ao fluxo principal
    console.warn('[emailTriggers] falha ao enviar', args.templateKey, msg)
    return { ok: false, error: msg }
  }
}

// ─── Eventos ────────────────────────────────────────────────────────────────────

export function emailWelcome(userId: string, toEmail: string, nome: string) {
  return sendTransactionalEmail({
    userId, toEmail, templateKey: 'welcome',
    variables: { nome, link_login: LINKS.login },
    idempotencyKey: `welcome:${userId}`,
  })
}

export function emailSupportReply(userId: string, toEmail: string, nome: string, ticketId: string, messageId: string) {
  return sendTransactionalEmail({
    userId, toEmail, templateKey: 'support_reply',
    variables: { nome, link_suporte: `${LINKS.suporte}/${ticketId}` },
    relatedType: 'ticket_message', relatedId: messageId,
    idempotencyKey: `support_reply:${messageId}`,
  })
}

export function emailGuidanceAnswered(userId: string, toEmail: string, nome: string, guidanceId: string, respondedAt: string) {
  return sendTransactionalEmail({
    userId, toEmail, templateKey: 'guidance_answered',
    variables: { nome, link_orientacoes: LINKS.orientacoes },
    relatedType: 'guidance', relatedId: guidanceId,
    idempotencyKey: `guidance_answered:${guidanceId}:${respondedAt}`,
  })
}

export function emailMonthlyReport(userId: string, toEmail: string, nome: string, reportId: string) {
  return sendTransactionalEmail({
    userId, toEmail, templateKey: 'monthly_report_available',
    variables: { nome, link_relatorios: LINKS.relatorios },
    relatedType: 'monthly_report', relatedId: reportId,
    idempotencyKey: `monthly_report_available:${reportId}`,
  })
}

export function emailProfessionalComment(userId: string, toEmail: string, nome: string, commentId: string) {
  return sendTransactionalEmail({
    userId, toEmail, templateKey: 'professional_comment_available',
    variables: { nome, link_comentarios: LINKS.minhaEvolucao },
    relatedType: 'professional_comment', relatedId: commentId,
    idempotencyKey: `professional_comment_available:${commentId}`,
  })
}

export function emailSelfCarePlan(userId: string, toEmail: string, nome: string, planId: string) {
  return sendTransactionalEmail({
    userId, toEmail, templateKey: 'self_care_plan_available',
    variables: { nome, link_autocuidado: LINKS.minhaEvolucao },
    relatedType: 'self_care_plan', relatedId: planId,
    idempotencyKey: `self_care_plan_available:${planId}`,
  })
}

export function emailPersonalizedContent(userId: string, toEmail: string, nome: string, deliveryId: string) {
  return sendTransactionalEmail({
    userId, toEmail, templateKey: 'personalized_content_available',
    variables: { nome, link_para_voce: LINKS.paraVoce },
    relatedType: 'personalized_delivery', relatedId: deliveryId,
    idempotencyKey: `personalized_content_available:${deliveryId}`,
  })
}

// Diário (Gratuito): aviso 1x/mês e limite atingido 1x/mês
export function emailDiaryLimitWarning(userId: string, toEmail: string, nome: string, monthKey: string) {
  return sendTransactionalEmail({
    userId, toEmail, templateKey: 'diary_limit_warning',
    variables: { nome, link_meu_plano: LINKS.meuPlano },
    idempotencyKey: `diary_limit_warning:${userId}:${monthKey}`,
  })
}

export function emailDiaryLimitReached(userId: string, toEmail: string, nome: string, monthKey: string) {
  return sendTransactionalEmail({
    userId, toEmail, templateKey: 'diary_limit_reached',
    variables: { nome, link_meu_plano: LINKS.meuPlano },
    idempotencyKey: `diary_limit_reached:${userId}:${monthKey}`,
  })
}

// ─── Wrappers "ForUser": buscam email/nome do perfil e disparam ────────────────
// (admin lê perfil de outros via RLS de admin; usuário lê o próprio)
async function recipientOf(userId: string): Promise<{ email?: string; nome: string }> {
  try {
    const { data } = await supabase.from('profiles').select('email, full_name').eq('user_id', userId).maybeSingle()
    const r = data as { email?: string; full_name?: string } | null
    return { email: r?.email ?? undefined, nome: r?.full_name || 'você' }
  } catch {
    return { nome: 'você' }
  }
}

export async function emailSupportReplyForUser(userId: string, ticketId: string, messageId: string) {
  const { email, nome } = await recipientOf(userId)
  if (email) void emailSupportReply(userId, email, nome, ticketId, messageId)
}

export async function emailGuidanceAnsweredForUser(userId: string, guidanceId: string, respondedAt: string) {
  const { email, nome } = await recipientOf(userId)
  if (email) void emailGuidanceAnswered(userId, email, nome, guidanceId, respondedAt)
}

export async function emailMonthlyReportForUser(userId: string, reportId: string) {
  const { email, nome } = await recipientOf(userId)
  if (email) void emailMonthlyReport(userId, email, nome, reportId)
}

export async function emailProfessionalCommentForUser(userId: string, commentId: string) {
  const { email, nome } = await recipientOf(userId)
  if (email) void emailProfessionalComment(userId, email, nome, commentId)
}

export async function emailSelfCarePlanForUser(userId: string, planId: string) {
  const { email, nome } = await recipientOf(userId)
  if (email) void emailSelfCarePlan(userId, email, nome, planId)
}

export async function emailPersonalizedContentForUser(userId: string, deliveryId: string) {
  const { email, nome } = await recipientOf(userId)
  if (email) void emailPersonalizedContent(userId, email, nome, deliveryId)
}

export async function emailDiaryLimitWarningForUser(userId: string, monthKey: string) {
  const { email, nome } = await recipientOf(userId)
  if (email) void emailDiaryLimitWarning(userId, email, nome, monthKey)
}

export async function emailDiaryLimitReachedForUser(userId: string, monthKey: string) {
  const { email, nome } = await recipientOf(userId)
  if (email) void emailDiaryLimitReached(userId, email, nome, monthKey)
}
