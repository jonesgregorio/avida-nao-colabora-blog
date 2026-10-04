import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectResponse } from '../api/seo-audit.js'
import fallback, { isAppRoute } from '../api/app-fallback.js'

test('auditoria diferencia URLs inexistentes de páginas públicas e privadas', () => {
  assert.equal(inspectResponse('/pagina-inexistente-auditoria-seo', 200, '').at(0)?.code, 'soft404')
  assert.deepEqual(inspectResponse('/pagina-inexistente-auditoria-seo', 404, ''), [])
  assert.equal(inspectResponse('/login', 200, '<meta name="robots" content="index,follow">', 'noindex').at(0)?.code, 'robots_conflict')
  assert.deepEqual(inspectResponse('/admin', 200, '<meta name="robots" content="noindex">', 'noindex'), [])
})
test('auditoria inspeciona HTML entregue, links e dimensões herdadas', () => {
  const html = '<title>Artigo</title><meta name="description" content="Descrição"><link rel="canonical" href="https://www.avidanaocolabora.com/blog/exemplo"><h1>Artigo</h1>BlogPosting<meta property="og:image:width" content="512">'
  assert.deepEqual(inspectResponse('/blog/exemplo', 200, html).map(i => i.code), ['image_dimensions'])
  assert.ok(inspectResponse('/guias/exemplo', 200, html + 'Abrir leitura relacionada').some(i => i.code === 'generic_links'))
})
test('fallback preserva rotas privadas e aliases, mas devolve 404 real em URL desconhecida', async () => {
  for (const path of ['/login', '/admin', '/orientacao', '/suporte/ticket', '/questionarios/abc']) assert.equal(isAppRoute(path), true)
  assert.equal(isAppRoute('/pagina-inventada'), false)
  let status = 0
  const response = { setHeader() {}, status(code: number) { status = code; return this }, end() {} }
  await fallback({ method: 'GET', query: { path: 'pagina-inventada' } } as never, response as never)
  assert.equal(status, 404)
})
