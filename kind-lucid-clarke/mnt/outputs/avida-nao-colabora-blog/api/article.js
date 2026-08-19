const SITE_ORIGIN = 'https://www.avidanaocolabora.com'
const DEFAULT_IMAGE = `${SITE_ORIGIN}/brand/logo-quadrada.png`

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function absoluteUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return DEFAULT_IMAGE
  if (/^https?:\/\//i.test(raw)) return raw
  return `${SITE_ORIGIN}${raw.startsWith('/') ? '' : '/'}${raw}`
}

function replaceOrAppendHead(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement)
  return html.replace('</head>', `    ${replacement}\n  </head>`)
}

function applyCanonicalLinks(html, canonical) {
  let next = replaceOrAppendHead(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`)
  next = replaceOrAppendHead(next, /<link\s+rel=["']alternate["'][^>]*hreflang=["']pt-BR["'][^>]*>/i, `<link rel="alternate" hreflang="pt-BR" href="${escapeHtml(canonical)}" />`)
  next = replaceOrAppendHead(next, /<link\s+rel=["']alternate["'][^>]*hreflang=["']x-default["'][^>]*>/i, `<link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}" />`)
  return next
}

function setArticleHead(shell, article, slug) {
  const canonical = `${SITE_ORIGIN}/blog/${encodeURIComponent(slug)}`
  const title = String(article.seo_title || article.title || 'Artigo').trim()
  const description = String(
    article.seo_description || article.summary || article.excerpt || 'Conteúdo sobre bem-estar emocional e autoconhecimento.'
  ).trim().slice(0, 320)
  const image = absoluteUrl(article.og_image || article.cover_image_url || article.image_url || article.cover_image)
  const imageAlt = String(article.image_alt || article.title || 'Imagem do artigo').trim()
  const publishedAt = article.published_at ? new Date(article.published_at).toISOString() : null
  const modifiedAt = article.updated_at ? new Date(article.updated_at).toISOString() : publishedAt

  let html = shell
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="index, follow, max-image-preview:large" />')
  html = applyCanonicalLinks(html, canonical)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:type["'][^>]*>/i, '<meta property="og:type" content="article" />')
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonical)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:image:alt["'][^>]*>/i, `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']twitter:card["'][^>]*>/i, '<meta name="twitter:card" content="summary_large_image" />')
  html = replaceOrAppendHead(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${escapeHtml(image)}" />`)

  const articleMeta = [
    publishedAt ? `<meta property="article:published_time" content="${escapeHtml(publishedAt)}" />` : '',
    modifiedAt ? `<meta property="article:modified_time" content="${escapeHtml(modifiedAt)}" />` : '',
    article.category ? `<meta property="article:section" content="${escapeHtml(article.category)}" />` : '',
  ].filter(Boolean).join('\n    ')

  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    image: [image],
    datePublished: publishedAt || undefined,
    dateModified: modifiedAt || undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    publisher: {
      '@type': 'Organization',
      name: 'A Vida Não Colabora',
      logo: { '@type': 'ImageObject', url: DEFAULT_IMAGE },
    },
  }).replace(/</g, '\\u003c')

  html = html.replace(
    '</head>',
    `    ${articleMeta}\n    <script type="application/ld+json">${structuredData}</script>\n  </head>`,
  )
  return html
}

function setArticleFallbackHead(shell, slug) {
  const canonical = `${SITE_ORIGIN}/blog/${encodeURIComponent(slug)}`
  let html = applyCanonicalLinks(shell, canonical)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonical)}" />`)
  return html
}

function setNotFoundHead(shell) {
  let html = shell.replace(/<title>[\s\S]*?<\/title>/i, '<title>Artigo não encontrado — A Vida Não Colabora</title>')
  html = replaceOrAppendHead(html, /<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex, follow" />')
  html = html.replace(/\s*<link\s+rel=["']canonical["'][^>]*>/i, '')
  html = html.replace(/\s*<link\s+rel=["']alternate["'][^>]*hreflang=["']pt-BR["'][^>]*>/i, '')
  html = html.replace(/\s*<link\s+rel=["']alternate["'][^>]*hreflang=["']x-default["'][^>]*>/i, '')
  return html
}

async function getAppShell(req) {
  const host = process.env.VERCEL_URL || req.headers.host
  if (!host) throw new Error('deployment_host_missing')
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const response = await fetch(`${protocol}://${host}/index.html`, {
    headers: { 'user-agent': 'AVNC-SEO-Renderer/1.0' },
  })
  if (!response.ok) throw new Error(`shell_http_${response.status}`)
  return response.text()
}

async function getArticleSeo(slug) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) throw new Error('supabase_public_env_missing')

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_article_seo`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_slug: slug }),
  })
  if (!response.ok) throw new Error(`seo_rpc_http_${response.status}`)
  const rows = await response.json()
  return Array.isArray(rows) ? rows[0] || null : rows || null
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).end('Method Not Allowed')
  }

  const slugRaw = Array.isArray(req.query?.slug) ? req.query.slug[0] : req.query?.slug
  const slug = decodeURIComponent(String(slugRaw || '')).trim()
  if (!slug || slug.length > 180 || !/^[a-z0-9-]+$/i.test(slug)) {
    return res.status(404).end('Not Found')
  }

  let shell
  try {
    shell = await getAppShell(req)
  } catch (error) {
    console.error('[seo/article] app shell unavailable', error)
    return res.status(503).end('Temporariamente indisponível')
  }

  try {
    const article = await getArticleSeo(slug)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
    res.setHeader('Vary', 'Accept-Encoding')

    if (!article) {
      res.status(404)
      return req.method === 'HEAD' ? res.end() : res.end(setNotFoundHead(shell))
    }

    res.status(200)
    return req.method === 'HEAD' ? res.end() : res.end(setArticleHead(shell, article, slug))
  } catch (error) {
    // Falha aberta: nunca derruba o artigo por causa da camada de SEO.
    // Preserva a URL canônica do artigo mesmo quando os metadados dinâmicos oscilam.
    console.error('[seo/article] metadata fallback', error)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-SEO-Fallback', '1')
    res.status(200)
    return req.method === 'HEAD' ? res.end() : res.end(setArticleFallbackHead(shell, slug))
  }
}
