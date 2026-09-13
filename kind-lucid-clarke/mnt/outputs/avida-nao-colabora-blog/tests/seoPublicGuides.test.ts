import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/page.js'

function createResponse() {
  const headers = new Map<string, string>()
  let statusCode = 200
  let body = ''
  return {
    setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value) },
    status(code: number) { statusCode = code; return this },
    end(value = '') { body = String(value); return this },
    snapshot() { return { headers, statusCode, body } },
  }
}

test('guias públicos só anunciam artigos realmente públicos no HTML e no JSON-LD', async () => {
  const originalFetch = globalThis.fetch
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-test-key'

  const publicSlug = 'como-comecar-um-diario-emocional-sem-saber-o-que-escrever'
  const closedSlug = 'como-identificar-padroes-nos-seus-registros-emocionais'
  const shell = '<!doctype html><html><head><title>App</title><meta name="description" content=""><meta name="robots" content=""><link rel="canonical" href=""><link rel="alternate" hreflang="pt-BR" href=""><link rel="alternate" hreflang="x-default" href=""><meta property="og:title" content=""><meta property="og:description" content=""><meta property="og:type" content=""><meta property="og:url" content=""><meta property="og:image" content=""><meta property="og:image:alt" content=""><meta name="twitter:card" content=""><meta name="twitter:title" content=""><meta name="twitter:description" content=""><meta name="twitter:image" content=""></head><body><div id="root"></div></body></html>'

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('/index.html')) return new Response(shell, { status: 200 })
    if (url.includes('/rest/v1/rpc/list_public_article_index')) {
      return new Response(JSON.stringify([
        { slug: publicSlug, title: 'Como começar um diário emocional', excerpt: 'Conteúdo público' },
      ]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    throw new Error(`unexpected fetch: ${url}`)
  }) as typeof fetch

  try {
    const req = {
      method: 'GET',
      query: { route: 'guides' },
      headers: { host: 'www.avidanaocolabora.com' },
    }
    const res = createResponse()

    await handler(req as never, res as never)
    const result = res.snapshot()

    assert.equal(result.statusCode, 200)
    assert.match(result.body, new RegExp(`/blog/${publicSlug}`))
    assert.doesNotMatch(result.body, new RegExp(`/blog/${closedSlug}`))
    assert.match(result.body, /"@type":"ItemList"/)
    assert.match(result.body, /Escolha por onde começar/)
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.VITE_SUPABASE_URL
    delete process.env.VITE_SUPABASE_ANON_KEY
  }
})
