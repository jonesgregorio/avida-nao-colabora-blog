import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import pageHandler from '../api/page.js'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const pageRenderer = readFileSync(new URL('../api/page.js', import.meta.url), 'utf8')
const articleRenderer = readFileSync(new URL('../api/article.js', import.meta.url), 'utf8')
const vercelConfig = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
) as {
  rewrites?: Array<{ source?: string; destination?: string }>
  redirects?: Array<{ source?: string; destination?: string; permanent?: boolean }>
}

function rewriteFor(source: string) {
  return vercelConfig.rewrites?.find((rewrite) => rewrite.source === source)?.destination ?? ''
}

function createResponseRecorder() {
  return {
    statusCode: 200,
    headers: new Map<string, string>(),
    body: '',
    setHeader(key: string, value: string) {
      this.headers.set(key.toLowerCase(), value)
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    end(value = '') {
      this.body = String(value)
      return this
    },
  }
}

test('home possui canonical e identidade estruturada global', () => {
  assert.match(indexHtml, /rel="canonical" href="https:\/\/www\.avidanaocolabora\.com\/"/)
  assert.match(indexHtml, /"@type": "Organization"/)
  assert.match(indexHtml, /"@id": "https:\/\/www\.avidanaocolabora\.com\/#organization"/)
  assert.match(indexHtml, /"@type": "WebSite"/)
  assert.match(indexHtml, /"@id": "https:\/\/www\.avidanaocolabora\.com\/#website"/)
  assert.match(indexHtml, /"inLanguage": "pt-BR"/)
})

test('páginas públicas principais passam pelo renderer SEO específico', () => {
  const expected: Record<string, string> = {
    '/': '/api/page?route=home',
    '/blog': '/api/page?route=blog',
    '/guias': '/api/page?route=guides',
    '/planos': '/api/page?route=pricing',
    '/faq': '/api/page?route=faq',
    '/sobre': '/api/page?route=about',
    '/contato': '/api/page?route=contact',
    '/privacidade': '/api/page?route=privacy',
    '/termos': '/api/page?route=terms',
    '/aviso-de-responsabilidade': '/api/page?route=responsibility',
    '/politica-editorial': '/api/page?route=editorial',
  }

  for (const [source, destination] of Object.entries(expected)) {
    assert.equal(rewriteFor(source), destination, `${source} deve ter metadados SEO server-side`)
  }
})

test('renderer aplica canonical, hreflang e dados estruturados por página', () => {
  assert.ok(pageRenderer.includes('rel="canonical"'))
  assert.ok(pageRenderer.includes('hreflang="pt-BR"'))
  assert.ok(pageRenderer.includes('hreflang="x-default"'))
  assert.ok(pageRenderer.includes("'@type': 'BreadcrumbList'"))
  assert.ok(pageRenderer.includes("isPartOf: { '@id': `${SITE_ORIGIN}/#website` }"))
  assert.ok(pageRenderer.includes("about: { '@id': `${SITE_ORIGIN}/#organization` }"))
})

test('HTML server-side usa metadata específica sem canonical ou hreflang duplicado', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => indexHtml,
  }) as Response

  try {
    const cases = [
      { route: 'blog', path: '/blog', title: 'Blog — A Vida Não Colabora', schema: 'CollectionPage' },
      { route: 'pricing', path: '/planos', title: 'Planos — A Vida Não Colabora', schema: 'WebPage' },
      { route: 'about', path: '/sobre', title: 'Sobre — A Vida Não Colabora', schema: 'AboutPage' },
    ]

    for (const item of cases) {
      const res = createResponseRecorder()
      await pageHandler(
        { method: 'GET', query: { route: item.route }, headers: { host: 'localhost:3000' } },
        res,
      )

      assert.equal(res.statusCode, 200)
      assert.match(res.body, new RegExp(`<title>${item.title}</title>`))
      assert.ok(res.body.includes(`rel="canonical" href="https://www.avidanaocolabora.com${item.path}"`))
      assert.ok(res.body.includes(`hreflang="pt-BR" href="https://www.avidanaocolabora.com${item.path}"`))
      assert.ok(res.body.includes(`hreflang="x-default" href="https://www.avidanaocolabora.com${item.path}"`))
      assert.ok(res.body.includes(`"@type":"${item.schema}"`))
      assert.ok(res.body.includes('"@type":"BreadcrumbList"'))
      assert.equal((res.body.match(/rel="canonical"/g) ?? []).length, 1)
      assert.equal((res.body.match(/hreflang="pt-BR"/g) ?? []).length, 1)
      assert.equal((res.body.match(/hreflang="x-default"/g) ?? []).length, 1)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('aliases públicos redirecionam permanentemente para a rota oficial', () => {
  const aliases = new Map((vercelConfig.redirects ?? []).map(item => [item.source, item]))
  assert.deepEqual(aliases.get('/conteudos'), { source: '/conteudos', destination: '/blog', permanent: true })
  assert.deepEqual(aliases.get('/perguntas-frequentes'), { source: '/perguntas-frequentes', destination: '/faq', permanent: true })
})

test('artigos substituem canonical global inclusive no fallback e removem canonical em 404', () => {
  assert.ok(articleRenderer.includes('function applyCanonicalLinks'))
  assert.ok(articleRenderer.includes('setArticleFallbackHead(shell, slug)'))
  assert.ok(articleRenderer.includes("hreflang=[\"']pt-BR"))
  assert.ok(articleRenderer.includes("hreflang=[\"']x-default"))
  assert.match(articleRenderer, /setNotFoundHead[\s\S]*?rel=\["'\]canonical/)
})
