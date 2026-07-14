import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Proxy seguro de IA (server-side) ────────────────────────────────────────
// As chaves de IA (GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY) ficam SOMENTE
// aqui, no servidor — nunca no bundle do frontend. Só admin autenticado chama.
// Ordem de failover: gemini → groq → openai (gpt-4o-mini).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TIMEOUT_MS = 35_000
const GEMINI_MODEL = 'gemini-2.0-flash'
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const OPENAI_MODEL = 'gpt-4o-mini'

type Provider = 'gemini' | 'groq' | 'openai'
const ORDER: Provider[] = ['gemini', 'groq', 'openai']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function withTimeout(url: string, init: RequestInit): Promise<Response> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), TIMEOUT_MS)
  try { return await fetch(url, { ...init, signal: c.signal }) }
  finally { clearTimeout(t) }
}

async function callOpenAI(prompt: string): Promise<string> {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) throw new Error('OpenAI: OPENAI_API_KEY não configurada no servidor')
  const res = await withTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text || !String(text).trim()) throw new Error('OpenAI: resposta vazia')
  return String(text).trim()
}

async function callGemini(prompt: string): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new Error('Gemini: GEMINI_API_KEY não configurada no servidor')
  const res = await withTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) },
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text || !String(text).trim()) throw new Error('Gemini: resposta vazia')
  return String(text).trim()
}

async function callGroq(prompt: string): Promise<string> {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) throw new Error('Groq: GROQ_API_KEY não configurada no servidor')
  const res = await withTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text || !String(text).trim()) throw new Error('Groq: resposta vazia')
  return String(text).trim()
}

const FN: Record<Provider, (p: string) => Promise<string>> = {
  gemini: callGemini, groq: callGroq, openai: callOpenAI,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey)

  // ── Autenticação + verificação de admin ──
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Não autenticado' }, 401)
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'Sessão inválida' }, 401)
  const { data: profile } = await admin.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return json({ error: 'Acesso restrito a administradores' }, 403)

  // ── Briefing ──
  let body: { prompt?: string; provider?: Provider; test?: boolean; contentType?: string; tema?: string; tipo?: string; frequencia?: string }
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  // Compat: chamada legada { tema, tipo, frequencia }
  let prompt = body.prompt
  if (!prompt && body.tema) {
    prompt = `Você é um redator de saúde emocional. Crie um conteúdo do tipo "${body.tipo ?? 'dica'}" sobre "${body.tema}" (frequência: ${body.frequencia ?? 'diário'}). Português brasileiro, tom acolhedor, 150-250 palavras, sem markdown, termine encorajando. Retorne apenas o texto.`
  }
  if (!prompt || !prompt.trim()) return json({ error: 'prompt vazio' }, 400)

  const requested = body.provider && ORDER.includes(body.provider) ? body.provider : 'gemini'
  // Modo teste: só o provider pedido, sem failover.
  const chain: Provider[] = body.test ? [requested] : [requested, ...ORDER.filter(p => p !== requested)]

  const tried: string[] = []
  for (const p of chain) {
    try {
      const text = await FN[p](prompt)
      admin.from('ai_generation_logs').insert({
        admin_id: user.id, content_type: body.contentType ?? 'generic',
        prompt_preview: prompt.slice(0, 280), result_preview: text.slice(0, 280),
        provider: p, status: 'success',
      }).then(() => {}, () => {})
      return json({ text, content: text, provider: p })
    } catch (err) {
      tried.push(`${p}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const errorMsg = `Todas as IAs falharam. ${tried.join(' | ')}`
  admin.from('ai_generation_logs').insert({
    admin_id: user.id, content_type: body.contentType ?? 'generic',
    prompt_preview: prompt.slice(0, 280), provider: requested, status: 'error', error_msg: errorMsg.slice(0, 500),
  }).then(() => {}, () => {})
  return json({ error: errorMsg }, 502)
})
