import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// Achado na análise de SEO (set/2026): /author/…/ (com barra) devolvia 200 em vez de 410,
// slugs eram cortados no meio da palavra, e URL inventada devolvia 200 "index, follow".
test('vercel.json devolve 410 também para /author/x/ e lixo de WordPress', () => {
  const cfg = JSON.parse(read('vercel.json')) as { rewrites: { source: string; destination: string }[] }
  for (const s of ['/author/(.*)', '/wp-content/(.*)', '/wp-admin/(.*)', '/wp-login.php', '/xmlrpc.php']) {
    assert.ok(cfg.rewrites.some(r => r.source === s && r.destination === '/api/gone'), `falta 410 para ${s}`)
  }
  const gone = cfg.rewrites.findIndex(r => r.destination === '/api/gone')
  const catchAll = cfg.rewrites.findIndex(r => r.destination === '/index.html')
  assert.ok(gone < catchAll, 'as regras 410 precisam vir antes do catch-all do SPA')
})

test('normalizedSlug corta em fronteira de palavra', () => {
  const src = read('src/lib/seoSmartCorrector.ts')
  assert.match(src, /full\.length <= 60/)
  assert.match(src, /lastIndexOf\('-'\)/)
})

test('rota desconhecida ganha noindex antes de ir para o Início', () => {
  const src = read('src/App.tsx')
  assert.match(src, /canonical === '\/' && !parseURLNav\(\)/)
  assert.match(src, /noindex, follow/)
})
