const SITE_ORIGIN = 'https://www.avidanaocolabora.com'
const DEFAULT_IMAGE = `${SITE_ORIGIN}/brand/logo-quadrada.png`

const PAGE_META = {
  home: {
    path: '/',
    type: 'WebPage',
    title: 'A Vida Não Colabora — Diário emocional e autocuidado',
    description: 'Organize o que você sente com diário emocional, check-ins, mapa emocional, conteúdos e recursos de autocuidado em um espaço privado e acolhedor.',
    heading: 'Um lugar para se organizar por dentro nos dias difíceis',
    intro: 'Registre como você está, acompanhe sua trajetória e encontre formas possíveis de cuidar de si com mais clareza e gentileza.',
  },
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
  guides: {
    path: '/guias',
    type: 'CollectionPage',
    title: 'Guias de bem-estar emocional — A Vida Não Colabora',
    description: 'Guias completos sobre diário emocional, check-in, padrões emocionais, ansiedade, limites, rotina e autocuidado para começar com clareza.',
    heading: 'Guias essenciais para cuidar da vida emocional',
    intro: 'Comece por um tema e avance no seu ritmo. Cada guia reúne explicações práticas e próximos passos para transformar observação em cuidado possível.',
  },
  editorial: {
    path: '/politica-editorial',
    type: 'WebPage',
    title: 'Política editorial — A Vida Não Colabora',
    description: 'Conheça os critérios de autoria, revisão, fontes, atualização e segurança usados nos conteúdos de bem-estar emocional da A Vida Não Colabora.',
    heading: 'Política editorial',
    intro: 'Transparência, cuidado e utilidade orientam tudo o que publicamos.',
  },
}

const GUIDE_LINKS = [
  ['Diário emocional', 'como-comecar-um-diario-emocional-sem-saber-o-que-escrever', 'Como começar a escrever, mesmo quando você ainda não sabe explicar o que sente.'],
  ['Check-in emocional', 'faca-seu-primeiro-check-in-emocional', 'Uma pausa curta para perceber humor, energia, corpo e necessidades do momento.'],
  ['Padrões emocionais', 'como-identificar-padroes-nos-seus-registros-emocionais', 'Como observar repetições sem transformar percepção em diagnóstico ou cobrança.'],
  ['Autocuidado possível', 'o-que-e-autocuidado-emocional-na-vida-real', 'Cuidados pequenos e realistas para dias comuns, inclusive os mais difíceis.'],
  ['Sobrecarga emocional', 'como-perceber-se-hoje-foi-um-dia-de-sobrecarga', 'Sinais que ajudam a reconhecer quando o dia exigiu mais do que parecia.'],
  ['Limites sem culpa', 'como-dizer-nao-sem-culpa-e-preservar-sua-energia', 'Reflexões para proteger tempo e energia com respeito por você e pelos outros.'],
  ['Ansiedade, sono e rotina', 'como-relacionar-ansiedade-sono-e-rotina', 'Um jeito cuidadoso de observar como esses aspectos aparecem juntos no cotidiano.'],
  ['Plano de autocuidado', 'como-transformar-seus-registros-em-um-plano-de-autocuidado', 'Como transformar registros e descobertas em próximos passos simples e sustentáveis.'],
]

const PAGE_SECTIONS = {
  home: [
    ['Entenda sua trajetória emocional', 'O diário e os check-ins ajudam você a registrar acontecimentos, emoções, contextos, necessidades e pequenas ações de cuidado. Com o uso contínuo, o mapa emocional e as descobertas tornam as repetições mais fáceis de perceber.'],
    ['Privacidade em primeiro lugar', 'Seus registros pessoais não são páginas públicas e não fazem parte do conteúdo exibido em mecanismos de busca. A plataforma foi criada para apoiar autoconhecimento e organização emocional, sem substituir acompanhamento psicológico, psiquiátrico ou médico.'],
    ['Conteúdos para começar', 'Além das ferramentas pessoais, o blog reúne leituras e práticas sobre diário emocional, autocuidado, ansiedade, sobrecarga, relações, limites, sono e rotina.'],
  ],
  editorial: [
    ['Propósito dos conteúdos', 'Publicamos materiais educativos sobre bem-estar emocional, autoconhecimento e autocuidado. Os textos oferecem informação e reflexão prática; não realizam diagnóstico, prescrição, psicoterapia ou atendimento de emergência.'],
    ['Autoria e responsabilidade', 'Cada conteúdo identifica sua autoria editorial. Quando um tema exigir conhecimento profissional específico, a revisão deve ser realizada por profissional habilitado e identificada de forma transparente antes da publicação.'],
    ['Fontes e evidências', 'Afirmações sobre saúde devem se apoiar em fontes primárias, instituições públicas, diretrizes profissionais ou literatura científica adequada. Experiências pessoais e metáforas são apresentadas como reflexão, não como evidência clínica.'],
    ['Revisão e atualização', 'Datas de publicação e atualização são informadas nos artigos. Conteúdos podem ser corrigidos, ampliados ou retirados quando estiverem desatualizados, imprecisos ou fora dos critérios editoriais.'],
    ['Uso responsável de inteligência artificial', 'Ferramentas de inteligência artificial podem apoiar pesquisa, estruturação e revisão de textos. A publicação depende de validações editoriais, de SEO, segurança e coerência com o propósito da plataforma.'],
    ['Como reportar um problema', 'Se você encontrar informação imprecisa, conteúdo inadequado ou uma fonte que precise ser revista, utilize a página de contato. A equipe avaliará o material e registrará a correção quando necessária.'],
  ],
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

function injectSnapshot(shell, markup) {
  return shell.replace('<div id="root"></div>', `<div id="root">${markup}</div>`)
}

function renderSnapshot(page, articles = []) {
  const heading = page.heading || page.title.replace(/\s+—\s+A Vida Não Colabora$/, '')
  const intro = page.intro || page.description
  const sections = PAGE_SECTIONS[Object.entries(PAGE_META).find(([, value]) => value === page)?.[0]] || []
  const staticSections = sections.map(([title, text]) => `<section><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></section>`).join('')

  let collection = ''
  if (page === PAGE_META.guides) {
    collection = `<section><h2>Escolha por onde começar</h2><ul>${GUIDE_LINKS.map(([title, slug, text]) => `<li><a href="/blog/${escapeHtml(slug)}"><strong>${escapeHtml(title)}</strong></a><p>${escapeHtml(text)}</p></li>`).join('')}</ul></section>`
  } else if (page === PAGE_META.blog && articles.length) {
    collection = `<section><h2>Conteúdos publicados</h2><ul>${articles.slice(0, 50).map((article) => `<li><a href="/blog/${escapeHtml(article.slug)}"><strong>${escapeHtml(article.title)}</strong></a>${article.excerpt ? `<p>${escapeHtml(article.excerpt)}</p>` : ''}</li>`).join('')}</ul></section>`
  }

  return `<main class="seo-snapshot"><nav aria-label="Navegação estrutural"><a href="/">Início</a> · <a href="/blog">Blog</a> · <a href="/guias">Guias</a></nav><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(intro)}</p>${staticSections}${collection}<p><a href="/blog">Explorar conteúdos sobre bem-estar emocional</a></p></main>`
}

function setPageHead(shell, page, articles = []) {
  const canonical = `${SITE_ORIGIN}${page.path}`
  let html = shell

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(page.description)}" />`)
  html = replaceOrAppendHead(html, /<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="index, follow, max-image-preview:large" />')
  html = replaceOrAppendHead(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`)
  html = replaceOrAppendHead(html, /<link\s+rel=["']alternate["'][^>]*hreflang=["']pt-BR["'][^>]*>/i, `<link rel="alternate" hreflang="pt-BR" href="${escapeHtml(canonical)}" />`)
  html = replaceOrAppendHead(html, /<link\s+rel=["']alternate["'][^>]*hreflang=["']x-default["'][^>]*>/i, `<link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}" />`)
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
  if (page.path === '/') {
    const googleVerification = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim()
    const bingVerification = String(process.env.BING_SITE_VERIFICATION || '').trim()
    if (googleVerification) html = replaceOrAppendHead(html, /<meta\s+name=["']google-site-verification["'][^>]*>/i, `<meta name="google-site-verification" content="${escapeHtml(googleVerification)}" />`)
    if (bingVerification) html = replaceOrAppendHead(html, /<meta\s+name=["']msvalidate\.01["'][^>]*>/i, `<meta name="msvalidate.01" content="${escapeHtml(bingVerification)}" />`)
  }

  const graph = [
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
        itemListElement: page.path === '/' ? [
          { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_ORIGIN}/` },
        ] : [
          { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: page.title.replace(/\s+—\s+A Vida Não Colabora$/, ''), item: canonical },
        ],
      },
    ]

  const itemLinks = page === PAGE_META.guides
    ? GUIDE_LINKS.map(([title, slug]) => ({ title, url: `${SITE_ORIGIN}/blog/${slug}` }))
    : page === PAGE_META.blog
      ? articles.slice(0, 50).map((article) => ({ title: article.title, url: `${SITE_ORIGIN}/blog/${article.slug}` }))
      : []
  if (itemLinks.length) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${canonical}#items`,
      itemListElement: itemLinks.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.title, url: item.url })),
    })
  }

  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graph,
  }).replace(/</g, '\\u003c')

  html = html.replace('</head>', `    <script type="application/ld+json">${structuredData}</script>\n  </head>`)
  return injectSnapshot(html, renderSnapshot(page, articles))
}

async function listPublicArticles() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return []
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/list_public_article_index`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!response.ok) return []
    const rows = await response.json()
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

async function getAppShell(req) {
  // Usa o host real recebido pela requisição. Em produção, VERCEL_URL aponta
  // para a URL técnica *.vercel.app do deployment, protegida pelo Standard
  // Protection, e não deve ser usada para o self-fetch do domínio público.
  const host = req.headers.host || process.env.VERCEL_URL
  if (!host) throw new Error('deployment_host_missing')
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const headers = { 'user-agent': 'AVNC-SEO-Renderer/1.0' }
  if (req.headers.cookie) headers.cookie = req.headers.cookie

  const response = await fetch(`${protocol}://${host}/index.html`, { headers })
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
    const articles = route === 'blog' ? await listPublicArticles() : []
    const html = setPageHead(shell, page, articles)
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
