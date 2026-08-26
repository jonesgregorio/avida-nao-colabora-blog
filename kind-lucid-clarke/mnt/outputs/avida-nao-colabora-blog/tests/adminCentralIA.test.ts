import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('AdminAIUsage não é mais renderizado em duas áreas do Admin — só em IA Emocional', () => {
  const conteudo = read('src/components/admin/AdminAreaConteudo.tsx')
  const emocional = read('src/components/admin/AdminAreaEmocional.tsx')
  assert.doesNotMatch(conteudo, /AdminAIUsage/)
  assert.match(emocional, /<AdminAIUsage \/>/)
})

test('Conteúdo & IA linka para a Central de IA em vez de duplicar a tela', () => {
  const conteudo = read('src/components/admin/AdminAreaConteudo.tsx')
  assert.match(conteudo, /onOpenCentralIA/)
  const index = read('src/components/admin/index.tsx')
  assert.match(index, /localStorage\.setItem\('admin-emocional-tab', 'uso-ia'\)/)
})

test('Central de IA continua unificando editorial e emocional sobre a mesma tabela', () => {
  const src = read('src/components/admin/AdminAIUsage.tsx')
  assert.match(src, /Central de IA/)
  assert.match(src, /const EMOTIONAL_TYPES = new Set\(/)
  assert.match(src, /category !== 'todos' && categoryOf\(log\.content_type\) !== category/)
  assert.match(src, /\.from\('ai_generation_logs'\)/)
})

test('Central de IA oferece filtros por tipo, provedor, status, data e busca', () => {
  const src = read('src/components/admin/AdminAIUsage.tsx')
  for (const state of ['logQuery', 'contentTypeFilter', 'providerFilter', 'statusFilter', 'dateFrom', 'dateTo']) {
    assert.match(src, new RegExp(`const \\[${state}, set`))
  }
  assert.match(src, /contentTypeFilter !== 'todos' && log\.content_type !== contentTypeFilter/)
  assert.match(src, /providerFilter !== 'todos' && log\.provider !== providerFilter/)
  assert.match(src, /statusFilter !== 'todos' && log\.status !== statusFilter/)
  assert.match(src, /dateInRange\(log\.created_at, dateFrom, dateTo\)/)
  assert.match(src, /haystack\.includes\(normalizedQuery\)/)
  assert.match(src, /type="date" value=\{dateFrom\}/)
  assert.match(src, /type="date" value=\{dateTo\}/)
})

test('busca de logs permanece separada da busca de usuário do diagnóstico', () => {
  const src = read('src/components/admin/AdminAIUsage.tsx')
  assert.match(src, /const \[logQuery, setLogQuery\]/)
  assert.match(src, /const \[userQuery, setUserQuery\]/)
  assert.match(src, /const term = userQuery\.trim\(\)/)
  assert.match(src, /const normalizedQuery = logQuery\.trim\(\)/)
})

test('tabela, cartões e CSV usam a mesma lista filtrada', () => {
  const src = read('src/components/admin/AdminAIUsage.tsx')
  assert.match(src, /const ok = visibleLogs\.filter/)
  assert.match(src, /const fallbackCount = visibleLogs\.filter/)
  assert.match(src, /visibleLogs\.forEach\(l => push/)
  assert.match(src, /\{visibleLogs\.map\(l =>/)
})
