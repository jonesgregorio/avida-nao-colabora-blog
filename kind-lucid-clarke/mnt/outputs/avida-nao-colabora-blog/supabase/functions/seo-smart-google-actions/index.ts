import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdminAal2 } from '../_shared/adminAuth.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
})

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string }
const encoder = new TextEncoder()

function readConfig() {
  const raw = (Deno.env.get('GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON') || '').trim()
  const siteUrl = (Deno.env.get('GOOGLE_SEARCH_CONSOLE_SITE_URL') || 'sc-domain:avidanaocolabora.com').trim()
  if (!raw) return { configured: false as const, siteUrl }
  try {
    const account = JSON.parse(raw) as ServiceAccount
    if (!account.client_email || !account.private_key) return { configured: false as const, siteUrl }
    return { configured: true as const, siteUrl, account }
  } catch {
    return { configured: false as const, siteUrl }
  }
}

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

async function googleAccessToken(account: ServiceAccount, scope: 'readonly' | 'write') {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss: account.client_email,
    scope: scope === 'write'
      ? 'https://www.googleapis.com/auth/webmasters'
      : 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: account.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyFromPem(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(`${header}.${payload}`),
  ))
  const assertion = `${header}.${payload}.${b64url(signature)}`
  const response = await fetch(account.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!response.ok) throw new Error(`O Google não autorizou a conta de serviço (${response.status}).`)
  const data = await response.json() as { access_token?: string }
  if (!data.access_token) throw new Error('O Google não retornou um token de acesso.')
  return data.access_token
}

function allowedUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && (parsed.hostname === 'avidanaocolabora.com' || parsed.hostname === 'www.avidanaocolabora.com')
  } catch { return false }
}

async function inspectUrl(token: string, siteUrl: string, url: string) {
  const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: url, siteUrl, languageCode: 'pt-BR' }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`O Google não conseguiu inspecionar essa URL (${response.status}). ${detail.slice(0, 180)}`)
  }
  return await response.json() as Record<string, unknown>
}

async function persistInspection(url: string, payload: Record<string, unknown>) {
  const result = ((payload.inspectionResult as Record<string, unknown> | undefined)?.indexStatusResult || {}) as Record<string, unknown>
  const row = {
    url,
    verdict: result.verdict ? String(result.verdict) : null,
    coverage_state: result.coverageState ? String(result.coverageState) : null,
    robots_txt_state: result.robotsTxtState ? String(result.robotsTxtState) : null,
    indexing_state: result.indexingState ? String(result.indexingState) : null,
    page_fetch_state: result.pageFetchState ? String(result.pageFetchState) : null,
    google_canonical: result.googleCanonical ? String(result.googleCanonical) : null,
    user_canonical: result.userCanonical ? String(result.userCanonical) : null,
    crawled_as: result.crawledAs ? String(result.crawledAs) : null,
    last_crawl_time: result.lastCrawlTime ? String(result.lastCrawlTime) : null,
    referring_urls: Array.isArray(result.referringUrls) ? result.referringUrls : [],
    raw: result,
    last_inspected_at: new Date().toISOString(),
  }
  const { error } = await admin.from('seo_url_inspections').upsert(row, { onConflict: 'url' })
  if (error) throw error
  return row
}

async function submitSitemap(token: string, siteUrl: string, sitemapUrl: string) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`O Google recusou o reenvio do sitemap (${response.status}). ${detail.slice(0, 180)}`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  const config = readConfig()
  if (!config.configured) return json({ error: 'Google Search Console ainda não está configurado no servidor.' }, 400)
  const body = await req.json().catch(() => ({})) as { action?: string; url?: string; sitemapUrl?: string }

  try {
    if (body.action === 'inspect_url') {
      const url = String(body.url || '').trim()
      if (!allowedUrl(url)) return json({ error: 'A URL informada não pertence ao site A Vida Não Colabora.' }, 400)
      const token = await googleAccessToken(config.account, 'readonly')
      const payload = await inspectUrl(token, config.siteUrl, url)
      const inspection = await persistInspection(url, payload)
      return json({ ok: true, inspection })
    }

    if (body.action === 'submit_sitemap') {
      const sitemapUrl = String(body.sitemapUrl || 'https://www.avidanaocolabora.com/sitemap.xml').trim()
      if (!allowedUrl(sitemapUrl)) return json({ error: 'O sitemap precisa pertencer ao site A Vida Não Colabora.' }, 400)
      const token = await googleAccessToken(config.account, 'write')
      await submitSitemap(token, config.siteUrl, sitemapUrl)
      return json({ ok: true, message: 'Sitemap reenviado ao Google.' })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (error) {
    console.error('seo-smart-google-actions:', error instanceof Error ? error.message : String(error))
    return json({ error: error instanceof Error ? error.message : 'Falha ao falar com o Google.' }, 502)
  }
})
