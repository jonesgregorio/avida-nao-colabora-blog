import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import pageHandler from '../api/page.js'
import articleHandler from '../api/article.js'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

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

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

test('renderers SEO usam o host recebido antes de VERCEL_URL e preservam cookie', async () => {
  const originalFetch = globalThis.fetch
  const originalVercelUrl = process.env.VERCEL_URL
  const originalSupabaseUrl = process.env.VITE_SUPABASE_URL
  const originalSupabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  const calls: Array<{ url: string; headers?: HeadersInit }> = []

  process.env.VERCEL_URL = 'deployment-protegido.vercel.app'
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-test-key'

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, headers: init?.headers })

    if (url === 'https://www.avidanaocolabora.com/index.html') {
      return { ok: true, text: async () => indexHtml } as Response
    }

    if (url === 'https://example.supabase.co/rest/v1/rpc/get_public_article_seo') {
      return {
        ok: true,
        json: async () => [{ title: 'Artigo de teste', summary: 'Resumo de teste' }],
      } as Response
    }

    throw new Error(`fetch inesperado: ${url}`)
  }

  try {
    const headers = {
      host: 'www.avidanaocolabora.com',
      cookie: '_vercel_sso_nonce=preview-cookie',
    }

    const pageRes = createResponseRecorder()
    await pageHandler({ method: 'GET', query: { route: 'blog' }, headers }, pageRes)
    assert.equal(pageRes.statusCode, 200)

    const articleRes = createResponseRecorder()
    await articleHandler(
      {
        method: 'GET',
        query: { slug: 'como-perceber-ciclos-que-se-repetem-ao-longo-do-mes' },
        headers,
      },
      articleRes,
    )
    assert.equal(articleRes.statusCode, 200)

    const shellCalls = calls.filter((call) => call.url.endsWith('/index.html'))
    assert.equal(shellCalls.length, 2)
    for (const call of shellCalls) {
      assert.equal(call.url, 'https://www.avidanaocolabora.com/index.html')
      const requestHeaders = call.headers as Record<string, string>
      assert.equal(requestHeaders.cookie, '_vercel_sso_nonce=preview-cookie')
    }

    assert.equal(calls.some((call) => call.url.includes('deployment-protegido.vercel.app')), false)
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv('VERCEL_URL', originalVercelUrl)
    restoreEnv('VITE_SUPABASE_URL', originalSupabaseUrl)
    restoreEnv('VITE_SUPABASE_ANON_KEY', originalSupabaseKey)
  }
})
