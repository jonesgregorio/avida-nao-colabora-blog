const SITE_ORIGIN = 'https://www.avidanaocolabora.com'

const STATIC_URLS = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/blog', changefreq: 'daily', priority: '0.9' },
  { path: '/planos', changefreq: 'monthly', priority: '0.8' },
  { path: '/faq', changefreq: 'monthly', priority: '0.7' },
  { path: '/sobre', changefreq: 'monthly', priority: '0.7' },
  { path: '/contato', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacidade', changefreq: 'monthly', priority: '0.4' },
  { path: '/termos', changefreq: 'monthly', priority: '0.4' },
  { path: '/aviso-de-responsabilidade', changefreq: 'monthly', priority: '0.3' },
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

async function listPublishedArticles() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) throw new Error('supabase_public_env_missing')

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/list_public_article_sitemap`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  if (!response.ok) throw new Error(`sitemap_rpc_http_${response.status}`)
  const rows = await response.json()
  return Array.isArray(rows) ? rows : []
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

  let articles = []
  try {
    articles = await listPublishedArticles()
  } catch (error) {
    // O sitemap continua valido com as paginas estaticas caso o Supabase oscile.
    console.error('[seo/sitemap] article list fallback', error)
    res.setHeader('X-Sitemap-Fallback', '1')
  }

  const xml = buildXml(articles)
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
  res.status(200)
  return req.method === 'HEAD' ? res.end() : res.end(xml)
}
