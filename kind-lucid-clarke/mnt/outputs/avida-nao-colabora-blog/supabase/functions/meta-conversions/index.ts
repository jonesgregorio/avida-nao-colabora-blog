import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://avidanaocolabora.com',
  'https://www.avidanaocolabora.com',
  'https://avida-nao-colabora-blog.vercel.app',
])

function corsFor(req: Request) {
  const origin = req.headers.get('Origin')
  const allowed = origin && (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))
    ? origin
    : 'https://avidanaocolabora.com'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function json(body: unknown, cors: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function clean(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.trim().toLowerCase()))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, cors, 405)

  const pixelId = clean(Deno.env.get('META_PIXEL_ID'), 64)
  const accessToken = clean(Deno.env.get('META_CONVERSIONS_API_TOKEN'), 512)
  if (!pixelId || !accessToken) return json({ ok: false, configured: false }, cors, 503)

  const authorization = req.headers.get('Authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Não autorizado.' }, cors, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user || !user.email_confirmed_at || !user.email) return json({ error: 'Cadastro não confirmado.' }, cors, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Solicitação inválida.' }, cors, 400) }

  const expectedEventId = `registration:${user.id}`
  if (clean(body.event_id, 120) !== expectedEventId) return json({ error: 'Evento inválido.' }, cors, 400)

  const userData: Record<string, unknown> = {
    em: [await sha256(user.email)],
    external_id: [await sha256(user.id)],
    client_user_agent: clean(req.headers.get('User-Agent'), 500),
  }
  const fbp = clean(body.fbp, 300)
  const fbc = clean(body.fbc, 300)
  if (fbp) userData.fbp = fbp
  if (fbc) userData.fbc = fbc

  const payload: Record<string, unknown> = {
    data: [{
      event_name: 'CompleteRegistration',
      event_time: Math.floor(Date.now() / 1000),
      event_id: expectedEventId,
      action_source: 'website',
      event_source_url: clean(body.event_source_url, 500) || 'https://avidanaocolabora.com/login',
      user_data: userData,
      custom_data: { content_name: 'Cadastro confirmado', status: true },
    }],
  }
  const testEventCode = clean(Deno.env.get('META_TEST_EVENT_CODE'), 80)
  if (testEventCode) payload.test_event_code = testEventCode

  const response = await fetch(`https://graph.facebook.com/v24.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({})) as { events_received?: number; error?: { message?: string } }
  if (!response.ok) {
    console.error('[meta-conversions]', response.status, result.error?.message || 'unknown_error')
    return json({ ok: false }, cors, 502)
  }

  return json({ ok: true, events_received: result.events_received ?? 0 }, cors)
})
