import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Config ───────────────────────────────────────────────────────────────────
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Templates que um usuário comum pode disparar para o PRÓPRIO e-mail
const SELF_SERVICE = new Set(['welcome', 'email_confirmation', 'session_requested'])

// Categorias sensíveis recebem o rodapé de responsabilidade
const SENSITIVE_CATEGORIES = new Set(['clinical'])

const DISCLAIMER =
  'O A Vida Não Colabora é uma ferramenta de apoio ao autoconhecimento e à organização emocional. Ele não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'

interface Payload {
  user_id?: string
  to_email: string
  template_key: string
  variables?: Record<string, unknown>
  related_entity_type?: string
  related_entity_id?: string
  idempotency_key?: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Substitui {{chave}} pelas variáveis; desconhecidas viram string vazia
function render(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = vars[key]
    return v === undefined || v === null ? '' : String(v)
  })
}

// Monta o HTML de marca a partir do texto (quando o template não tem body_html próprio)
function buildHtml(subject: string, bodyText: string, category: string | null): string {
  const paragraphs = bodyText.split('\n\n').map(block => {
    const safe = escapeHtml(block)
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#2f4232;">$1</strong>') // **destaque** → negrito na cor da marca
      .replace(/\n/g, '<br>')
    return `<p style="margin:0 0 18px;">${safe}</p>`
  }).join('')

  const disclaimer = category && SENSITIVE_CATEGORIES.has(category)
    ? `<p style="margin:16px 0 0;color:#a8a29e;font-size:12px;line-height:1.6;font-style:italic;">${escapeHtml(DISCLAIMER)}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#2f4232;padding:28px 40px;">
      <p style="margin:0;color:#a9c0a9;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">A Vida Não Colabora</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:400;line-height:1.4;">${escapeHtml(subject)}</h1>
    </div>
    <div style="padding:36px 40px;color:#44403c;font-size:16px;line-height:1.75;">
      ${paragraphs}
    </div>
    <div style="background:#fafaf9;padding:22px 40px;border-top:1px solid #e7e5e4;">
      <p style="margin:0;color:#a8a29e;font-size:12px;font-family:Arial,sans-serif;line-height:1.6;">
        Você recebeu este e-mail porque é usuário de <strong>A Vida Não Colabora</strong>. O conteúdo completo fica dentro da sua conta.
      </p>
      ${disclaimer}
    </div>
  </div>
</body></html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || Deno.env.get('EMAIL_API_KEY')
  const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'contato@avidanaocolabora.com'
  const EMAIL_FROM_NAME = Deno.env.get('EMAIL_FROM_NAME') || 'A Vida Não Colabora'

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // ── Autenticação: service role (server) | admin | self-service ──────────────
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }
  if (!payload?.to_email || !payload?.template_key) {
    return json({ error: 'to_email e template_key são obrigatórios' }, 400)
  }

  const isService = token && token === SERVICE_KEY
  if (!isService) {
    // Precisa ser um JWT de usuário válido
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return json({ error: 'Não autorizado' }, 401)

    const { data: profile } = await admin
      .from('profiles')
      .select('role, email')
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'
    const isSelf = SELF_SERVICE.has(payload.template_key) &&
      payload.to_email.toLowerCase() === (user.email ?? '').toLowerCase()

    if (!isAdmin && !isSelf) return json({ error: 'Sem permissão para este envio' }, 403)
  }

  // ── Idempotência: insere log 'pending' primeiro (índice único protege) ──────
  const insertRow: Record<string, unknown> = {
    user_id: payload.user_id ?? null,
    email: payload.to_email,          // coluna legada NOT NULL
    to_email: payload.to_email,
    template_key: payload.template_key,
    status: 'pending',
    provider: 'resend',
    related_entity_type: payload.related_entity_type ?? null,
    related_entity_id: payload.related_entity_id ?? null,
    idempotency_key: payload.idempotency_key ?? null,
    metadata: { variables: payload.variables ?? {} },
  }

  const { data: logRow, error: insertErr } = await admin
    .from('email_logs')
    .insert(insertRow)
    .select('id')
    .single()

  if (insertErr) {
    // Violação do índice único = já enviado/enfileirado com esta idempotency_key
    if (String(insertErr.code) === '23505' || /duplicate|unique/i.test(insertErr.message)) {
      return json({ skipped: true, reason: 'idempotent_duplicate' })
    }
    return json({ error: 'Falha ao registrar log: ' + insertErr.message }, 500)
  }
  const logId = logRow.id

  // ── Busca template ativo ────────────────────────────────────────────────────
  const { data: tpl } = await admin
    .from('email_templates')
    .select('subject, body_text, body_html, category, is_active')
    .eq('template_key', payload.template_key)
    .maybeSingle()

  if (!tpl || tpl.is_active === false) {
    await admin.from('email_logs').update({
      status: 'failed', error: 'Template inexistente ou inativo', error_message: 'Template inexistente ou inativo', updated_at: new Date().toISOString(),
    }).eq('id', logId)
    return json({ error: 'Template inexistente ou inativo', log_id: logId }, 200)
  }

  const vars = (payload.variables ?? {}) as Record<string, unknown>
  const subject = render(tpl.subject, vars)
  const bodyText = render(tpl.body_text, vars)
  const bodyHtml = tpl.body_html && String(tpl.body_html).trim()
    ? render(tpl.body_html, vars)
    : buildHtml(subject, bodyText, tpl.category)

  // ── Provider ────────────────────────────────────────────────────────────────
  if (!RESEND_API_KEY) {
    await admin.from('email_logs').update({
      status: 'failed', error: 'RESEND_API_KEY/EMAIL_API_KEY não configurada', error_message: 'Provider não configurado', subject, updated_at: new Date().toISOString(),
    }).eq('id', logId)
    // Não quebra o fluxo do chamador
    return json({ error: 'Provider não configurado', log_id: logId }, 200)
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
        to: [payload.to_email],
        subject,
        html: bodyHtml,
        text: bodyText,
      }),
    })
    const result = await res.json().catch(() => ({}))

    if (!res.ok) {
      const msg = (result?.message || result?.error || `HTTP ${res.status}`) as string
      await admin.from('email_logs').update({
        status: 'failed', subject, error: msg, error_message: msg, updated_at: new Date().toISOString(),
      }).eq('id', logId)
      return json({ error: msg, log_id: logId }, 200) // 200: não quebra o fluxo principal
    }

    await admin.from('email_logs').update({
      status: 'sent', subject, provider_message_id: result?.id ?? null, sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', logId)

    return json({ ok: true, log_id: logId, provider_message_id: result?.id ?? null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await admin.from('email_logs').update({
      status: 'failed', subject, error: msg, error_message: msg, updated_at: new Date().toISOString(),
    }).eq('id', logId)
    return json({ error: msg, log_id: logId }, 200)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
