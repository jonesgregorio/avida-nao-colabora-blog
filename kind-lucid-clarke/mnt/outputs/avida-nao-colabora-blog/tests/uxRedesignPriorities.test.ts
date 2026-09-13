import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const layout = readFileSync(new URL('../src/components/user/UserLayout.tsx', import.meta.url), 'utf8')
const home = readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8')
const articles = readFileSync(new URL('../src/components/Articles.tsx', import.meta.url), 'utf8')
const history = readFileSync(new URL('../src/components/MyHistoryPage.tsx', import.meta.url), 'utf8')
const reportsHome = readFileSync(new URL('../src/components/ReportsHome.tsx', import.meta.url), 'utf8')

test('prioridades 1-3: navegação consolida Evolução, Cuidar e Menu no mobile', () => {
  assert.match(layout, /label: 'Evolução'/)
  assert.match(layout, /label: 'Cuidar'/)
  assert.match(layout, /Recursos e conta/)
  assert.match(layout, /const EVOLUTION_TABS/)
  assert.match(layout, /const CARE_TABS/)
  assert.doesNotMatch(layout, />Mais\s*<\/button>/)
})

test('prioridades 4-6: cada eixo ganha propósito textual próprio e Hoje reduz competição entre cards', () => {
  assert.match(layout, /Padrões, sinais e conexões percebidos nos seus registros/)
  assert.match(layout, /Veja como seus sinais mudam ao longo do tempo/)
  assert.match(layout, /Fechamentos semanais e mensais/)
  assert.match(home, /Registrar → entender → cuidar → cultivar/)
  assert.match(home, /divide-y divide-line border-y border-line/)
  assert.match(home, /Para onde faz sentido seguir\?/)
})

test('prioridade 7: Conteúdos diferencia Biblioteca, Continuar e Praticar', () => {
  assert.match(articles, /type LibraryMode = 'all' \| 'continue' \| 'practice'/)
  assert.match(articles, /fetchGuidedCatalog\(\)/)
  assert.match(articles, /RecommendedContent/)
  assert.match(articles, /\['continue', 'Continuar', History\]/)
  assert.match(articles, /\['practice', 'Praticar', PlayCircle\]/)
  assert.match(articles, /readingHistoryKey/)
  assert.match(articles, /Leituras que você já iniciou/)
  assert.match(articles, /Prática guiada/)
})

test('prioridade 8: Minha História mantém timeline editorial e resumo anual', () => {
  assert.match(history, /Linha do tempo/)
  assert.match(history, /Sua trajetória em ordem cronológica/)
  assert.match(history, /border-l/)
  assert.match(history, /Resumo por ano/)
  assert.match(layout, /label: 'Minha História'/)
})

test('Plano de Autocuidado aparece por nome completo e mostra o ciclo real de uso', () => {
  assert.match(layout, /label: 'Plano de Autocuidado'/)
  assert.match(layout, /Foco do ciclo/)
  assert.match(layout, /Escolha ações/)
  assert.match(layout, /Adapte sem culpa/)
  assert.match(layout, /Dê retorno/)
})

test('Relatórios deixam explícita a diferença entre semanal e mensal', () => {
  assert.match(reportsHome, /Ritmo recente/)
  assert.match(reportsHome, /Visão aprofundada/)
  assert.match(reportsHome, /Como foram meus últimos dias\?/)
  assert.match(reportsHome, /O que se repetiu, mudou e se conectou neste mês\?/)
  assert.match(reportsHome, /Até 3 destaques e 1 ponto para observar/)
  assert.match(reportsHome, /Trajetória, gráficos e leitura aprofundada/)
})

test('redesign não introduz alteração direta no componente Jardim', () => {
  assert.doesNotMatch(layout, /from '\.\.\/MyGardenPage'/)
  assert.doesNotMatch(home, /from '\.\/MyGardenPage'/)
  assert.doesNotMatch(articles, /MyGardenPage/)
})
