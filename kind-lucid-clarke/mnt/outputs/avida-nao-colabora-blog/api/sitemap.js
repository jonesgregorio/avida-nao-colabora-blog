const SITE_ORIGIN = 'https://www.avidanaocolabora.com'
const RPC_TIMEOUT_MS = 2500
const TRANSIENT_RPC_STATUSES = new Set([502, 503, 504])
let lastKnownGoodXml = null

const STATIC_URLS = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/blog', changefreq: 'daily', priority: '0.9' },
  { path: '/guias', changefreq: 'monthly', priority: '0.9' },
  { path: '/planos', changefreq: 'monthly', priority: '0.8' },
  { path: '/faq', changefreq: 'monthly', priority: '0.7' },
  { path: '/sobre', changefreq: 'monthly', priority: '0.7' },
  { path: '/contato', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacidade', changefreq: 'monthly', priority: '0.4' },
  { path: '/termos', changefreq: 'monthly', priority: '0.4' },
  { path: '/aviso-de-responsabilidade', changefreq: 'monthly', priority: '0.3' },
  { path: '/politica-editorial', changefreq: 'monthly', priority: '0.5' },
]

function xmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isoDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url, options, timeoutMs = RPC_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function listPublishedArticles() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) throw new Error('supabase_public_env_missing')

  const url = `${supabaseUrl}/rest/v1/rpc/list_public_article_sitemap`
  let lastError = null

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const startedAt = Date.now()
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
      const durationMs = Date.now() - startedAt
      if (!response.ok || durationMs >= 1000) {
        console.warn('[seo/sitemap-rpc]', JSON.stringify({ attempt, status: response.status, durationMs }))
      }
      if (response.ok) {
        const rows = await response.json()
        return Array.isArray(rows) ? rows : []
      }
      if (!TRANSIENT_RPC_STATUSES.has(response.status) || attempt === 2) {
        throw new Error(`sitemap_rpc_http_${response.status}`)
      }
    } catch (error) {
      lastError = error
      const durationMs = Date.now() - startedAt
      console.warn('[seo/sitemap-rpc]', JSON.stringify({ attempt, status: 'network_error', durationMs, error: String(error?.name || error) }))
      if (attempt === 2) throw error
    }
    await wait(120 * attempt)
  }

  throw lastError || new Error('sitemap_rpc_unknown_failure')
}

function buildXml(articles) {
  const staticEntries = STATIC_URLS.map(({ path, changefreq, priority }) => [
    '  <url>',
    `    <loc>${xmlEscape(`${SITE_ORIGIN}${path}`)}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n'))

  const articleEntries = articles
    .filter((row) => row?.slug && /^[a-z0-9-]+$/i.test(String(row.slug)))
    .map((row) => {
      const lastmod = isoDate(row.updated_at || row.published_at)
      return [
        '  <url>',
        `    <loc>${xmlEscape(`${SITE_ORIGIN}/blog/${encodeURIComponent(row.slug)}`)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
        '    <changefreq>monthly</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
      ].filter(Boolean).join('\n')
    })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticEntries,
    ...articleEntries,
    '</urlset>',
    '',
  ].join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).end('Method Not Allowed')
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400, stale-if-error=86400')

  try {
    const articles = await listPublishedArticles()
    const xml = buildXml(articles)
    lastKnownGoodXml = xml
    res.setHeader('X-Sitemap-Source', 'live')
    res.status(200)
    return req.method === 'HEAD' ? res.end() : res.end(xml)
  } catch (error) {
    console.error('[seo/sitemap] article list unavailable', error)

    if (lastKnownGoodXml) {
      res.setHeader('X-Sitemap-Source', 'stale-memory')
      res.status(200)
      return req.method === 'HEAD' ? res.end() : res.end(lastKnownGoodXml)
    }

    res.setHeader('Retry-After', '60')
    res.setHeader('X-Sitemap-Source', 'unavailable')
    res.status(503)
    return req.method === 'HEAD' ? res.end() : res.end(buildXml([]))
  }
}
