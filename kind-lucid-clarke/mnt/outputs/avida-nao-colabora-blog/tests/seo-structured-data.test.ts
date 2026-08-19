import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const pageRenderer = readFileSync(new URL('../api/page.js', import.meta.url), 'utf8')
const vercelConfig = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
) as {
  rewrites?: Array<{ source?: string; destination?: string }>
}

function rewriteFor(source: string) {
  return vercelConfig.rewrites?.find((rewrite) => rewrite.source === source)?.destination ?? ''
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
    '/blog': '/api/page?route=blog',
    '/conteudos': '/api/page?route=blog',
    '/planos': '/api/page?route=pricing',
    '/faq': '/api/page?route=faq',
    '/perguntas-frequentes': '/api/page?route=faq',
    '/sobre': '/api/page?route=about',
    '/contato': '/api/page?route=contact',
    '/privacidade': '/api/page?route=privacy',
    '/termos': '/api/page?route=terms',
    '/aviso-de-responsabilidade': '/api/page?route=responsibility',
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

test('aliases públicos apontam canonical para a rota oficial', () => {
  assert.match(pageRenderer, /blog:\s*\{[\s\S]*?path: '\/blog'/)
  assert.match(pageRenderer, /faq:\s*\{[\s\S]*?path: '\/faq'/)
})
