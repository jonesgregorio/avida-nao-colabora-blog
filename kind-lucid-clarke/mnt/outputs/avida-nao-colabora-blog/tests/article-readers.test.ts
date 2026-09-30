import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const component = read('src/components/admin/AdminArticleReaders.tsx')
const wrapper = read('src/components/admin/AnalyticsPage.tsx')
const csv = read('src/lib/csvExport.ts')

test('Analytics de conteúdo inclui painel de leitores', () => {
  assert.match(wrapper, /AdminArticleReaders/)
  assert.match(wrapper, /<Card pad><AdminArticleReaders \/><\/Card>/)
})

test('painel de leitores possui filtros e paginação configurável', () => {
  assert.match(component, /Últimas 24h/)
  assert.match(component, /Todos os leitores/)
  assert.match(component, /Só cadastrados/)
  assert.match(component, /Só anônimos/)
  assert.match(component, /Todos os artigos/)
  assert.match(component, /Buscar usuário ou artigo/)
  assert.match(component, /PAGE_SIZE_OPTIONS = \[10, 20, 50, 100\]/)
  assert.match(component, /setPageSize/)
  assert.match(component, /Por página/)
  assert.match(component, /Anterior/)
  assert.match(component, /Próxima/)
})

test('leitores exportam todos os resultados filtrados em CSV, não só a página atual', () => {
  assert.match(component, /Exportar CSV/)
  assert.match(component, /exportCsv/)
  assert.match(component, /filtered\.map/)
  assert.doesNotMatch(component, /visible\.map\(r => \[r\.readerName/)
  assert.match(csv, /\uFEFF/)
  assert.match(csv, /replace\(\/"\/g, '\"\"'\)/)
})

test('identificação nominal depende de user_id autenticado', () => {
  assert.match(component, /e\.user_id \? `user:/)
  assert.match(component, /Visitante anônimo/)
  assert.match(component, /Usuário cadastrado/)
  assert.match(component, /preferred_name/)
  assert.match(component, /display_name/)
  assert.match(component, /full_name/)
})

test('histórico usa eventos de leitura e profundidade já existentes', () => {
  assert.match(component, /article_view/)
  assert.match(component, /article_scroll_50/)
  assert.match(component, /article_scroll_75/)
  assert.match(component, /article_scroll_100/)
  assert.match(component, /maxProgress/)
  assert.match(component, /lastReadAt/)
})

test('painel não consulta conteúdo sensível', () => {
  assert.doesNotMatch(component, /diary_entries|checkins|questionnaire_responses|journal|emotion_score/)
})
