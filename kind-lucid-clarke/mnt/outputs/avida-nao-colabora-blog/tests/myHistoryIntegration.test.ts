import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const navigation = readFileSync(new URL('../src/lib/navigation.ts', import.meta.url), 'utf8')
const layout = readFileSync(new URL('../src/components/user/UserLayout.tsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/components/MyHistoryPage.tsx', import.meta.url), 'utf8')
const temporalPanel = readFileSync(new URL('../src/components/history/TemporalComparisonPanel.tsx', import.meta.url), 'utf8')

test('Minha História possui rota canônica própria e entra no shell logado', () => {
  assert.match(navigation, /'\/minha-historia':\s+'my-history'/)
  assert.match(app, /const MyHistoryPage = lazy/)
  assert.match(app, /view === 'my-history'/)
  assert.match(app, /goAuth\('my-history'\)/)
})

test('navegação expõe Minha História no grupo Entender sem alterar a barra principal mobile', () => {
  assert.match(layout, /label: 'Minha História'/)
  assert.match(layout, /\['my-evolution', 'my-report', 'my-history', 'articles', 'questionarios'\]/)
  assert.match(layout, /MOBILE_PRIMARY_IDS = \['home', 'diary', 'my-evolution', 'articles'\]/)
})

test('histórico completo respeita o entitlement oficial do Essencial', () => {
  assert.match(page, /hasPlanAccess\(plan, 'essential'\)/)
  assert.match(page, /Seu histórico completo começa no Essencial/)
})

test('marcos de relatório respeitam o plano atual e mensal permanece Plus', () => {
  assert.match(page, /const isPlus = plan === 'plus'/)
  assert.match(page, /isPlus \? reports : reports\.filter\(report => report\.report_type === 'weekly'\)/)
})

test('Minha História integra a comparação temporal sem criar uma rota ou persistência paralela', () => {
  assert.match(page, /buildTemporalComparison\(entries, \{ includeTriggers \}\)/)
  assert.match(page, /<TemporalComparisonPanel comparison=\{comparison\} \/>/)
  assert.doesNotMatch(page, /\.insert\(|\.upsert\(/)
})

test('linha do tempo consulta apenas sinais estruturados do Diário', () => {
  const select = page.match(/\.select\('([^']+)'\)/)?.[1] ?? ''
  const columns = select.split(',').map(column => column.trim()).filter(Boolean)
  assert.ok(columns.includes('mood'))
  assert.ok(columns.includes('energy'))
  assert.ok(columns.includes('anxiety_level'))
  assert.ok(columns.includes('sleep_quality'))
  assert.ok(columns.includes('emotional_tags'))
  assert.ok(columns.includes('context_tags'))
  assert.ok(columns.includes('need_tags'))
  assert.ok(columns.includes('trigger_tags'))
  assert.equal(columns.includes('text'), false)
  assert.equal(columns.includes('free_note'), false)
  assert.equal(columns.includes('notes'), false)
  assert.match(page, /Nenhum trecho do texto livre do Diário é exibido/)
})

test('comparação temporal usa linguagem observacional e explicita amostra pequena', () => {
  assert.match(temporalPanel, /Diferença não significa, por si só, melhora ou piora/)
  assert.match(temporalPanel, /Esta comparação ainda está se formando/)
  assert.match(temporalPanel, /pelo menos 3 dias registrados em cada período/)
  assert.doesNotMatch(temporalPanel, /você melhorou|você piorou|diagnóstico/i)
})
