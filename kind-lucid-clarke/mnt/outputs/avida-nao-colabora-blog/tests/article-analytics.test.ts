import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const component = read('src/components/admin/AdminArticleAnalytics.tsx')
const wrapper = read('src/components/admin/AnalyticsPage.tsx')
const article = read('src/components/ArticleView.tsx')

test('Analytics de conteúdo inclui painel dedicado de artigos', () => {
  assert.match(wrapper, /AdminArticleAnalytics/)
  assert.match(wrapper, /<Card pad><AdminArticleAnalytics \/><\/Card>/)
})

test('Painel exibe métricas essenciais por artigo', () => {
  for (const label of ['Visualizações de artigos', 'Leitores únicos', 'Chegaram ao fim', 'Clicaram após ler', 'Cadastros após leitura']) {
    assert.match(component, new RegExp(label))
  }
  for (const event of ['article_view', 'article_scroll_50', 'article_scroll_75', 'article_scroll_100', 'cta_click', 'registration_complete']) {
    assert.match(component, new RegExp(event))
  }
})

test('Profundidade de leitura já é emitida pelo ArticleView', () => {
  assert.match(article, /for \(const mark of \[50, 75, 100\]\)/)
  assert.match(article, /trackEvent\(`scroll_\$\{mark\}`/)
})

test('Cadastro após leitura é atribuído somente dentro da mesma sessão', () => {
  assert.match(component, /const sessions = new Map<string, Ev\[\]>/)
  assert.match(component, /if \(e\.event === 'article_view'/)
  assert.match(component, /if \(e\.event === 'registration_complete'\)/)
  assert.match(component, /registrationSessions\.get\(currentArticle\)!\.add\(sessionId\)/)
})
