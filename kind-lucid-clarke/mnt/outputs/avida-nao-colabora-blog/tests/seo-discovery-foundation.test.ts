import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import pageHandler from '../api/page.js'
import articleHandler from '../api/article.js'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const indexHtml = read('index.html')

function responseRecorder() {
  return {
    statusCode: 200,
    headers: new Map<string, string>(),
    body: '',
    setHeader(key: string, value: string) { this.headers.set(key.toLowerCase(), value) },
    status(code: number) { this.statusCode = code; return this },
    end(value = '') { this.body = String(value); return this },
  }
}

test('páginas públicas entregam conteúdo sem depender da execução do JavaScript', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, text: async () => indexHtml }) as Response
  try {
    for (const [route, heading] of [
      ['home', 'Um lugar para se organizar por dentro nos dias difíceis'],
      ['guides', 'Guias essenciais para cuidar da vida emocional'],
      ['editorial', 'Política editorial'],
    ]) {
      const res = responseRecorder()
      await pageHandler({ method: 'GET', query: { route }, headers: { host: 'localhost:3000' } }, res)
      assert.equal(res.statusCode, 200)
      assert.match(res.body, new RegExp(`<h1>${heading}</h1>`))
      assert.doesNotMatch(res.body, /<div id="root"><\/div>/)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('artigo público inclui corpo, autoria, breadcrumb e BlogPosting no HTML inicial', async () => {
  const originalFetch = globalThis.fetch
  const originalUrl = process.env.VITE_SUPABASE_URL
  const originalKey = process.env.VITE_SUPABASE_ANON_KEY
  process.env.VITE_SUPABASE_URL = 'https://seo.test'
  process.env.VITE_SUPABASE_ANON_KEY = 'anon'
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.endsWith('/index.html')) return { ok: true, text: async () => indexHtml } as Response
    if (url.endsWith('/rpc/get_public_article_document')) return {
      ok: true,
      json: async () => [{
        slug: 'diario-emocional', title: 'Diário emocional', seo_title: 'Diário emocional: como começar',
        seo_description: 'Um guia simples para começar um diário emocional e observar sentimentos com mais clareza e menos cobrança.',
        summary: 'Aprenda a começar um diário emocional.', content: '## Primeiro passo\nEscreva uma frase sobre o seu dia.',
        author: 'Equipe editorial A Vida Não Colabora', category: 'Diário emocional', plan_required: 'free',
        published_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-10T00:00:00Z', related_slugs: ['check-in-emocional'],
      }],
    } as Response
    throw new Error(`URL inesperada: ${url}`)
  }
  try {
    const res = responseRecorder()
    await articleHandler({ method: 'GET', query: { slug: 'diario-emocional' }, headers: { host: 'localhost:3000' } }, res)
    assert.equal(res.statusCode, 200)
    assert.match(res.body, /<h1>Diário emocional<\/h1>/)
    assert.match(res.body, /<h2>Primeiro passo<\/h2>/)
    assert.match(res.body, /"@type":"BlogPosting"/)
    assert.match(res.body, /"@type":"BreadcrumbList"/)
    assert.match(res.body, /Equipe editorial A Vida Não Colabora/)
  } finally {
    globalThis.fetch = originalFetch
    if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY; else process.env.VITE_SUPABASE_ANON_KEY = originalKey
  }
})

test('conteúdo fechado não expõe corpo nem entra no sitemap público', () => {
  const migration = read('supabase/migrations/20260912235500_public_seo_documents.sql')
  assert.match(migration, /when coalesce\(a\.plan_required, 'free'\) = 'free' then a\.content/i)
  assert.match(migration, /list_public_article_sitemap[\s\S]*?coalesce\(a\.plan_required, 'free'\) = 'free'/i)
  assert.doesNotMatch(migration, /plan_required, 'free'\) in \('free', 'account'\)/i)
})

test('rotas privadas e endpoints internos recebem X-Robots-Tag', () => {
  const vercel = read('vercel.json')
  assert.match(vercel, /X-Robots-Tag/)
  assert.match(vercel, /noindex, nofollow, noarchive/)
  assert.match(read('src/lib/pageTitles.ts'), /publicMeta \? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive'/)
})

test('guias e política editorial têm navegação pública e entram no sitemap', () => {
  const navigation = read('src/lib/navigation.ts')
  const sitemap = read('api/sitemap.js')
  assert.match(navigation, /'\/guias':\s+'guides'/)
  assert.match(navigation, /'\/politica-editorial':\s+'editorial-policy'/)
  assert.match(sitemap, /path: '\/guias'/)
  assert.match(sitemap, /path: '\/politica-editorial'/)
})
