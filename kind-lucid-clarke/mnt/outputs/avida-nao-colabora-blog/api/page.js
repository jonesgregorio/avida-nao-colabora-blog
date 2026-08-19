const SITE_ORIGIN = 'https://www.avidanaocolabora.com'
const DEFAULT_IMAGE = `${SITE_ORIGIN}/brand/logo-quadrada.png`

const PAGE_META = {
  blog: {
    path: '/blog',
    type: 'CollectionPage',
    title: 'Blog — A Vida Não Colabora',
    description: 'Conteúdos sobre bem-estar emocional, autoconhecimento, relações, rotina e autocuidado para ajudar você a organizar o que sente com mais leveza.',
  },
  pricing: {
    path: '/planos',
    type: 'WebPage',
    title: 'Planos — A Vida Não Colabora',
    description: 'Compare os planos da A Vida Não Colabora e escolha os recursos de diário emocional, acompanhamento e autocuidado que fazem sentido para você.',
  },
  faq: {
    path: '/faq',
    type: 'WebPage',
    title: 'Perguntas frequentes — A Vida Não Colabora',
    description: 'Tire dúvidas sobre a A Vida Não Colabora, recursos da plataforma, planos, conta, privacidade e funcionamento do acompanhamento emocional.',
  },
  about: {
    path: '/sobre',
    type: 'AboutPage',
    title: 'Sobre — A Vida Não Colabora',
    description: 'Conheça a proposta da A Vida Não Colabora: um espaço de apoio ao autoconhecimento, organização emocional e autocuidado com linguagem acolhedora e prática.',
  },
  contact: {
    path: '/contato',
    type: 'ContactPage',
    title: 'Contato — A Vida Não Colabora',
    description: 'Entre em contato com a equipe da A Vida Não Colabora para dúvidas, suporte e informações sobre a plataforma.',
  },
  privacy: {
    path: '/privacidade',
    type: 'WebPage',
    title: 'Política de Privacidade — A Vida Não Colabora',
    description: 'Consulte a Política de Privacidade da A Vida Não Colabora e saiba como dados e informações são tratados na plataforma.',
  },
  terms: {
    path: '/termos',
    type: 'WebPage',
    title: 'Termos de Uso — A Vida Não Colabora',
    description: 'Consulte os Termos de Uso da A Vida Não Colabora e as regras aplicáveis ao uso da plataforma e de seus recursos.',
  },
  responsibility: {
    path: '/aviso-de-responsabilidade',
    type: 'WebPage',
    title: 'Aviso de Responsabilidade — A Vida Não Colabora',
    description: 'Entenda os limites de uso da A Vida Não Colabora e a diferença entre recursos de apoio ao bem-estar e atendimento profissional de saúde.',
  },
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function replaceOrAppendHead(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement)
  return html.replace('</head>', `    ${replacement}\n  </head>`)
}

function setPageHead(shell, page) {
  const canonical = `${SITE_ORIGIN}${page.path}`
  let html = shell

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(page.description)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="index, follow, max-image-preview:large" />')
  html = replaceOrAppendHead(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(page.title)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(page.description)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:type["'][^>]*>/i, '<meta property="og:type" content="website" />')
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonical)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${DEFAULT_IMAGE}" />`)
  html = replaceOrAppendHead(html, /<meta\s+property=["']og:image:alt["'][^>]*>/i, '<meta property="og:image:alt" content="Logo da A Vida Não Colabora" />')
  html = replaceOrAppendHead(html, /<meta\s+name=["']twitter:card["'][^>]*>/i, '<meta name="twitter:card" content="summary" />')
  html = replaceOrAppendHead(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${DEFAULT_IMAGE}" />`)

  const alternatePtBr = `<link rel="alternate" hreflang="pt-BR" href="${escapeHtml(canonical)}" />`
  const alternateDefault = `<link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}" />`
  html = html.replace('</head>', `    ${alternatePtBr}\n    ${alternateDefault}\n  </head>`)

  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': page.type,
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: page.title,
        description: page.description,
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        about: { '@id': `${SITE_ORIGIN}/#organization` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Início',
            item: `${SITE_ORIGIN}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: page.title.replace(/\s+—\s+A Vida Não Colabora$/, ''),
            item: canonical,
          },
        ],
      },
    ],
  }).replace(/</g, '\\u003c')

  html = html.replace('</head>', `    <script type="application/ld+json">${structuredData}</script>\n  </head>`)
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

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).end('Method Not Allowed')
  }

  const routeRaw = Array.isArray(req.query?.route) ? req.query.route[0] : req.query?.route
  const route = String(routeRaw || '').trim()
  const page = PAGE_META[route]
  if (!page) return res.status(404).end('Not Found')

  try {
    const shell = await getAppShell(req)
    const html = setPageHead(shell, page)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
    res.setHeader('Vary', 'Accept-Encoding')
    res.status(200)
    return req.method === 'HEAD' ? res.end() : res.end(html)
  } catch (error) {
    console.error('[seo/page] app shell unavailable', error)
    return res.status(503).end('Temporariamente indisponível')
  }
}
