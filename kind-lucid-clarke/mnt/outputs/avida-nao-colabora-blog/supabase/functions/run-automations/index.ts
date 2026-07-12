import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Executor de automações de conteúdo (chamado por pg_cron via pg_net) ─────
// Autenticado pelo SERVICE ROLE (só o banco/vault tem). Para cada automação de
// geração ATIVA e vencida (pela frequência), gera 1 rascunho com IA e registra
// no calendário editorial. Se o modo for 'auto_publish', publica direto.
// Nada aqui usa JWT de usuário — é um job de servidor.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}
const FREQ_DAYS: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }
const GEN_TYPES = ['generate_daily', 'generate_weekly_package', 'generate_pauta', 'monthly_pauta']

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 72)
}

async function genAI(prompt: string): Promise<string> {
  // Pollinations (sem chave) primeiro; Gemini como fallback.
  try {
    const r = await fetch('https://text.pollinations.ai/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: 'openai', seed: Math.floor(Math.random() * 99999) }),
    })
    if (r.ok) { const t = (await r.text()).trim(); if (t) return t }
  } catch { /* tenta gemini */ }
  const key = Deno.env.get('GEMINI_API_KEY')
  if (key) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })
    if (r.ok) { const d = await r.json(); const t = d?.candidates?.[0]?.content?.parts?.[0]?.text; if (t?.trim()) return String(t).trim() }
  }
  throw new Error('Nenhum provedor de IA respondeu')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)

  // Token interno auto-gerado no banco (migration 070), lido via RPC — os dois
  // lados (cron e função) pegam o MESMO valor, então batem sozinhos, sem o admin
  // configurar nada. Também aceita CRON_SECRET ou o service role, como alternativas.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  let internalToken: string | null = null
  try {
    const { data } = await admin.rpc('get_automation_token')
    if (typeof data === 'string') internalToken = data
  } catch { /* RPC ainda não migrou */ }
  const allowed = [internalToken, Deno.env.get('CRON_SECRET'), serviceKey].filter(Boolean) as string[]
  if (!allowed.includes(token)) return json({ error: 'Não autorizado' }, 401)

  const { data: autos, error } = await admin.from('content_automations')
    .select('*').eq('status', 'active').in('type', GEN_TYPES)
  if (error) return json({ error: error.message }, 500)

  const now = Date.now()
  const results: { id: string; result: string }[] = []

  for (const a of autos ?? []) {
    const days = FREQ_DAYS[a.frequency] ?? 7
    const last = a.last_run_at ? new Date(a.last_run_at).getTime() : 0
    if (last && now - last < days * 86400000) continue // ainda não venceu

    try {
      const cfg = (a.config ?? {}) as { themes?: string[] }
      const themes = Array.isArray(cfg.themes) && cfg.themes.length ? cfg.themes : [a.category || 'saúde emocional']
      const tema = themes[Math.floor(Math.random() * themes.length)]
      const tipo = 'article'
      const prompt = `Escreva um conteúdo de blog acolhedor sobre "${tema}" para um app de saúde emocional. Português brasileiro, sem diagnóstico nem promessa de cura. Inclua uma pergunta para o diário e um CTA gentil ao final.`
      const content = await genAI(prompt)
      const publish = a.mode === 'auto_publish'
      const nowIso = new Date().toISOString()

      const { data: art, error: insErr } = await admin.from('articles').insert({
        title: tema, slug: `${slugify(tema)}-${Date.now().toString(36).slice(-4)}`,
        content, summary: '', excerpt: '', category: a.category || null,
        plan_required: a.plan_required || 'free', content_type: tipo, origin: 'ia',
        status: publish ? 'published' : 'draft',
        published_at: publish ? nowIso : null, updated_at: nowIso,
      }).select('id').single()
      if (insErr) throw insErr

      admin.from('editorial_calendar').insert({
        article_id: (art as { id?: string } | null)?.id ?? null, title: tema,
        content_type: tipo, plan_required: a.plan_required || 'free',
        status: publish ? 'publicado' : 'gerado_ia', origin: 'ia',
        scheduled_date: nowIso.slice(0, 10),
      }).then(() => {}, () => {})

      await admin.from('content_automations').update({
        last_run_at: nowIso, next_run_at: new Date(now + days * 86400000).toISOString(),
        last_result: `${publish ? 'Publicado' : 'Rascunho'}: ${tema}`, last_error: null,
      }).eq('id', a.id)
      results.push({ id: a.id, result: `ok: ${tema}` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await admin.from('content_automations').update({ last_run_at: new Date().toISOString(), last_error: msg }).eq('id', a.id)
      results.push({ id: a.id, result: 'erro: ' + msg })
    }
  }

  return json({ ran: results.length, results })
})
