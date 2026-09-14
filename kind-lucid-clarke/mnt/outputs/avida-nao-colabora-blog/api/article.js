const SITE_ORIGIN = 'https://www.avidanaocolabora.com'
const DEFAULT_IMAGE = `${SITE_ORIGIN}/brand/logo-quadrada.png`
const RPC_TIMEOUT_MS = 2500
const TRANSIENT_RPC_STATUSES = new Set([502, 503, 504])

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

function imageMime(value) {
  const pathname = String(value || '').split('?')[0].toLowerCase()
  if (pathname.endsWith('.png')) return 'image/png'
  if (pathname.endsWith('.webp')) return 'image/webp'
  if (pathname.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

function replaceOrAppendHead(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement)
  return html.replace('</head>', `    ${replacement}\n  </head>`)
}

function isArticlePublic(article) {
  return String(article?.plan_required || '').trim().toLowerCase() === 'free'
}

function renderInlineMarkdown(value = '') {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\((\/blog\/[a-z0-9-]+)\)/gi, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function renderPublicArticleContent(content = '') {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n')
  const output = []
  let listType = null
  const closeList = () => { if (listType) output.push(`</${listType}>`); listType = null }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || /^::video/.test(line)) { closeList(); continue }
    if (/^(---|\*\*\*|___)$/.test(line)) { closeList(); output.push('<hr />'); continue }
    if (line.startsWith('### ')) { closeList(); output.push(`<h3>${renderInlineMarkdown(line.slice(4))}</h3>`); continue }
    if (line.startsWith('## ')) { closeList(); output.push(`<h2>${renderInlineMarkdown(line.slice(3))}</h2>`); continue }
    if (line.startsWith('> ')) { closeList(); output.push(`<blockquote>${renderInlineMarkdown(line.slice(2))}</blockquote>`); continue }
    const unordered = line.match(/^[-*]\s+(.+)/)
    const ordered = line.match(/^\d+\.\s+(.+)/)
    if (unordered || ordered) {
      const nextType = unordered ? 'ul' : 'ol'
      if (listType !== nextType) { closeList(); output.push(`<${nextType}>`); listType = nextType }
      output.push(`<li>${renderInlineMarkdown((unordered || ordered)[1])}</li>`)
      continue
    }
    closeList()
    output.push(`<p>${renderInlineMarkdown(line)}</p>`)
  }
  closeList()
  return output.join('')
}

function injectArticleSnapshot(html, article, canonical) {
  const title = String(article.title || article.seo_title || 'Artigo').trim()
  const description = String(article.summary || article.excerpt || article.seo_description || '').trim()
  const author = String(article.author || 'Equipe editorial A Vida Não Colabora').trim()
  const published = article.published_at ? new Date(article.published_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''
  const reviewed = article.reviewed_at ? new Date(article.reviewed_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''
  const articleBody = article.content ? renderPublicArticleContent(article.content) : ''
  const related = Array.isArray(article.related_slugs) && article.related_slugs.length
    ? `<aside><h2>Continue lendo</h2><ul>${article.related_slugs.slice(0, 6).filter((slug) => /^[a-z0-9-]+$/i.test(slug)).map((slug) => {
      const label = slug.replace(/-/g, ' ').replace(/^./, (char) => char.toUpperCase())
      return `<li><a href="/blog/${escapeHtml(slug)}">${escapeHtml(label)}</a></li>`
    }).join('')}</ul></aside>`
    : ''
  const markup = `<main class="seo-snapshot"><nav aria-label="Navegação estrutural"><a href="/">Início</a> · <a href="/blog">Blog</a> · <a href="/guias">Guias</a></nav><article><header><p>${escapeHtml(article.category || 'Bem-estar emocional')}</p><h1>${escapeHtml(title)}</h1>${description ? `<p>${escapeHtml(description)}</p>` : ''}<p>Por ${escapeHtml(author)}${published ? ` · Publicado em ${escapeHtml(published)}` : ''}${reviewed ? ` · Revisão editorial em ${escapeHtml(reviewed)}` : ''}</p></header>${articleBody || `<p>${escapeHtml(description)}</p>`}<footer><p>Conteúdo educativo. Não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.</p></footer></article>${related}<p><a href="${escapeHtml(canonical)}">Ler este conteúdo na A Vida Não Colabora</a></p></main>`
  return html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${markup}</div>`)
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
  const isPublic = isArticlePublic(article)

  let html = shell
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${isPublic ? 'index, follow, max-image-preview:large' : 'noindex, follow, noarchive'}" />`)
  html = applyCanonicalLinks(html, canonical)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:type["'][^>]*>/i, '<meta property="og:type" content="article" />')
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonical)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:image:type["'][^>]*>/i, `<meta property="og:image:type" content="${imageMime(image)}" />`)
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

  const authorName = String(article.author || 'Equipe editorial A Vida Não Colabora').trim()
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${canonical}#article`,
    headline: title,
    description,
    image: [image],
    datePublished: publishedAt || undefined,
    dateModified: modifiedAt || undefined,
    inLanguage: 'pt-BR',
    isAccessibleForFree: isPublic,
    articleSection: article.category || undefined,
    author: authorName === 'A Vida Não Colabora' || authorName.startsWith('Equipe editorial')
      ? {
          '@type': 'Organization',
          '@id': `${SITE_ORIGIN}/#organization`,
          name: authorName,
          url: `${SITE_ORIGIN}/politica-editorial`,
          logo: { '@type': 'ImageObject', url: DEFAULT_IMAGE, width: 512, height: 512 },
        }
      : { '@type': 'Person', name: authorName },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    publisher: {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'A Vida Não Colabora',
      url: `${SITE_ORIGIN}/`,
      logo: { '@type': 'ImageObject', url: DEFAULT_IMAGE, width: 512, height: 512 },
    },
  }).replace(/</g, '\\u003c')

  const breadcrumbs = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_ORIGIN}/blog` },
      { '@type': 'ListItem', position: 3, name: title, item: canonical },
    ],
  }).replace(/</g, '\\u003c')

  html = html.replace(
    '</head>',
    `    ${articleMeta}\n    <script type="application/ld+json">${structuredData}</script>\n    <script type="application/ld+json">${breadcrumbs}</script>\n  </head>`,
  )
  return isPublic ? injectArticleSnapshot(html, article, canonical) : html
}

function setArticleFallbackHead(shell, slug) {
  const canonical = `${SITE_ORIGIN}/blog/${encodeURIComponent(slug)}`
  let html = applyCanonicalLinks(shell, canonical)
  html = replaceOrAppendHead(html, /<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex, follow, noarchive" />')
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
  const host = req.headers.host || process.env.VERCEL_URL
  if (!host) throw new Error('deployment_host_missing')
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const headers = { 'user-agent': 'AVNC-SEO-Renderer/1.0' }
  if (req.headers.cookie) headers.cookie = req.headers.cookie

  const response = await fetch(`${protocol}://${host}/index.html`, { headers })
  if (!response.ok) throw new Error(`shell_http_${response.status}`)
  return response.text()
}

function publicSupabaseConfig() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) throw new Error('supabase_public_env_missing')
  return { supabaseUrl, anonKey }
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

async function callPublicRpc(functionName, body, attempts = 1) {
  const { supabaseUrl, anonKey } = publicSupabaseConfig()
  const url = `${supabaseUrl}/rest/v1/rpc/${functionName}`
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now()
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const durationMs = Date.now() - startedAt
      if (!response.ok || durationMs >= 1000) {
        console.warn('[seo/rpc]', JSON.stringify({ functionName, attempt, status: response.status, durationMs }))
      }
      if (response.ok || !TRANSIENT_RPC_STATUSES.has(response.status) || attempt === attempts) return response
    } catch (error) {
      const durationMs = Date.now() - startedAt
      lastError = error
      console.warn('[seo/rpc]', JSON.stringify({ functionName, attempt, status: 'network_error', durationMs, error: String(error?.name || error) }))
      if (attempt === attempts) throw error
    }
    await wait(120 * attempt)
  }

  throw lastError || new Error('seo_rpc_unknown_failure')
}

async function getArticleSeo(slug) {
  let response
  try {
    response = await callPublicRpc('get_public_article_document', { p_slug: slug }, 2)
  } catch {
    response = null
  }

  if (!response?.ok) {
    response = await callPublicRpc('get_public_article_seo_safe', { p_slug: slug }, 1)
  }
  if (!response.ok) throw new Error(`seo_rpc_http_${response.status}`)
  const rows = await response.json()
  return Array.isArray(rows) ? rows[0] || null : rows || null
}

async function getPublicRedirect(path) {
  const response = await callPublicRpc('get_public_redirect', { p_path: path }, 1)
  if (!response.ok) return null
  const rows = await response.json()
  const row = Array.isArray(rows) ? rows[0] : rows
  const toPath = String(row?.to_path || '')
  const type = Number(row?.type || 301)
  if (!toPath.startsWith('/') || toPath.startsWith('//') || ![301, 302].includes(type)) return null
  return { toPath, type }
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
    res.setHeader('Retry-After', '60')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
    return res.status(503).end('Temporariamente indisponível')
  }

  try {
    const article = await getArticleSeo(slug)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400')
    res.setHeader('Vary', 'Accept-Encoding')

    if (!article) {
      const redirect = await getPublicRedirect(`/blog/${slug}`).catch(() => null)
      if (redirect) {
        res.setHeader('Location', redirect.toPath)
        return res.status(redirect.type).end()
      }
      res.setHeader('X-Robots-Tag', 'noindex, follow, noarchive')
      res.status(404)
      return req.method === 'HEAD' ? res.end() : res.end(setNotFoundHead(shell))
    }

    if (!isArticlePublic(article)) {
      res.setHeader('X-Robots-Tag', 'noindex, follow, noarchive')
    }

    res.status(200)
    return req.method === 'HEAD' ? res.end() : res.end(setArticleHead(shell, article, slug))
  } catch (error) {
    console.error('[seo/article] metadata unavailable', error)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Retry-After', '60')
    res.setHeader('X-SEO-Fallback', 'fail-closed')
    res.setHeader('X-Robots-Tag', 'noindex, follow, noarchive')
    res.status(503)
    return req.method === 'HEAD' ? res.end() : res.end(setArticleFallbackHead(shell, slug))
  }
}
