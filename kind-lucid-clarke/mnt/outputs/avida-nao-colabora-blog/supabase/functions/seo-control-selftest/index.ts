import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdminAal2 } from '../_shared/adminAuth.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string }
type Check = { key: string; label: string; ok: boolean; detail: string; duration_ms: number }

const encoder = new TextEncoder()
const b64url = (input: string | Uint8Array) => {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
function privateKeyFromPem(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const binary = atob(body)
  return Uint8Array.from(binary, char => char.charCodeAt(0)).buffer
}
async function accessToken(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: account.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const key = await crypto.subtle.importKey('pkcs8', privateKeyFromPem(account.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(`${header}.${payload}`)))
  const response = await fetch(account.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${payload}.${b64url(signature)}` }),
  })
  if (!response.ok) throw new Error(`OAuth respondeu ${response.status}`)
  const data = await response.json() as { access_token?: string }
  if (!data.access_token) throw new Error('Token ausente')
  return data.access_token
}
async function authorize(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const { data } = await admin.rpc('get_automation_token')
  if (token && typeof data === 'string' && token === data) return { ok: true as const, internal: true }
  const result = await requireAdminAal2(req)
  return result.ok ? { ok: true as const, internal: false } : { ok: false as const, status: result.status, error: result.error }
}
async function runCheck(key: string, label: string, fn: () => Promise<string>): Promise<Check> {
  const started = Date.now()
  try { return { key, label, ok: true, detail: await fn(), duration_ms: Date.now() - started } }
  catch (error) { return { key, label, ok: false, detail: error instanceof Error ? error.message : String(error), duration_ms: Date.now() - started } }
}
async function aiConnectivity() {
  const { data } = await admin.from('ai_settings').select('active_provider').eq('id', 1).maybeSingle()
  const configured = String(data?.active_provider || '').toLowerCase()
  const candidates = [configured, 'gemini', 'groq', 'openai'].filter((v, i, a) => v && a.indexOf(v) === i)
  for (const provider of candidates) {
    if (provider === 'gemini' && Deno.env.get('GEMINI_API_KEY')) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(Deno.env.get('GEMINI_API_KEY')!)}`)
      if (!res.ok) throw new Error(`Gemini respondeu ${res.status}`)
      return 'Gemini configurado e alcançável'
    }
    if (provider === 'groq' && Deno.env.get('GROQ_API_KEY')) {
      const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${Deno.env.get('GROQ_API_KEY')}` } })
      if (!res.ok) throw new Error(`Groq respondeu ${res.status}`)
      return 'Groq configurado e alcançável'
    }
    if (provider === 'openai' && Deno.env.get('OPENAI_API_KEY')) {
      const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` } })
      if (!res.ok) throw new Error(`OpenAI respondeu ${res.status}`)
      return 'OpenAI configurado e alcançável'
    }
  }
  throw new Error('Nenhum provedor de IA com chave disponível')
}

async function execute(source: 'manual' | 'scheduled') {
  const raw = (Deno.env.get('GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON') || '').trim()
  const siteUrl = (Deno.env.get('GOOGLE_SEARCH_CONSOLE_SITE_URL') || 'sc-domain:avidanaocolabora.com').trim()
  let account: ServiceAccount | null = null
  try { account = raw ? JSON.parse(raw) as ServiceAccount : null } catch { account = null }
  let token = ''

  const checks: Check[] = []
  checks.push(await runCheck('google_credentials', 'Credenciais do Google', async () => {
    if (!account?.client_email || !account.private_key) throw new Error('Credencial ausente ou inválida')
    return `${siteUrl} · conta de serviço válida`
  }))
  checks.push(await runCheck('google_oauth', 'Autenticação OAuth', async () => {
    if (!account) throw new Error('Sem credencial')
    token = await accessToken(account)
    return 'Google emitiu token de acesso'
  }))
  checks.push(await runCheck('search_analytics', 'Search Analytics API', async () => {
    if (!token) throw new Error('OAuth indisponível')
    const end = new Date(); end.setUTCDate(end.getUTCDate() - 1)
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6)
    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ startDate: start.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10), dimensions: ['date'], rowLimit: 1, type: 'web', dataState: 'final' }) })
    if (!res.ok) throw new Error(`Search Analytics respondeu ${res.status}`)
    return 'Consulta de desempenho respondida'
  }))
  checks.push(await runCheck('sitemaps_api', 'Sitemaps API', async () => {
    if (!token) throw new Error('OAuth indisponível')
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Sitemaps API respondeu ${res.status}`)
    const data = await res.json() as { sitemap?: unknown[] }
    return `${data.sitemap?.length || 0} sitemap(s) retornado(s)`
  }))
  checks.push(await runCheck('url_inspection', 'URL Inspection API', async () => {
    if (!token) throw new Error('OAuth indisponível')
    const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ inspectionUrl: 'https://www.avidanaocolabora.com/', siteUrl, languageCode: 'pt-BR' }) })
    if (!res.ok) throw new Error(`URL Inspection respondeu ${res.status}`)
    return 'Página inicial inspecionada sem alteração'
  }))
  checks.push(await runCheck('public_sitemap', 'Sitemap público', async () => {
    const res = await fetch('https://www.avidanaocolabora.com/sitemap.xml')
    const text = await res.text()
    if (!res.ok || !/<urlset|<sitemapindex/i.test(text)) throw new Error(`sitemap.xml inválido (${res.status})`)
    return 'sitemap.xml acessível e em XML'
  }))
  checks.push(await runCheck('robots', 'robots.txt', async () => {
    const res = await fetch('https://www.avidanaocolabora.com/robots.txt')
    const text = await res.text()
    if (!res.ok || !/sitemap:\s*https:\/\/www\.avidanaocolabora\.com\/sitemap\.xml/i.test(text)) throw new Error(`robots.txt não anuncia o sitemap (${res.status})`)
    return 'robots.txt acessível e aponta para o sitemap'
  }))
  checks.push(await runCheck('seo_database', 'Persistência do SEO', async () => {
    for (const table of ['seo_sync_runs','seo_search_performance_daily','seo_url_inspections','seo_sitemaps','seo_alerts']) {
      const { error } = await admin.from(table).select('*', { head: true, count: 'exact' }).limit(1)
      if (error) throw new Error(`${table}: ${error.message}`)
    }
    return 'Tabelas server-only acessíveis pelo serviço'
  }))
  checks.push(await runCheck('ai_provider', 'Provedor de IA', aiConnectivity))
  checks.push(await runCheck('corrector_schema', 'Adaptadores do corretor', async () => {
    const { error } = await admin.from('articles').select('id,title,slug,seo_title,seo_description,keyword,content,image_url,cover_image,cover_image_url,image_alt,author,related_slugs,reviewed_at,review_notes,updated_at').limit(1)
    if (error) throw error
    return 'Metadados, imagem, conteúdo, autoria, links e revisão disponíveis'
  }))
  checks.push(await runCheck('redirect_contract', 'Redirecionamento seguro', async () => {
    const { error } = await admin.rpc('get_public_redirect', { p_path: '/blog/__seo_selftest_inexistente__' })
    if (error) throw error
    return 'RPC de redirect 301 disponível sem criar dados'
  }))
  checks.push(await runCheck('automation', 'Automação diária', async () => {
    const { data, error } = await admin.rpc('seo_self_test_runtime_snapshot')
    if (error) throw error
    const row = (data || {}) as Record<string, unknown>
    if (!row.cron_active) throw new Error('Cron principal inativo')
    if (!String(row.cron_command || '').includes('timeout_milliseconds := 120000')) throw new Error('Cron principal sem timeout seguro de 120 s')
    if (row.latest_sync_status !== 'succeeded') throw new Error(`Última sincronização: ${String(row.latest_sync_status || 'desconhecida')}`)
    return 'Cron ativo, timeout seguro e última sincronização concluída'
  }))

  const passed = checks.filter(item => item.ok).length
  const status = passed === checks.length ? 'passed' : passed >= 10 ? 'warning' : 'failed'
  const { data: run, error } = await admin.from('seo_self_test_runs').insert({ source, status, passed, total: checks.length, checks }).select('id,created_at').single()
  if (error) throw error
  return { id: run.id, created_at: run.created_at, source, status, passed, total: checks.length, checks }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const auth = await authorize(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)
  const body = await req.json().catch(() => ({})) as { source?: string; history?: boolean }
  try {
    if (body.history && !auth.internal) {
      const { data, error } = await admin.from('seo_self_test_runs').select('id,source,status,passed,total,checks,created_at').order('created_at', { ascending: false }).limit(10)
      if (error) throw error
      return json({ history: data || [] })
    }
    const result = await execute(auth.internal || body.source === 'scheduled' ? 'scheduled' : 'manual')
    return json({ ok: result.status === 'passed', result })
  } catch (error) {
    console.error('seo-control-selftest:', error instanceof Error ? error.message : String(error))
    return json({ error: error instanceof Error ? error.message : 'Falha no autoteste de SEO.' }, 502)
  }
})
