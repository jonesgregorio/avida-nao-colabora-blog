import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEmotionalDrilldown, listDrilldownEmotions } from '../src/lib/emotionalDrilldown.ts'

function entry(date: string, overrides: Record<string, unknown> = {}) {
  return {
    date,
    created_at: `${date}T12:00:00Z`,
    mood: 'Tranquilidade',
    energy: 3,
    anxiety_level: 3,
    sleep_quality: 3,
    emotional_tags: [],
    context_tags: [],
    need_tags: [],
    care_action_tags: [],
    trigger_tags: [],
    ...overrides,
  }
}

test('lista emoções por dias distintos e não infla vários registros no mesmo dia', () => {
  const emotions = listDrilldownEmotions([
    entry('2026-08-20', { mood: 'Ansiedade' }),
    entry('2026-08-20', { mood: 'Ansiedade', created_at: '2026-08-20T18:00:00Z' }),
    entry('2026-08-22', { emotional_tags: ['ansiedade'] }),
    entry('2026-08-23', { mood: 'Tranquilidade' }),
  ])
  const anxiety = emotions.find(item => item.label.toLowerCase() === 'ansiedade')
  assert.equal(anxiety?.days, 2)
})

test('humor legado numérico não vira emoção clicável', () => {
  const emotions = listDrilldownEmotions([
    entry('2026-08-20', { mood: 3 }),
    entry('2026-08-21', { mood: 'Ansiedade' }),
  ])
  assert.equal(emotions.some(item => item.label === '3'), false)
  assert.equal(emotions.some(item => item.label === 'Ansiedade'), true)
})

test('drilldown mostra frequência, contexto e outras emoções por dias distintos', () => {
  const detail = buildEmotionalDrilldown([
    entry('2026-08-20', { mood: 'Ansiedade', context_tags: ['trabalho'], emotional_tags: ['sobrecarga'] }),
    entry('2026-08-20', { mood: 'Ansiedade', context_tags: ['trabalho'], emotional_tags: ['sobrecarga'], created_at: '2026-08-20T18:00:00Z' }),
    entry('2026-08-22', { mood: 'Ansiedade', context_tags: ['trabalho'], emotional_tags: ['cansaço'] }),
    entry('2026-08-24', { mood: 'Tranquilidade', context_tags: ['família'] }),
  ], 'Ansiedade', { periodEnd: '2026-09-01' })

  assert.equal(detail?.occurrenceDays, 2)
  assert.equal(detail?.totalActiveDays, 3)
  assert.equal(detail?.matchingRecords, 3)
  assert.equal(detail?.topContexts[0]?.label, 'trabalho')
  assert.equal(detail?.topContexts[0]?.days, 2)
  assert.equal(detail?.coEmotions.find(item => item.label === 'sobrecarga')?.days, 1)
})

test('médias usam médias diárias para não deixar muitos check-ins dominarem', () => {
  const detail = buildEmotionalDrilldown([
    entry('2026-08-20', { mood: 'Ansiedade', anxiety_level: 5, energy: 1 }),
    entry('2026-08-20', { mood: 'Ansiedade', anxiety_level: 5, energy: 1, created_at: '2026-08-20T18:00:00Z' }),
    entry('2026-08-22', { mood: 'Ansiedade', anxiety_level: 1, energy: 5 }),
  ], 'Ansiedade')

  assert.equal(detail?.averages.anxiety, 3)
  assert.equal(detail?.averages.energy, 3)
})

test('gatilhos ficam fora da análise comum e entram somente quando autorizado', () => {
  const rows = [
    entry('2026-08-20', { mood: 'Ansiedade', trigger_tags: ['cobrança'] }),
    entry('2026-08-22', { mood: 'Ansiedade', trigger_tags: ['cobrança'] }),
    entry('2026-08-24', { mood: 'Ansiedade', trigger_tags: ['conflito'] }),
  ]
  const essential = buildEmotionalDrilldown(rows, 'Ansiedade', { includeTriggers: false })
  const plus = buildEmotionalDrilldown(rows, 'Ansiedade', { includeTriggers: true })
  assert.deepEqual(essential?.topTriggers, [])
  assert.equal(essential?.relatedDays.some(day => day.triggers.length > 0), false)
  assert.equal(plus?.topTriggers[0]?.label, 'cobrança')
  assert.equal(plus?.topTriggers[0]?.days, 2)
})

test('poucos dias deixam explícito que a amostra ainda é pequena', () => {
  const detail = buildEmotionalDrilldown([
    entry('2026-08-20', { mood: 'Ansiedade' }),
    entry('2026-08-22', { mood: 'Ansiedade' }),
  ], 'Ansiedade')
  assert.equal(detail?.lowSample, true)
})

test('tendência compara duas janelas de 14 dias sem afirmar melhora clínica', () => {
  const detail = buildEmotionalDrilldown([
    entry('2026-08-10', { mood: 'Ansiedade' }),
    entry('2026-08-20', { mood: 'Ansiedade' }),
    entry('2026-08-25', { mood: 'Ansiedade' }),
    entry('2026-08-29', { mood: 'Ansiedade' }),
  ], 'Ansiedade', { periodEnd: '2026-08-30' })
  assert.equal(detail?.trend.previousDays, 1)
  assert.equal(detail?.trend.recentDays, 3)
  assert.equal(detail?.trend.label, 'mais presente')
})
