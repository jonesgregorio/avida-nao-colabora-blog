// ─────────────────────────────────────────────────────────────────────────────
// Notificações in-app — função central + matriz de destinos.
//
// Objetivos:
//   • um único ponto para criar notificação (nada de insert espalhado);
//   • cada tipo tem um destino (token de navegação) canônico;
//   • corrige destinos legados errados no momento do clique (ex.: autocuidado
//     que antigamente apontava para o Mapa Emocional);
//   • nunca quebra o fluxo principal (falha só loga no console).
//
// O `action_url` guarda um TOKEN que o App resolve (ex.: 'self-care',
// 'my-report', 'support-ticket:<id>', 'article:<slug>').
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'

// Destino canônico por TIPO de notificação (tokens de navegação do App).
// Nunca usar 'my-evolution' (Mapa) como destino coringa.
export const NOTIF_DESTINATION: Record<string, string> = {
  self_care_review: 'self-care',
  care_plan_available: 'self-care',
  support_reply: 'support',
  support_ticket_replied: 'support',
  content: 'articles',
  guided_content_available: 'articles',
  personalized_content: 'self-care',
  weekly_report: 'my-report',
  monthly_report: 'my-report',
  report: 'my-report',
  professional_comment: 'professional-comments',
  professional_comment_available: 'professional-comments',
  monthly_guidance: 'monthly-guidance',
  monthly_guidance_replied: 'monthly-guidance',
  plan_change: 'my-plan',
  plan_updated: 'my-plan',
  payment: 'my-plan',
  payment_notice: 'my-plan',
  admin_message: 'notifications',
}

// Tokens legados/genéricos que devem ser corrigidos para o destino do tipo.
const BAD_TOKENS = new Set(['my-evolution', 'mapa-emocional', 'dashboard', ''])

/**
 * Resolve o destino final de uma notificação ao clicar. Corrige action_urls
 * legados/errados usando a matriz por tipo. Preserva tokens com id
 * (ex.: 'support-ticket:123', 'article:slug').
 */
export function resolveNotifDestination(type: string, actionUrl?: string | null): string {
  const url = (actionUrl ?? '').trim()
  if (url.includes(':')) return url // token com recurso específico → mantém
  const canonical = NOTIF_DESTINATION[type]
  if (!url || BAD_TOKENS.has(url)) return canonical ?? 'notifications'
  // Se o destino salvo é o Mapa mas o tipo tem destino próprio, corrige.
  if (canonical && url !== canonical && BAD_TOKENS.has(url)) return canonical
  return url
}

export interface CreateNotificationInput {
  userId: string | null | undefined
  type: string
  title: string
  message: string
  /** Token de navegação. Se omitido, usa o destino canônico do tipo. */
  destination?: string
  targetResourceType?: string
  targetResourceId?: string
  priority?: 'low' | 'normal' | 'high'
  actionData?: Record<string, unknown>
  /** Se informado, evita duplicar a mesma notificação (mesmo user+type+chave). */
  dedupeKey?: string
}

// Registra a tentativa de entrega (best-effort; nunca interrompe).
async function logDelivery(userId: string, status: 'sent' | 'failed', destination: string, error?: string) {
  try {
    await supabase.from('notification_delivery_logs').insert({
      user_id: userId, channel: 'in_app', status, destination_path: destination, error_message: error ?? null,
    })
  } catch { /* auditoria é secundária */ }
}

/**
 * Cria uma notificação in-app para um usuário. Ponto ÚNICO de criação.
 * Grava destino canônico + referência ao recurso + auditoria de entrega.
 * Best-effort: nunca lança — retorna { ok, error }.
 */
export async function createUserNotification(input: CreateNotificationInput): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const { userId, type, title, message, destination, targetResourceType, targetResourceId, priority, actionData, dedupeKey } = input
  if (!userId) return { ok: false, error: 'userId ausente' }
  const action_url = destination ?? NOTIF_DESTINATION[type] ?? 'notifications'
  try {
    if (dedupeKey) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .contains('action_data', { key: dedupeKey })
        .limit(1)
        .maybeSingle()
      if (existing) return { ok: true, skipped: true }
    }
    let createdBy: string | null = null
    try { const { data: auth } = await supabase.auth.getUser(); createdBy = auth.user?.id ?? null } catch { /* opcional */ }

    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      action_url,
      destination_path: action_url,
      target_resource_type: targetResourceType ?? null,
      target_resource_id: targetResourceId ?? null,
      priority: priority ?? 'normal',
      created_by: createdBy,
      action_data: dedupeKey ? { ...(actionData ?? {}), key: dedupeKey } : (actionData ?? null),
      is_read: false,
    })
    if (error) {
      console.warn('[notifications] falha ao criar', type, error.message)
      void logDelivery(userId, 'failed', action_url, error.message)
      return { ok: false, error: error.message }
    }
    void logDelivery(userId, 'sent', action_url)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[notifications] exceção ao criar', type, msg)
    void logDelivery(userId, 'failed', action_url, msg)
    return { ok: false, error: msg }
  }
}
