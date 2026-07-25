import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Webhook do Resend → status REAL de entrega em email_logs ────────────────
// Eventos: email.delivered / opened / clicked / bounced / complained / sent.
// Casa por data.email_id == email_logs.provider_message_id.
// Assinatura Svix verificada quando RESEND_WEBHOOK_SECRET está setada (whsec_...);
// se ainda não estiver, processa mesmo assim (só ATUALIZA linhas já existentes).

function b64decode(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

// Verificação de assinatura Svix (padrão do Resend). true = válida ou sem secret.
async function verifySignature(req: Request, body: string): Promise<boolean> {
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!secret) return true // ainda não configurado — não bloqueia (só atualiza linhas existentes)
  const id = req.headers.get('svix-id') || req.headers.get('webhook-id')
  const ts = req.headers.get('svix-timestamp') || req.headers.get('webhook-timestamp')
  const sigHeader = req.headers.get('svix-signature') || req.headers.get('webhook-signature')
  if (!id || !ts || !sigHeader) return false
  try {
    const keyBytes = b64decode(secret.replace(/^whsec_/, ''))
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`))
    const expected = b64encode(sig)
    return sigHeader.split(' ').some(p => { const s = p.split(',')[1] ?? p; return safeEqual(s, expected) })
  } catch { return false }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const body = await req.text()
  if (!(await verifySignature(req, body))) {
    return new Response('invalid signature', { status: 401 })
  }

  let event: { type?: string; data?: { email_id?: string; bounce?: { message?: string }; reason?: string } }
  try { event = JSON.parse(body) } catch { return new Response('bad json', { status: 400 }) }

  const type = event.type || ''
  const emailId = event.data?.email_id
  if (!emailId) return new Response(JSON.stringify({ received: true, ignored: 'no email_id' }), { headers: { 'Content-Type': 'application/json' } })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { updated_at: now }

  switch (type) {
    case 'email.delivered':       patch.delivered_at = now; break
    case 'email.opened':          patch.opened_at = now; break
    case 'email.clicked':         patch.clicked_at = now; break
    case 'email.bounced':
      patch.status = 'bounced'; patch.bounced_at = now
      patch.error_message = event.data?.bounce?.message || event.data?.reason || 'Bounce'
      break
    case 'email.complained':      patch.status = 'complained'; break
    case 'email.delivery_delayed': /* mantém como está */ break
    default: /* email.sent e outros — ignora */ break
  }

  if (Object.keys(patch).length <= 1) {
    return new Response(JSON.stringify({ received: true, type }), { headers: { 'Content-Type': 'application/json' } })
  }

  const { error } = await admin.from('email_logs').update(patch).eq('provider_message_id', emailId)
  if (error) console.error('resend-webhook update:', error.message)

  return new Response(JSON.stringify({ received: true, type, updated: !error }), { headers: { 'Content-Type': 'application/json' } })
})
