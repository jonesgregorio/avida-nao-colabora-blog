import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deriveMonthlyTrends, computeEmotionalAnalysis, type DiaryRowLite } from '../src/lib/emotionalAnalytics.ts'

const mockup = readFileSync(new URL('../src/components/MonthlyDeepReportMockup.tsx', import.meta.url), 'utf8')
const generation = readFileSync(new URL('../src/lib/reportGeneration.ts', import.meta.url), 'utf8')

function entriesFor(dates: string[], mood: string, tags: string[] = []): DiaryRowLite[] {
  return dates.map(date => ({ date, entry_type: 'diary', mood, emotional_tags: tags }))
}

test('sinal ausente no mês anterior e presente agora conta como "fortaleceu"', () => {
  const current = computeEmotionalAnalysis(entriesFor(['2026-09-01', '2026-09-02', '2026-09-03'], 'Ansiedade'))
  const previous = computeEmotionalAnalysis(entriesFor(['2026-08-01'], 'Tranquilidade'))
  const trends = deriveMonthlyTrends(current, previous)
  const ansiedade = trends.find(t => t.label === 'Ansiedade')
  assert.ok(ansiedade)
  assert.equal(ansiedade.trend, 'fortaleceu')
  assert.equal(ansiedade.previousCount, 0)
})

test('sinal forte no mês anterior e ausente agora conta como "enfraqueceu"', () => {
  const current = computeEmotionalAnalysis(entriesFor(['2026-09-01'], 'Tranquilidade'))
  const previous = computeEmotionalAnalysis(entriesFor(['2026-08-01', '2026-08-02', '2026-08-03'], 'Sobrecarga'))
  const trends = deriveMonthlyTrends(current, previous)
  const sobrecarga = trends.find(t => t.label === 'Sobrecarga')
  assert.ok(sobrecarga)
  assert.equal(sobrecarga.trend, 'enfraqueceu')
  assert.equal(sobrecarga.currentCount, 0)
})

test('sinal com frequência parecida nos dois meses conta como "manteve"', () => {
  const current = computeEmotionalAnalysis(entriesFor(['2026-09-01', '2026-09-02'], 'Cansaço'))
  const previous = computeEmotionalAnalysis(entriesFor(['2026-08-01', '2026-08-02'], 'Cansaço'))
  const trends = deriveMonthlyTrends(current, previous)
  const cansaco = trends.find(t => t.label === 'Cansaço')
  assert.ok(cansaco)
  assert.equal(cansaco.trend, 'manteve')
})

test('nunca inventa um sinal que não apareceu no top-3 de nenhum dos dois meses', () => {
  const current = computeEmotionalAnalysis(entriesFor(['2026-09-01'], 'Ansiedade', ['sobrecarga']))
  const previous = computeEmotionalAnalysis(entriesFor(['2026-08-01'], 'Tristeza', ['cobrança']))
  const trends = deriveMonthlyTrends(current, previous)
  for (const t of trends) assert.ok(t.currentCount > 0 || t.previousCount > 0, `sinal "${t.label}" sem contagem em nenhum mês`)
})

test('buildMonthlyContent só preenche monthlyTrends quando existe análise do mês anterior', () => {
  assert.match(generation, /monthlyTrends: previousAnalysis \? deriveMonthlyTrends\(analysis, previousAnalysis\) : undefined/)
  assert.match(generation, /const previousAnalysis = prevEntries\.length \? computeEmotionalAnalysis\(prevEntries, \[\]\) : undefined/)
})

test('Relatório Mensal mostra o rótulo de tendência real quando disponível, e cai no heurístico antigo quando não', () => {
  assert.match(mockup, /const monthlyTrends=c\.monthlyTrends\?\?\[\]/)
  assert.match(mockup, /O que mudou de força em relação ao mês anterior/)
  assert.match(mockup, /Fortaleceu/)
  assert.match(mockup, /Enfraqueceu/)
  assert.match(mockup, /Manteve-se/)
  // fallback antigo continua no código pra relatórios sem monthlyTrends (histórico)
  assert.match(mockup, /Também observado antes/)
})
