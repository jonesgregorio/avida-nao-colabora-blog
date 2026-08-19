import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

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

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, headers)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Não autorizado.' }, 401, headers)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user?.email) return json({ error: 'Sessão inválida ou expirada.' }, 401, headers)

  let body: { confirmation?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Solicitação inválida.' }, 400, headers)
  }

  if (body.confirmation !== 'EXCLUIR') {
    return json({ error: 'Digite EXCLUIR para confirmar.' }, 400, headers)
  }
  if (!body.password) {
    return json({ error: 'Informe sua senha atual para confirmar.' }, 400, headers)
  }

  // Reautenticação obrigatória no servidor. A senha nunca é persistida nem registrada.
  const reauth = createClient(url, anonKey)
  const { error: passwordError } = await reauth.auth.signInWithPassword({
    email: user.email,
    password: body.password,
  })
  if (passwordError) return json({ error: 'Senha atual incorreta.' }, 403, headers)

  const admin = createClient(url, serviceKey)

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role,plan,stripe_customer_id,stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profileError) {
    console.error('delete-account profile:', profileError.message)
    return json({ error: 'Não foi possível validar sua conta agora.' }, 500, headers)
  }

  if (profile?.role === 'admin') {
    return json({ error: 'Contas administrativas não podem ser excluídas por esta tela.' }, 403, headers)
  }

  const { data: subscription } = await admin
    .from('user_subscriptions')
    .select('provider_subscription_id,status')
    .eq('user_id', user.id)
    .maybeSingle()

  const stripeCustomerId = profile?.stripe_customer_id || null
  const stripeSubscriptionId = subscription?.provider_subscription_id || profile?.stripe_subscription_id || null
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') || ''

  // Encerrar cobrança ANTES de remover a conta. Se o Stripe falhar de verdade,
  // interrompemos a exclusão para nunca apagar a conta deixando cobrança futura ativa.
  if ((stripeCustomerId || stripeSubscriptionId) && !stripeSecret) {
    return json({ error: 'Não foi possível encerrar a cobrança com segurança. Tente novamente mais tarde.' }, 503, headers)
  }

  if (stripeSecret) {
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })
    try {
      if (stripeCustomerId) {
        await stripe.customers.del(stripeCustomerId)
      } else if (stripeSubscriptionId) {
        await stripe.subscriptions.cancel(stripeSubscriptionId)
      }
    } catch (error) {
      const stripeError = error as { code?: string; message?: string }
      if (stripeError.code !== 'resource_missing') {
        console.error('delete-account Stripe:', stripeError.code, stripeError.message)
        return json({ error: 'Não foi possível encerrar sua assinatura agora. Sua conta não foi excluída.' }, 502, headers)
      }
    }
  }

  try {
    // Estas quatro relações usam ON DELETE SET NULL. Apagamos explicitamente para
    // que conteúdo pessoal não sobreviva apenas anonimizado após a remoção do Auth.
    for (const table of ['ai_generation_logs', 'analytics_events', 'comments', 'questionnaire_responses']) {
      const { error } = await admin.from(table).delete().eq('user_id', user.id)
      if (error) throw new Error(`${table}: ${error.message}`)
    }

    // O upload de usuário conhecido é o avatar, armazenado em avatars/<user_id>/...
    // Supabase exige remover objetos Storage antes de excluir um usuário proprietário.
    for (let offset = 0; ; offset += 1000) {
      const { data: files, error: listError } = await admin.storage
        .from('avatars')
        .list(user.id, { limit: 1000, offset })
      if (listError) throw new Error(`avatars list: ${listError.message}`)
      if (!files?.length) break
      const paths = files
        .filter((file) => file.id !== null)
        .map((file) => `${user.id}/${file.name}`)
      if (paths.length) {
        const { error: removeError } = await admin.storage.from('avatars').remove(paths)
        if (removeError) throw new Error(`avatars remove: ${removeError.message}`)
      }
      if (files.length < 1000) break
    }

    // As demais tabelas pessoais possuem FK ON DELETE CASCADE para auth.users.
    // Hard delete remove a conta; refresh tokens deixam de poder gerar novas sessões.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false)
    if (deleteError) throw deleteError

    return json({ ok: true }, 200, headers)
  } catch (error) {
    console.error('delete-account cleanup:', (error as Error).message)
    return json({
      error: 'A cobrança foi interrompida, mas não foi possível concluir a exclusão dos dados. Entre em contato com o suporte para finalizarmos com segurança.',
    }, 500, headers)
  }
})
