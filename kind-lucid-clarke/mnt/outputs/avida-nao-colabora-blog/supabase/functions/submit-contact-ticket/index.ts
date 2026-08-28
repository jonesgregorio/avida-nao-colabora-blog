import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://avidanaocolabora.com',
  'https://www.avidanaocolabora.com',
  'https://avida-nao-colabora-blog.vercel.app',
])
const MAX_ATTEMPTS = 5
const MAX_FIELD_LENGTH = 4000

function corsFor(req: Request) {
  const origin = req.headers.get('Origin')
  const allowed = origin && (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))
    ? origin
    : (Deno.env.get('SITE_URL') || 'https://avidanaocolabora.com')
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function json(body: unknown, cors: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function text(value: unknown, max = MAX_FIELD_LENGTH): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function rateKey(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `contact:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) return true
  if (!token) return false
  const form = new FormData()
  form.set('secret', secret)
  form.set('response', token)
  if (ip) form.set('remoteip', ip)
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: form,
  })
  const result = await response.json() as { success?: boolean }
  return result.success === true
}

// Endpoint público controlado: aceita visitantes anônimos, mas nunca delega a
// eles a escrita direta na tabela. O service_role fica somente neste ambiente.
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

  // Honeypot: retorna sucesso sem criar ticket, para não ensinar bots a contorná-lo.
  if (text(body.website, 200)) return json({ ok: true }, cors)

  const description = text(body.description)
  const subject = text(body.subject, 180) || 'Contato via FAQ'
  const category = text(body.category, 120) || null
  const priority = ['low', 'medium', 'high'].includes(text(body.priority, 20)) ? text(body.priority, 20) : 'medium'
  const contactName = text(body.contact_name, 160)
  const contactEmail = text(body.contact_email, 254).toLowerCase()
  if (description.length < 10 || !subject) {
    return json({ error: 'Preencha uma mensagem com pelo menos 10 caracteres.' }, cors, 400)
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return json({ error: 'Informe um e-mail válido.' }, cors, 400)
  }

  const forwarded = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || ''
  const clientIp = forwarded.split(',')[0].trim()
  if (!await verifyTurnstile(text(body.turnstile_token, 4096), clientIp)) {
    return json({ error: 'Não foi possível validar a verificação de segurança. Tente novamente.' }, cors, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user && !contactName && !contactEmail) {
    return json({ error: 'Preencha seus dados de contato.' }, cors, 400)
  }

  const keyIdentity = user?.id || `${clientIp}:${contactEmail}`
  const { data: allowed, error: rateError } = await supabase.rpc('consume_contact_ticket_rate_limit', {
    p_rate_key: await rateKey(keyIdentity), p_max_attempts: MAX_ATTEMPTS,
  })
  if (rateError) {
    console.error('contact rate limit:', rateError.message)
    return json({ error: 'Não foi possível enviar agora. Tente novamente em instantes.' }, cors, 503)
  }
  if (!allowed) {
    return json({ error: 'Você enviou muitas mensagens em pouco tempo. Aguarde 15 minutos para tentar novamente.' }, cors, 429)
  }

  const { data: profile } = user
    ? await supabase.from('profiles').select('email,full_name,plan').eq('user_id', user.id).maybeSingle()
    : { data: null }
  const { data: insertedTicket, error: insertError } = await supabase.from('support_tickets').insert({
    user_id: user?.id ?? null,
    contact_email: user ? (profile?.email || user.email || contactEmail || null) : contactEmail,
    contact_name: user ? (profile?.full_name || contactName || null) : contactName,
    subject,
    description,
    priority,
    status: 'open',
    source: user ? 'contact_page' : 'faq',
    category,
    plan_at_creation: user ? (profile?.plan || 'free') : null,
    unread_for_admin: true,
  }).select('id').single()
  if (insertError || !insertedTicket) {
    console.error('contact ticket:', insertError?.message || 'missing inserted ticket')
    return json({ error: 'Não foi possível enviar agora. Tente novamente em instantes.' }, cors, 503)
  }
  return json({ ok: true, ticket_id: user ? insertedTicket.id : undefined }, cors, 201)
})
