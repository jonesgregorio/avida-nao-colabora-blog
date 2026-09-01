import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildMapComparisonSnapshot, buildMapComparisonText } from '../src/lib/mapPeriodComparison.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('P3.21 calcula médias por dia para não inflar dias com vários registros', () => {
  const snapshot = buildMapComparisonSnapshot([
    { date: '2026-07-02', created_at: '2026-07-02T08:00:00Z', mood_score: 1, energy: 2, anxiety_level: 5, sleep_quality: 2, emotional_tags: ['ansioso'] },
    { date: '2026-07-02', created_at: '2026-07-02T20:00:00Z', mood_score: 5, energy: 4, anxiety_level: 3, sleep_quality: 4, emotional_tags: ['ansioso', 'cansado'] },
    { date: '2026-07-10', created_at: '2026-07-10T10:00:00Z', mood_score: 5, energy: 5, anxiety_level: 1, sleep_quality: 5, emotional_tags: ['leve'] },
  ])

  assert.equal(snapshot.totalEntries, 3)
  assert.equal(snapshot.activeDays, 2)
  assert.equal(snapshot.avgMood, 4)
  assert.equal(snapshot.avgEnergy, 4)
  assert.equal(snapshot.avgAnxiety, 2.5)
  assert.equal(snapshot.avgSleep, 4)
  assert.deepEqual(snapshot.topEmotion, { label: 'ansioso', count: 2 })
})

test('P3.21 resumo textual descreve diferenças sem chamar variação de melhora ou piora', () => {
  const first = buildMapComparisonSnapshot([
    { date: '2026-05-01', mood_score: 2, energy: 2, anxiety_level: 4, sleep_quality: 2, emotional_tags: ['cansado'] },
  ])
  const second = buildMapComparisonSnapshot([
    { date: '2026-08-01', mood_score: 4, energy: 3, anxiety_level: 2, sleep_quality: 3, emotional_tags: ['leve'] },
  ])
  const text = buildMapComparisonText(first, second, 'Maio de 2026', 'Agosto de 2026')

  assert.match(text, /Maio de 2026/)
  assert.match(text, /Agosto de 2026/)
  assert.match(text, /2\.0 pontos acima/)
  assert.match(text, /não significam melhora ou piora/)
  assert.match(text, /não são diagnóstico/)
})

test('P3.21 oferece dois meses independentes e alternativa textual acessível no Explorar Essencial', () => {
  const component = read('src/components/FreeMapComparison.tsx')
  const wrapper = read('src/components/MyEvolutionPage.tsx')

  assert.equal((component.match(/type="month"/g) ?? []).length, 2)
  assert.match(component, /Primeiro período/)
  assert.match(component, /Segundo período/)
  assert.match(component, /<table/)
  assert.match(component, /<caption className="sr-only">/)
  assert.match(component, /Resumo da comparação em texto/)
  assert.match(component, /aria-live="polite"/)
  assert.match(component, /O texto livre do Diário não é lido aqui/)

  assert.match(wrapper, /isEssential && user/)
  assert.match(wrapper, /<FreeMapComparison userId=\{user\.id\} \/>/)
})
