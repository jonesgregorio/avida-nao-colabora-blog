import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// §21 da MISSÃO GERAL (performance): o Admin lazy-carrega corretamente.
// Listas administrativas que precisam representar o conjunto completo usam
// paginação explícita, evitando tanto consultas sem teto quanto cortes silenciosos.

test('App.tsx carrega o AdminPanel sob demanda (React.lazy), não no bundle principal', () => {
  const app = read('src/App.tsx')
  assert.match(app, /const AdminPanel = lazy\(\(\) => import\('\.\/components\/admin'\)\)/)
})

test('AdminArticles pagina a lista completa em vez de cortar em um limite fixo', () => {
  const src = read('src/components/admin/AdminArticles.tsx')
  const loadFn = src.match(/async function load\(\)[\s\S]*?\n {2}\}/)?.[0] ?? ''
  assert.notEqual(loadFn, '', 'não encontrou load()')
  assert.match(loadFn, /collectAllPages<Article>/)
  assert.match(loadFn, /\.range\(from, to\)/)
  assert.doesNotMatch(loadFn, /\.limit\(2000\)/)
})

test('Newsletter e Notificações também não escondem registros por limite silencioso', () => {
  const newsletter = read('src/components/admin/AdminNewsletter.tsx')
  const notifications = read('src/components/admin/AdminNotifications.tsx')
  assert.match(newsletter, /collectAllPages<Subscriber>/)
  assert.doesNotMatch(newsletter, /\.limit\(500\)/)
  assert.match(notifications, /collectAllPages<Notification>/)
  assert.match(notifications, /loadTargetUsers/)
  assert.doesNotMatch(notifications, /\.limit\(100\)/)
})

test('demais telas de contagem completa não usam tetos arbitrários', () => {
  const files = [
    'src/components/admin/AdminCancellations.tsx',
    'src/components/admin/AdminGuidanceRequests.tsx',
    'src/components/admin/AdminSEOCockpit.tsx',
    'src/components/admin/AdminFinanceiro.tsx',
    'src/components/admin/AdminPerformanceEditorial.tsx',
    'src/components/admin/AdminConversionFunnel.tsx',
  ]
  for (const file of files) {
    const src = read(file)
    assert.match(src, /collectAllPages</, `${file} deve paginar o conjunto completo`)
  }

  assert.doesNotMatch(read('src/components/admin/AdminCancellations.tsx'), /\.limit\(300\)/)
  assert.doesNotMatch(read('src/components/admin/AdminGuidanceRequests.tsx'), /\.limit\(300\)/)
  assert.doesNotMatch(read('src/components/admin/AdminSEOCockpit.tsx'), /\.limit\(500\)/)
  assert.doesNotMatch(read('src/components/admin/AdminFinanceiro.tsx'), /\.limit\((1000|2000|5000)\)/)
  assert.doesNotMatch(read('src/components/admin/AdminPerformanceEditorial.tsx'), /\.limit\((1000|20000|50000)\)/)
  assert.doesNotMatch(read('src/components/admin/AdminConversionFunnel.tsx'), /\.limit\(50000\)/)
})

