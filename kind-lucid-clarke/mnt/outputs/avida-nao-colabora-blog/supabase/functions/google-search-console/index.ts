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
type SearchRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }
type Metric = { clicks: number; impressions: number; ctr: number; position: number }
type Alert = { code: string; severity: 'info' | 'warning' | 'critical'; title: string; details?: string; url?: string; dedupe_key: string }
type SearchType = 'web' | 'image' | 'video' | 'news' | 'discover' | 'googleNews'

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
async function googleAccessToken(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: account.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const key = await crypto.subtle.importKey('pkcs8', privateKeyFromPem(account.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(`${header}.${payload}`)))
  const response = await fetch(account.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${payload}.${b64url(signature)}` }),
  })
  if (!response.ok) throw new Error(`Google não autorizou a conta de serviço (${response.status}).`)
  const data = await response.json() as { access_token?: string }
  if (!data.access_token) throw new Error('O Google não retornou um token de acesso.')
  return data.access_token
}
function isoDay(offset: number) { const date = new Date(); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10) }
async function authorize(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  let internalToken: string | null = null
  try { const { data } = await admin.rpc('get_automation_token'); if (typeof data === 'string') internalToken = data } catch { /* admin AAL2 continua disponível */ }
  if (token && internalToken && token === internalToken) return { ok: true as const, internal: true }
  const result = await requireAdminAal2(req)
  return result.ok ? { ok: true as const, internal: false } : { ok: false as const, status: result.status, error: result.error }
}
function readConfig() {
  const raw = (Deno.env.get('GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON') || '').trim()
  const siteUrl = (Deno.env.get('GOOGLE_SEARCH_CONSOLE_SITE_URL') || 'sc-domain:avidanaocolabora.com').trim()
  if (!raw) return { configured: false as const, siteUrl }
  try { const account = JSON.parse(raw) as ServiceAccount; if (!account.client_email || !account.private_key) return { configured: false as const, siteUrl }; return { configured: true as const, siteUrl, account } } catch { return { configured: false as const, siteUrl } }
}

async function searchQuery(token: string, siteUrl: string, dimensions: string[], startDate: string, endDate: string, rowLimit = 5000, type: SearchType = 'web') {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const rows: SearchRow[] = []
  const pageSize = Math.min(25000, Math.max(1, rowLimit))
  let startRow = 0
  while (rows.length < rowLimit) {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, dimensions, rowLimit: Math.min(pageSize, rowLimit - rows.length), startRow, type, dataState: 'final' }),
    })
    if (!response.ok) { const detail = await response.text(); throw new Error(`Search Analytics (${type}) recusou a consulta (${response.status}). ${detail.slice(0, 220)}`) }
    const data = await response.json() as { rows?: SearchRow[] }
    const batch = data.rows || []
    rows.push(...batch)
    if (batch.length < Math.min(pageSize, rowLimit - startRow)) break
    startRow += batch.length
  }
  return { rows }
}
async function optionalSearchQuery(token: string, siteUrl: string, dimensions: string[], startDate: string, endDate: string, rowLimit: number, type: SearchType) {
  try { return await searchQuery(token, siteUrl, dimensions, startDate, endDate, rowLimit, type) }
  catch (error) { console.warn(`Search Analytics opcional (${type}) falhou:`, error instanceof Error ? error.message : String(error)); return { rows: [] as SearchRow[] } }
}
async function listSitemaps(token: string, siteUrl: string) {
  const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`Sitemaps API respondeu ${response.status}.`)
  return await response.json() as { sitemap?: Array<Record<string, unknown>> }
}
async function inspectUrl(token: string, siteUrl: string, url: string) {
  const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ inspectionUrl: url, siteUrl, languageCode: 'pt-BR' }) })
  if (!response.ok) { const detail = await response.text(); throw new Error(`URL Inspection respondeu ${response.status}: ${detail.slice(0, 180)}`) }
  return await response.json() as Record<string, unknown>
}
async function upsertChunks(table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) { const { error } = await admin.from(table).upsert(rows.slice(i, i + 500)); if (error) throw error }
}
async function publicUrlInventory() {
  const base = 'https://www.avidanaocolabora.com'
  const fixed = ['/', '/blog', '/guias', '/sobre', '/faq', '/contato', '/planos', '/politica-editorial'].map(path => `${base}${path === '/' ? '' : path}`)
  const { data } = await admin.from('articles').select('slug').eq('published', true).eq('plan_required', 'free').limit(2000)
  const articleUrls = (data || []).map((row: { slug?: string | null }) => row.slug ? `${base}/blog/${row.slug}` : '').filter(Boolean)
  return [...new Set([...fixed, ...articleUrls])]
}
function pushRows(target: Record<string, unknown>[], source: SearchRow[], dimension: string, key: (row: SearchRow) => string) {
  const now = new Date().toISOString()
  for (const row of source) target.push({ day: row.keys?.[0], dimension, dimension_key: key(row), clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: row.ctr || 0, position: row.position || 0, synced_at: now })
}

async function syncSearchConsole(source: 'manual' | 'scheduled') {
  const config = readConfig()
  if (!config.configured) throw new Error('Google Search Console ainda não está configurado no servidor.')
  const { data: run, error: runError } = await admin.from('seo_sync_runs').insert({ kind: source, status: 'running' }).select('id').single()
  if (runError) throw runError
  const runId = run.id as string
  let rowsWritten = 0
  try {
    const token = await googleAccessToken(config.account)
    const startDate = isoDay(-28), historyStart = isoDay(-365), endDate = isoDay(-1)
    const [totals, historicalTotals, queries, pages, queryPages, devices, countries, appearances, imageTotals, videoTotals, newsTotals, discoverTotals, googleNewsTotals, sitemapPayload] = await Promise.all([
      searchQuery(token, config.siteUrl, ['date'], startDate, endDate, 250),
      searchQuery(token, config.siteUrl, ['date'], historyStart, endDate, 400),
      searchQuery(token, config.siteUrl, ['date', 'query'], startDate, endDate, 25000),
      searchQuery(token, config.siteUrl, ['date', 'page'], startDate, endDate, 25000),
      searchQuery(token, config.siteUrl, ['date', 'query', 'page'], startDate, endDate, 25000),
      searchQuery(token, config.siteUrl, ['date', 'device'], startDate, endDate, 5000),
      searchQuery(token, config.siteUrl, ['date', 'country'], startDate, endDate, 10000),
      optionalSearchQuery(token, config.siteUrl, ['date', 'searchAppearance'], startDate, endDate, 10000, 'web'),
      optionalSearchQuery(token, config.siteUrl, ['date'], startDate, endDate, 250, 'image'),
      optionalSearchQuery(token, config.siteUrl, ['date'], startDate, endDate, 250, 'video'),
      optionalSearchQuery(token, config.siteUrl, ['date'], startDate, endDate, 250, 'news'),
      optionalSearchQuery(token, config.siteUrl, ['date'], startDate, endDate, 250, 'discover'),
      optionalSearchQuery(token, config.siteUrl, ['date'], startDate, endDate, 250, 'googleNews'),
      listSitemaps(token, config.siteUrl),
    ])

    const perfRows: Record<string, unknown>[] = []
    pushRows(perfRows, historicalTotals.rows || totals.rows || [], 'total', () => '__total__')
    pushRows(perfRows, queries.rows || [], 'query', row => row.keys?.[1] || '')
    pushRows(perfRows, pages.rows || [], 'page', row => row.keys?.[1] || '')
    pushRows(perfRows, queryPages.rows || [], 'query_page', row => `${row.keys?.[1] || ''}|||${row.keys?.[2] || ''}`)
    pushRows(perfRows, devices.rows || [], 'device', row => row.keys?.[1] || '')
    pushRows(perfRows, countries.rows || [], 'country', row => row.keys?.[1] || '')
    pushRows(perfRows, appearances.rows || [], 'search_appearance', row => row.keys?.[1] || '')
    pushRows(perfRows, imageTotals.rows || [], 'search_type', () => 'image')
    pushRows(perfRows, videoTotals.rows || [], 'search_type', () => 'video')
    pushRows(perfRows, newsTotals.rows || [], 'search_type', () => 'news')
    pushRows(perfRows, discoverTotals.rows || [], 'search_type', () => 'discover')
    pushRows(perfRows, googleNewsTotals.rows || [], 'search_type', () => 'googleNews')
    await upsertChunks('seo_search_performance_daily', perfRows.filter(row => row.day && row.dimension_key))
    rowsWritten += perfRows.length

    const sitemapRows = (sitemapPayload.sitemap || []).map(item => ({ path: String(item.path || ''), type: item.type ? String(item.type) : null, is_pending: Boolean(item.isPending), is_sitemaps_index: Boolean(item.isSitemapsIndex), last_submitted: item.lastSubmitted ? String(item.lastSubmitted) : null, last_downloaded: item.lastDownloaded ? String(item.lastDownloaded) : null, warnings: Number(item.warnings || 0), errors: Number(item.errors || 0), contents: Array.isArray(item.contents) ? item.contents : [], last_checked_at: new Date().toISOString() })).filter(row => row.path)
    if (sitemapRows.length) await upsertChunks('seo_sitemaps', sitemapRows)
    rowsWritten += sitemapRows.length

    const inventory = await publicUrlInventory()
    const { data: known } = await admin.from('seo_url_inspections').select('url,last_inspected_at').in('url', inventory)
    const checked = new Map((known || []).map((row: { url: string; last_inspected_at: string }) => [row.url, row.last_inspected_at]))
    const candidates = inventory.map(url => ({ url, checked: checked.get(url) || '1970-01-01T00:00:00Z' })).sort((a, b) => a.checked.localeCompare(b.checked)).slice(0, 10)
    const inspected = await Promise.all(candidates.map(async candidate => {
      try {
        const payload = await inspectUrl(token, config.siteUrl, candidate.url)
        const result = ((payload.inspectionResult as Record<string, unknown> | undefined)?.indexStatusResult || {}) as Record<string, unknown>
        return { url: candidate.url, verdict: result.verdict ? String(result.verdict) : null, coverage_state: result.coverageState ? String(result.coverageState) : null, robots_txt_state: result.robotsTxtState ? String(result.robotsTxtState) : null, indexing_state: result.indexingState ? String(result.indexingState) : null, page_fetch_state: result.pageFetchState ? String(result.pageFetchState) : null, google_canonical: result.googleCanonical ? String(result.googleCanonical) : null, user_canonical: result.userCanonical ? String(result.userCanonical) : null, crawled_as: result.crawledAs ? String(result.crawledAs) : null, last_crawl_time: result.lastCrawlTime ? String(result.lastCrawlTime) : null, referring_urls: Array.isArray(result.referringUrls) ? result.referringUrls : [], raw: result, last_inspected_at: new Date().toISOString() }
      } catch (error) { console.warn('URL Inspection falhou:', candidate.url, error instanceof Error ? error.message : String(error)); return null }
    }))
    const inspectionRows = inspected.filter(Boolean) as Record<string, unknown>[]
    if (inspectionRows.length) await upsertChunks('seo_url_inspections', inspectionRows)
    rowsWritten += inspectionRows.length

    await admin.from('seo_alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('status', 'open').in('code', ['sitemap_problem', 'index_problem', 'canonical_mismatch'])
    const alerts: Alert[] = []
    for (const sitemap of sitemapRows) if (sitemap.errors > 0 || sitemap.warnings > 0) alerts.push({ code: 'sitemap_problem', severity: sitemap.errors > 0 ? 'critical' : 'warning', title: 'Problema detectado no sitemap', details: `${sitemap.errors} erro(s) e ${sitemap.warnings} aviso(s).`, url: sitemap.path, dedupe_key: `sitemap:${sitemap.path}` })
    for (const row of inspectionRows) {
      const url = String(row.url)
      if (row.verdict && row.verdict !== 'PASS') alerts.push({ code: 'index_problem', severity: 'warning', title: 'URL pública sem aprovação de indexação', details: String(row.coverage_state || row.verdict), url, dedupe_key: `index:${url}` })
      if (row.google_canonical && row.user_canonical && row.google_canonical !== row.user_canonical) alerts.push({ code: 'canonical_mismatch', severity: 'warning', title: 'Canonical escolhido pelo Google diverge do declarado', details: `Google: ${row.google_canonical} · declarado: ${row.user_canonical}`, url, dedupe_key: `canonical:${url}` })
    }
    for (const alert of alerts) await admin.from('seo_alerts').upsert({ ...alert, status: 'open', last_seen_at: new Date().toISOString(), resolved_at: null }, { onConflict: 'dedupe_key' })

    const coverage = { device: devices.rows?.length || 0, country: countries.rows?.length || 0, searchAppearance: appearances.rows?.length || 0, image: imageTotals.rows?.length || 0, video: videoTotals.rows?.length || 0, news: newsTotals.rows?.length || 0, discover: discoverTotals.rows?.length || 0, googleNews: googleNewsTotals.rows?.length || 0 }
    await admin.from('seo_sync_runs').update({ status: 'succeeded', finished_at: new Date().toISOString(), rows_written: rowsWritten, metadata: { startDate, historyStart, endDate, inspected: inspectionRows.length, inventory: inventory.length, sitemaps: sitemapRows.length, coverage } }).eq('id', runId)
    return { runId, rowsWritten, inspected: inspectionRows.length, inventory: inventory.length, coverage }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await admin.from('seo_sync_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error: message, rows_written: rowsWritten }).eq('id', runId)
    throw error
  }
}

function sumMetrics(rows: Array<{ clicks?: number; impressions?: number; position?: number }>): Metric {
  let clicks = 0, impressions = 0, weightedPosition = 0
  for (const row of rows) { const imp = Number(row.impressions || 0); clicks += Number(row.clicks || 0); impressions += imp; weightedPosition += Number(row.position || 0) * imp }
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? weightedPosition / impressions : 0 }
}
function opportunityPriority(score: number) { if (score >= 75) return 'high'; if (score >= 55) return 'medium'; return 'watch' }
function opportunityScore(row: Metric, type: 'ctr' | 'position' | 'page') { const demand = Math.log10(Math.max(10, row.impressions)) * 20; const clickGap = type === 'position' ? Math.max(0, 20 - row.position) * 2 : Math.max(0, 0.05 - row.ctr) * 600; return Math.round((demand + clickGap) * 10) / 10 }
function trendState(current: Metric, previous: Metric) { if (current.impressions < 10 && previous.impressions < 10) return 'insufficient'; const change = previous.impressions ? (current.impressions - previous.impressions) / previous.impressions : current.impressions >= 10 ? 1 : 0; if (change >= 0.25) return 'growing'; if (change <= -0.25) return 'declining'; return 'stable' }
function detectCannibalization(rows: Array<{ day: string; dimension_key: string; clicks: number; impressions: number; position: number }>, currentStart: string) {
  const byQuery = new Map<string, Map<string, Metric>>()
  for (const row of rows.filter(item => item.day >= currentStart)) { const split = row.dimension_key.indexOf('|||'); if (split < 1) continue; const query = row.dimension_key.slice(0, split), page = row.dimension_key.slice(split + 3); const pages = byQuery.get(query) || new Map<string, Metric>(); const metric = pages.get(page) || { clicks: 0, impressions: 0, ctr: 0, position: 0 }; metric.clicks += Number(row.clicks || 0); metric.impressions += Number(row.impressions || 0); metric.position += Number(row.position || 0) * Number(row.impressions || 0); pages.set(page, metric); byQuery.set(query, pages) }
  return [...byQuery.entries()].flatMap(([query, pages]) => { const ranked = [...pages.entries()].filter(([, m]) => m.impressions >= 5).sort((a,b) => b[1].impressions - a[1].impressions); if (ranked.length < 2) return []; const [first, second] = ranked; return [{ query, pages: [first[0], second[0]], impressions: first[1].impressions + second[1].impressions, reason: 'Duas páginas recebem impressões para a mesma consulta. Revisar intenção e conteúdo antes de consolidar.' }] }).sort((a,b) => b.impressions - a.impressions).slice(0, 10)
}
function aggregate(rows: Array<{ dimension_key: string; clicks: number; impressions: number; position: number }>) {
  const map = new Map<string, { key: string; clicks: number; impressions: number; weighted: number }>()
  for (const row of rows) { const item = map.get(row.dimension_key) || { key: row.dimension_key, clicks: 0, impressions: 0, weighted: 0 }; item.clicks += Number(row.clicks || 0); item.impressions += Number(row.impressions || 0); item.weighted += Number(row.position || 0) * Number(row.impressions || 0); map.set(row.dimension_key, item) }
  return [...map.values()].map(item => ({ key: item.key, clicks: item.clicks, impressions: item.impressions, ctr: item.impressions ? item.clicks / item.impressions : 0, position: item.impressions ? item.weighted / item.impressions : 0 })).sort((a, b) => b.impressions - a.impressions)
}

async function dashboard() {
  const config = readConfig(), currentStart = isoDay(-28), previousStart = isoDay(-56), previousEnd = isoDay(-29), trendStart = isoDay(-365)
  const dimensions = ['total','query','page','query_page','device','country','search_appearance','search_type']
  const results = await Promise.all(dimensions.map(d => admin.from('seo_search_performance_daily').select('day,dimension_key,clicks,impressions,ctr,position').eq('dimension', d).gte('day', d === 'total' ? trendStart : previousStart).limit(25000)))
  const [inspectionsResult, sitemapsResult, alertsResult, runsResult] = await Promise.all([
    admin.from('seo_url_inspections').select('url,verdict,coverage_state,google_canonical,user_canonical,last_crawl_time,last_inspected_at').order('last_inspected_at', { ascending: false }).limit(100),
    admin.from('seo_sitemaps').select('*').order('last_checked_at', { ascending: false }),
    admin.from('seo_alerts').select('id,code,severity,title,details,url,status,first_seen_at,last_seen_at').eq('status', 'open').order('last_seen_at', { ascending: false }).limit(100),
    admin.from('seo_sync_runs').select('id,kind,status,started_at,finished_at,rows_written,error,metadata').order('started_at', { ascending: false }).limit(10),
  ])
  const data = Object.fromEntries(dimensions.map((d, i) => [d, results[i].data || []])) as Record<string, Array<{ day: string; dimension_key: string; clicks: number; impressions: number; ctr: number; position: number }>>
  const totals = data.total, currentRows = totals.filter(row => row.day >= currentStart), previousRows = totals.filter(row => row.day >= previousStart && row.day <= previousEnd)
  const queries = aggregate(data.query.filter(row => row.day >= currentStart)).slice(0, 50), pages = aggregate(data.page.filter(row => row.day >= currentStart)).slice(0, 50)
  const previousQueries = new Map(aggregate(data.query.filter(row => row.day >= previousStart && row.day <= previousEnd)).map(row => [row.key, row]))
  const previousPages = new Map(aggregate(data.page.filter(row => row.day >= previousStart && row.day <= previousEnd)).map(row => [row.key, row]))
  const queryTrends = queries.map(row => ({ ...row, previous: previousQueries.get(row.key) || null, trend: trendState(row, previousQueries.get(row.key) || { clicks: 0, impressions: 0, ctr: 0, position: 0 }) }))
  const pageTrends = pages.map(row => ({ ...row, previous: previousPages.get(row.key) || null, trend: trendState(row, previousPages.get(row.key) || { clicks: 0, impressions: 0, ctr: 0, position: 0 }) }))
  const candidates = [
    ...queries.filter(row => row.impressions >= 20 && row.ctr < 0.03).slice(0, 12).map(row => ({ type: 'ctr' as const, subject: row.key, reason: 'Muitas impressões e CTR baixo', score: opportunityScore(row, 'ctr'), ...row })),
    ...queries.filter(row => row.impressions >= 10 && row.position >= 8 && row.position <= 20).slice(0, 12).map(row => ({ type: 'position' as const, subject: row.key, reason: 'Consulta próxima da primeira página', score: opportunityScore(row, 'position'), ...row })),
    ...pages.filter(row => row.impressions >= 20 && row.ctr < 0.03).slice(0, 12).map(row => ({ type: 'page' as const, subject: row.key, reason: 'Página com visibilidade e poucos cliques', score: opportunityScore(row, 'page'), ...row })),
  ]
  const seen = new Set<string>()
  const opportunities = candidates.sort((a,b) => b.score - a.score || b.impressions - a.impressions).filter(row => { const key = `${row.type}:${row.subject}`; if (seen.has(key)) return false; seen.add(key); return true }).slice(0,15).map(row => ({ ...row, priority: opportunityPriority(row.score) }))
  return {
    configured: config.configured, siteUrl: config.siteUrl, current: sumMetrics(currentRows), previous: sumMetrics(previousRows), trend: totals,
    queries: queryTrends, pages: pageTrends, opportunities, cannibalization: detectCannibalization(data.query_page, currentStart),
    breakdowns: { devices: aggregate(data.device.filter(r => r.day >= currentStart)), countries: aggregate(data.country.filter(r => r.day >= currentStart)), searchAppearance: aggregate(data.search_appearance.filter(r => r.day >= currentStart)), searchTypes: aggregate(data.search_type.filter(r => r.day >= currentStart)) },
    history: { availableFrom: totals.length ? totals[0].day : null, days: totals.length },
    inspections: inspectionsResult.data || [], sitemaps: sitemapsResult.data || [], alerts: alertsResult.data || [], runs: runsResult.data || [],
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  const auth = await authorize(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)
  const body = await req.json().catch(() => ({})) as { action?: string; source?: string }
  const action = body.action || 'dashboard'
  try {
    if (action === 'sync') { const source = auth.internal || body.source === 'scheduled' ? 'scheduled' : 'manual'; const result = await syncSearchConsole(source); return json({ ok: true, ...result, dashboard: auth.internal ? undefined : await dashboard() }) }
    if (auth.internal) return json({ error: 'Token interno só pode executar sincronização.' }, 403)
    if (action === 'dashboard') return json(await dashboard())
    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (error) { console.error('google-search-console:', error instanceof Error ? error.message : String(error)); return json({ error: error instanceof Error ? error.message : 'Falha ao consultar a Search Console.' }, 502) }
})