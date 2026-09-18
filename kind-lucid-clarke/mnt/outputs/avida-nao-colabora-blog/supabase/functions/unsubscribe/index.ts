import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Descadastro em 1 clique (público, sem login) ────────────────────────────
// GET  /unsubscribe?u=<user_id>&t=<hmac>       → conta de usuário: valida o
//   token e desliga user_notification_preferences.email_enabled (e-mails de
//   acompanhamento; transacionais de pagamento/segurança continuam). Mostra
//   uma página HTML própria.
// GET  /unsubscribe?n=<email>&t=<hmac>         → newsletter do rodapé (sem
//   conta): valida o token, marca newsletter_subscribers.status='unsubscribed'
//   e REDIRECIONA (302) para /newsletter-cancelada no próprio site.
// POST (List-Unsubscribe-Post, RFC 8058)  → Gmail/Yahoo chamam para o "cancelar"
//   nativo em 1 clique; responde 200 sem página.
// Token = HMAC-SHA256(valor) — sem estado; recomputamos e comparamos.
//
// Por que o modo newsletter redireciona em vez de mostrar HTML aqui: achado ao
// vivo — o gateway do Supabase força Content-Type: text/plain + CSP "sandbox"
// nas respostas de Edge Function que não têm usuário autenticado (mesmo
// quando a função pede text/html explicitamente), deixando a página HTML
// crua e com o texto corrompido (tipo "IncriÃ§Ã£o") no navegador. O modo
// newsletter é sempre anônimo (sem conta), então cai nesse caso; redirecionar
// para uma página do próprio site evita o problema por completo. O modo de
// conta (`u=`) mantém a página aqui mesmo — não houve relato de o mesmo
// problema acontecer nesse fluxo.

const SITE = Deno.env.get('SITE_URL') || 'https://avidanaocolabora.com'

async function unsubToken(value: string): Promise<string> {
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

function page(title: string, msg: string, ok: boolean): Response {
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f5f5f0;font-family:Georgia,serif;color:#44403c;">
  <div style="max-width:520px;margin:60px auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.08);text-align:center;">
    <p style="margin:0 0 6px;color:#a9c0a9;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">A Vida Não Colabora</p>
    <h1 style="font-size:22px;font-weight:400;color:#2f4232;margin:0 0 14px;">${title}</h1>
    <p style="font-size:16px;line-height:1.7;margin:0 0 22px;">${msg}</p>
    <a href="${SITE}/perfil" style="display:inline-block;background:#2f4232;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:14px;">Gerenciar minhas preferências</a>
  </div>
</body></html>`
  return new Response(html, { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

async function doUnsubscribeUser(userId: string, token: string): Promise<boolean> {
  if (!token) return false
  const expected = await unsubToken(userId)
  if (!safeEqual(token, expected)) return false
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await admin.from('user_notification_preferences').upsert(
    { user_id: userId, email_enabled: false, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  return !error
}

async function doUnsubscribeNewsletter(email: string, token: string): Promise<boolean> {
  if (!token || !email) return false
  const normalized = email.toLowerCase()
  const expected = await unsubToken(normalized)
  if (!safeEqual(token, expected)) return false
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await admin.from('newsletter_subscribers').update({
    status: 'unsubscribed', unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('email', normalized)
  return !error
}

function redirectToNewsletterPage(ok: boolean): Response {
  return new Response(null, { status: 302, headers: { Location: `${SITE}/newsletter-cancelada?ok=${ok ? '1' : '0'}` } })
}

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const userId = url.searchParams.get('u') || ''
  const newsletterEmail = url.searchParams.get('n') || ''
  const token = url.searchParams.get('t') || ''
  const isNewsletter = !!newsletterEmail

  if (!token || (!userId && !newsletterEmail)) {
    if (req.method === 'POST') return new Response('bad request', { status: 400, headers: cors })
    if (isNewsletter) return redirectToNewsletterPage(false)
    return page('Link inválido', 'Este link de cancelamento parece incompleto. Você pode ajustar seus e-mails diretamente no seu perfil.', false)
  }

  const ok = isNewsletter ? await doUnsubscribeNewsletter(newsletterEmail, token) : await doUnsubscribeUser(userId, token)

  // One-click (RFC 8058): Gmail/Yahoo mandam POST — responde 200 sem página.
  if (req.method === 'POST') {
    return new Response(ok ? 'unsubscribed' : 'invalid', { status: ok ? 200 : 400, headers: cors })
  }

  // Clique no link (GET):
  if (isNewsletter) return redirectToNewsletterPage(ok)
  if (!ok) return page('Não foi possível cancelar', 'O link pode ser inválido. Você pode desativar os e-mails diretamente no seu perfil.', false)
  return page('Cancelamento confirmado', 'Pronto: você não receberá mais os e-mails de acompanhamento. E-mails essenciais (pagamento e segurança) continuam. Mudou de ideia? É só reativar nas preferências.', true)
})
