import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Inscrição na newsletter do rodapé (pública, sem login) ─────────────────
// Recebe { email, website (honeypot) }, grava em newsletter_subscribers via
// service_role e dispara o e-mail de confirmação (template newsletter_confirmation)
// através de send-transactional-email, reaproveitando o envio/Resend/log que já
// existe ali em vez de duplicar a chamada à API do Resend aqui.
//
// Mesmo padrão de segurança de submit-contact-ticket: endpoint público
// controlado, nunca delega escrita direta ao visitante, rate limit por IP e
// honeypot silencioso (finge sucesso, não ensina bots a contornar).

const ALLOWED_ORIGINS = new Set([
  'https://avidanaocolabora.com',
  'https://www.avidanaocolabora.com',
  'https://avida-nao-colabora-blog.vercel.app',
])
const MAX_ATTEMPTS = 5

function corsFor(req: Request) {
  const origin = req.headers.get('Origin')
  const allowed = origin && (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))
    ? origin
    : (Deno.env.get('SITE_URL') || 'https://avidanaocolabora.com')
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(body: unknown, cors: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

async function rateKey(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `newsletter:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

// Mesmo esquema de token do /unsubscribe: HMAC-SHA256 do valor (aqui, o e-mail
// em minúsculas), sem estado — /unsubscribe recomputa e compara.
async function unsubToken(value: string): Promise<string> {
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, cors, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Solicitação inválida.' }, cors, 400)
  }

  // Honeypot: finge sucesso sem gravar nada, para não ensinar bots a contornar.
  if (typeof body.website === 'string' && body.website.trim()) return json({ ok: true }, cors)

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Informe um e-mail válido.' }, cors, 400)
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  const forwarded = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || ''
  const clientIp = forwarded.split(',')[0].trim()
  const { data: allowed, error: rateError } = await admin.rpc('consume_newsletter_rate_limit', {
    p_rate_key: await rateKey(clientIp || email), p_max_attempts: MAX_ATTEMPTS,
  })
  if (rateError) {
    console.error('newsletter rate limit:', rateError.message)
    return json({ error: 'Não foi possível inscrever agora. Tente novamente em instantes.' }, cors, 503)
  }
  if (!allowed) {
    return json({ error: 'Muitas tentativas em pouco tempo. Aguarde 15 minutos para tentar novamente.' }, cors, 429)
  }

  const { data: existing } = await admin
    .from('newsletter_subscribers')
    .select('status')
    .eq('email', email)
    .maybeSingle()

  const alreadySubscribed = existing?.status === 'subscribed'

  const { error: upsertError } = await admin.from('newsletter_subscribers').upsert({
    email,
    status: 'subscribed',
    source: 'footer',
    subscribed_at: new Date().toISOString(),
    unsubscribed_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email' })

  if (upsertError) {
    console.error('newsletter subscribe:', upsertError.message)
    return json({ error: 'Não foi possível inscrever agora. Tente novamente em instantes.' }, cors, 503)
  }

  // Já estava inscrito — não reenvia confirmação a cada novo clique no mesmo e-mail.
  if (alreadySubscribed) return json({ ok: true, already_subscribed: true }, cors, 200)

  const unsubUrl = `${SUPABASE_URL}/functions/v1/unsubscribe?n=${encodeURIComponent(email)}&t=${await unsubToken(email)}`

  try {
    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_email: email,
        template_key: 'newsletter_confirmation',
        variables: { link_cancelar: unsubUrl },
        idempotency_key: `newsletter_confirmation:${email}:${new Date().toISOString().slice(0, 10)}`,
      }),
    })
    if (sendRes.ok) {
      await admin.from('newsletter_subscribers').update({ confirmation_sent_at: new Date().toISOString() }).eq('email', email)
    } else {
      console.error('newsletter confirmation email:', sendRes.status, await sendRes.text().catch(() => ''))
    }
  } catch (e) {
    // A inscrição já foi gravada — uma falha no envio do e-mail não deve derrubar o cadastro.
    console.error('newsletter confirmation email:', e instanceof Error ? e.message : String(e))
  }

  return json({ ok: true }, cors, 201)
})
