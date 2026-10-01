import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdminAal2 } from '../_shared/adminAuth.ts'

// ─── Excluir usuário (Admin) ─────────────────────────────────────────────────
// Remove DEFINITIVAMENTE uma conta e os dados pessoais dela. É irreversível.
//
// Segurança:
//  - só administrador com MFA (AAL2) validado no servidor (requireAdminAal2);
//  - o administrador digita o e-mail da conta; o servidor confere com o cadastro;
//  - nunca exclui a própria conta nem outra conta administrativa;
//  - RECUSA contas com histórico de cobrança (Stripe/assinatura): cancelamento,
//    reembolso e registros financeiros têm fluxo próprio em Assinaturas. Esta função
//    não toca no Stripe de forma alguma.
//  - registra a ação em admin_logs ANTES de apagar, sem guardar o e-mail por inteiro.
//
// Limpeza (mesma regra do "excluir minha conta" do próprio usuário, delete-account):
// tabelas com FK ON DELETE SET NULL são apagadas explicitamente para que conteúdo
// pessoal não sobreviva só anonimizado; o avatar é removido do Storage; as demais
// tabelas pessoais caem por ON DELETE CASCADE ao apagar o usuário do Auth.

const ALLOWED_ORIGINS = new Set([
  'https://avidanaocolabora.com',
  'https://www.avidanaocolabora.com',
  'https://avida-nao-colabora-blog.vercel.app',
])

function corsHeaders(origin: string | null) {
  const allowed = origin && (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))
    ? origin
    : Deno.env.get('SITE_URL') ?? 'https://www.avidanaocolabora.com'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function json(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SET_NULL_PERSONAL_TABLES = ['ai_generation_logs', 'analytics_events', 'comments', 'questionnaire_responses', 'admin_activity_events']

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return `${local.slice(0, 2)}***@${domain}`
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, headers)

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status, headers)

  let body: { user_id?: string; confirm_email?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Solicitação inválida.' }, 400, headers)
  }

  const userId = String(body.user_id ?? '')
  const confirmEmail = String(body.confirm_email ?? '').trim().toLowerCase()
  if (!UUID.test(userId)) return json({ error: 'Usuário inválido.' }, 400, headers)
  if (userId === auth.user.id) return json({ error: 'Você não pode excluir a própria conta por aqui.' }, 403, headers)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('email, role, plan, stripe_customer_id, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (profileError) {
    console.error('admin-delete-user profile:', profileError.message)
    return json({ error: 'Não foi possível validar o usuário agora.' }, 500, headers)
  }

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(userId)
  const targetEmail = String(profile?.email || authUser?.user?.email || '').trim().toLowerCase()
  if (authUserError || !authUser?.user || !targetEmail) return json({ error: 'Usuário não encontrado.' }, 404, headers)

  if (!confirmEmail || confirmEmail !== targetEmail) {
    return json({ error: 'O e-mail digitado não confere com o da conta.' }, 400, headers)
  }
  if (profile?.role === 'admin') {
    return json({ error: 'Contas administrativas não podem ser excluídas por aqui. Remova o acesso de administrador antes.' }, 403, headers)
  }

  // Cobrança: não tocamos no Stripe. Conta com cliente/assinatura precisa seguir o fluxo financeiro.
  const { data: subscription } = await admin
    .from('user_subscriptions')
    .select('status, provider_subscription_id')
    .eq('user_id', userId)
    .maybeSingle()
  const hasBilling = Boolean(profile?.stripe_customer_id || profile?.stripe_subscription_id || subscription?.provider_subscription_id)
  if (hasBilling) {
    return json({
      error: 'Esta conta tem histórico de cobrança (Stripe). Cancele a assinatura e trate reembolsos em Assinaturas antes de excluir. Nenhuma alteração foi feita.',
    }, 409, headers)
  }

  // Auditoria antes do apagamento (sem o e-mail completo).
  const { error: logError } = await admin.from('admin_logs').insert({
    admin_id: auth.user.id,
    action: 'delete',
    target_type: 'user',
    target_id: userId,
    details: JSON.stringify({ email: maskEmail(targetEmail), plan: profile?.plan ?? null, motivo: 'exclusão de conta pelo Admin' }),
  })
  if (logError) {
    console.error('admin-delete-user audit:', logError.message)
    return json({ error: 'Não foi possível registrar a auditoria. Nada foi excluído.' }, 500, headers)
  }

  try {
    for (const table of SET_NULL_PERSONAL_TABLES) {
      const { error } = await admin.from(table).delete().eq('user_id', userId)
      if (error) throw new Error(`${table}: ${error.message}`)
    }

    // Avatar em avatars/<user_id>/... (Storage precisa ser limpo antes de apagar o dono).
    for (let offset = 0; ; offset += 1000) {
      const { data: files, error: listError } = await admin.storage.from('avatars').list(userId, { limit: 1000, offset })
      if (listError) throw new Error(`avatars list: ${listError.message}`)
      if (!files?.length) break
      const paths = files.filter((file) => file.id !== null).map((file) => `${userId}/${file.name}`)
      if (paths.length) {
        const { error: removeError } = await admin.storage.from('avatars').remove(paths)
        if (removeError) throw new Error(`avatars remove: ${removeError.message}`)
      }
      if (files.length < 1000) break
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false)
    if (deleteError) throw deleteError

    return json({ ok: true }, 200, headers)
  } catch (error) {
    console.error('admin-delete-user cleanup:', (error as Error).message)
    return json({ error: 'Não foi possível concluir a exclusão. Verifique o usuário na lista e tente de novo.' }, 500, headers)
  }
})
