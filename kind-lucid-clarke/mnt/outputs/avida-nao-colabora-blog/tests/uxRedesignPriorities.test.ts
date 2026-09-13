import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const layout = readFileSync(new URL('../src/components/user/UserLayout.tsx', import.meta.url), 'utf8')
const home = readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8')
const articles = readFileSync(new URL('../src/components/Articles.tsx', import.meta.url), 'utf8')
const history = readFileSync(new URL('../src/components/MyHistoryPage.tsx', import.meta.url), 'utf8')

test('prioridades 1-3: navegação consolida Evolução, Cuidar e Menu no mobile', () => {
  assert.match(layout, /label: 'Evolução'/)
  assert.match(layout, /label: 'Cuidar'/)
  assert.match(layout, /Recursos e conta/)
  assert.match(layout, /const EVOLUTION_TABS/)
  assert.match(layout, /const CARE_TABS/)
  assert.doesNotMatch(layout, />Mais\s*<\/button>/)
})

test('prioridades 4-6: cada eixo ganha propósito textual próprio e Hoje reduz competição entre cards', () => {
  assert.match(layout, /Padrões e conexões percebidos nos seus registros/)
  assert.match(layout, /Veja como seus sinais mudam ao longo do tempo/)
  assert.match(layout, /Fechamentos semanais e mensais/)
  assert.match(home, /Registrar → entender → cuidar → cultivar/)
  assert.match(home, /divide-y divide-line border-y border-line/)
  assert.match(home, /Para onde faz sentido seguir\?/)
})

test('prioridade 7: biblioteca separa leitura de prática sem trocar o motor de recomendação', () => {
  assert.match(articles, /type LibraryMode = 'all' \| 'read' \| 'practice'/)
  assert.match(articles, /fetchGuidedCatalog\(\)/)
  assert.match(articles, /RecommendedContent/)
  assert.match(articles, /\['read', 'Ler', BookOpen\]/)
  assert.match(articles, /\['practice', 'Praticar', PlayCircle\]/)
  assert.match(articles, /Prática guiada/)
})

test('prioridade 8: Minha História mantém timeline editorial e resumo anual', () => {
  assert.match(history, /Linha do tempo/)
  assert.match(history, /Sua trajetória em ordem cronológica/)
  assert.match(history, /border-l/)
  assert.match(history, /Resumo por ano/)
})

test('redesign não introduz alteração direta no componente Jardim', () => {
  assert.doesNotMatch(layout, /from '\.\.\/MyGardenPage'/)
  assert.doesNotMatch(home, /from '\.\/MyGardenPage'/)
  assert.doesNotMatch(articles, /MyGardenPage/)
})
