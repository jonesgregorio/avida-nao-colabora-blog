import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const vercelUrl = new URL('../vercel.json', import.meta.url)
const indexUrl = new URL('../index.html', import.meta.url)
const appUrl = new URL('../src/App.tsx', import.meta.url)

test('assets versionados usam cache longo e imutável sem cachear o HTML globalmente', () => {
  const config = JSON.parse(fs.readFileSync(vercelUrl, 'utf8')) as {
    headers?: Array<{ source?: string; headers?: Array<{ key?: string; value?: string }> }>
  }

  const assetRule = config.headers?.find(rule => rule.source === '/assets/(.*)')
  const cacheHeader = assetRule?.headers?.find(header => header.key?.toLowerCase() === 'cache-control')

  assert.ok(cacheHeader, 'faltou Cache-Control específico para /assets/*')
  assert.match(cacheHeader.value ?? '', /max-age=31536000/)
  assert.match(cacheHeader.value ?? '', /immutable/)

  const globalRule = config.headers?.find(rule => rule.source === '/(.*)')
  const globalCache = globalRule?.headers?.find(header => header.key?.toLowerCase() === 'cache-control')
  assert.equal(globalCache, undefined, 'HTML/rotas não devem receber cache imutável global')
})

test('HTML antecipa a conexão com o Supabase usado no bootstrap da sessão', () => {
  const html = fs.readFileSync(indexUrl, 'utf8')

  assert.match(html, /rel="preconnect" href="https:\/\/lejvvhzluggyxlfwfoxl\.supabase\.co" crossorigin/)
  assert.match(html, /rel="dns-prefetch" href="\/\/lejvvhzluggyxlfwfoxl\.supabase\.co"/)
})

test('páginas pesadas continuam com carregamento sob demanda', () => {
  const app = fs.readFileSync(appUrl, 'utf8')

  for (const component of ['DiaryPage', 'MyReportPage', 'MyEvolutionPage', 'SelfCarePlanPage', 'AdminPanel']) {
    assert.match(app, new RegExp(`const ${component} = lazy\\(`), `${component} deixou de usar lazy loading`)
  }
})
