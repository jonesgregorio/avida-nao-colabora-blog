import { supabase } from './supabase'

// Auditoria de ações administrativas -> tabela admin_logs (lida em Sistema > Logs).
// Regras:
//  - Nunca quebra o fluxo principal (try/catch, fire-and-forget).
//  - NUNCA registrar dado sensível (senha, token, conteúdo privado). Em `details`
//    guarde só metadados úteis (título, slug, nome, plano, status...).
//
// `action` usa verbos curtos que a UI já colore: create | update | delete |
// publish | archive | login | promote_admin | revoke_admin | respond |
// ai_generate | config.
export async function logAdminAction(
  action: string,
  targetType?: string | null,
  targetId?: string | null,
  details?: Record<string, unknown> | null,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      details: details ?? null,
    })
  } catch {
    /* auditoria nunca deve interromper a ação principal */
  }
}
