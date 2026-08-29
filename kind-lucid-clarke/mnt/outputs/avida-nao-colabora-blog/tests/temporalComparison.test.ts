import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTemporalComparison } from '../src/lib/temporalComparison.ts'

const now = new Date(2026, 7, 29, 12)

test('usa duas janelas consecutivas de 30 dias sem sobreposição', () => {
  const model = buildTemporalComparison([], { now })
  assert.equal(model.current.start, '2026-07-31')
  assert.equal(model.current.end, '2026-08-29')
  assert.equal(model.previous.start, '2026-07-01')
  assert.equal(model.previous.end, '2026-07-30')
})

test('vários registros no mesmo dia contam como um único dia ativo e uma única ocorrência emocional', () => {
  const model = buildTemporalComparison([
    { date: '2026-08-20', mood: 'Ansiedade', energy: 2 },
    { date: '2026-08-20', mood: 'Ansiedade', energy: 4 },
    { date: '2026-08-19', mood: 'Tranquilidade', energy: 4 },
    { date: '2026-08-18', mood: 'Ansiedade', energy: 3 },
    { date: '2026-07-20', mood: 'Ansiedade', energy: 2 },
    { date: '2026-07-19', mood: 'Tranquilidade', energy: 3 },
    { date: '2026-07-18', mood: 'Tranquilidade', energy: 4 },
  ], { now })

  assert.equal(model.current.activeDays, 3)
  assert.equal(model.current.recordCount, 4)
  assert.equal(model.emotion?.label, 'Ansiedade')
  assert.equal(model.emotion?.currentDays, 2)
  assert.equal(model.emotion?.currentShare, 67)
  assert.equal(model.emotion?.previousDays, 1)
  assert.equal(model.emotion?.previousShare, 33)
})

test('métricas são média das médias diárias para um dia com muitos check-ins não dominar', () => {
  const model = buildTemporalComparison([
    { date: '2026-08-20', energy: 1, anxiety_level: 5, sleep_quality: 2 },
    { date: '2026-08-20', energy: 5, anxiety_level: 1, sleep_quality: 4 },
    { date: '2026-08-19', energy: 5, anxiety_level: 2, sleep_quality: 4 },
    { date: '2026-08-18', energy: 4, anxiety_level: 2, sleep_quality: 4 },
    { date: '2026-07-20', energy: 2, anxiety_level: 4, sleep_quality: 2 },
    { date: '2026-07-19', energy: 2, anxiety_level: 4, sleep_quality: 2 },
    { date: '2026-07-18', energy: 2, anxiety_level: 4, sleep_quality: 2 },
  ], { now })

  // 20/08 = média 3; depois 5 e 4 => média diária do período = 4.
  assert.equal(model.metrics.energy.current.average, 4)
  assert.equal(model.metrics.energy.previous.average, 2)
  assert.equal(model.metrics.energy.direction, 'higher')
  assert.equal(model.metrics.anxiety.direction, 'lower')
  assert.equal(model.metrics.sleep.direction, 'higher')
})

test('compara frequência por proporção de dias e não por contagem bruta', () => {
  const current = [
    { date: '2026-08-20', context_tags: ['trabalho'] },
    { date: '2026-08-19', context_tags: ['trabalho'] },
    { date: '2026-08-18', context_tags: ['casa'] },
    { date: '2026-08-17', context_tags: ['casa'] },
  ]
  const previous = [
    { date: '2026-07-20', context_tags: ['trabalho'] },
    { date: '2026-07-19', context_tags: ['trabalho'] },
    { date: '2026-07-18', context_tags: ['trabalho'] },
    { date: '2026-07-17', context_tags: ['família'] },
    { date: '2026-07-16', context_tags: ['saúde'] },
    { date: '2026-07-15', context_tags: ['descanso'] },
    { date: '2026-07-14', context_tags: ['estudo'] },
    { date: '2026-07-13', context_tags: ['lazer'] },
  ]
  const model = buildTemporalComparison([...current, ...previous], { now })

  assert.equal(model.context?.label, 'trabalho')
  assert.equal(model.context?.currentDays, 2)
  assert.equal(model.context?.previousDays, 3)
  assert.equal(model.context?.currentShare, 50)
  assert.equal(model.context?.previousShare, 38)
  assert.equal(model.context?.direction, 'more')
})

test('amostra pequena fica em formação e não força comparação estável', () => {
  const model = buildTemporalComparison([
    { date: '2026-08-20', mood: 'Ansiedade' },
    { date: '2026-08-19', mood: 'Ansiedade' },
    { date: '2026-07-20', mood: 'Ansiedade' },
  ], { now })

  assert.equal(model.status, 'forming')
})

test('gatilhos estruturados só entram quando autorizados para Plus', () => {
  const entries = [
    { date: '2026-08-20', trigger_tags: ['cobrança'] },
    { date: '2026-08-19', trigger_tags: ['cobrança'] },
    { date: '2026-08-18', trigger_tags: ['cobrança'] },
    { date: '2026-07-20', trigger_tags: ['cobrança'] },
    { date: '2026-07-19', trigger_tags: ['conflito'] },
    { date: '2026-07-18', trigger_tags: ['conflito'] },
  ]

  assert.equal(buildTemporalComparison(entries, { now }).trigger, null)
  assert.equal(buildTemporalComparison(entries, { now, includeTriggers: true }).trigger?.label, 'cobrança')
})

test('humor legado numérico não vira emoção comparável', () => {
  const model = buildTemporalComparison([
    { date: '2026-08-20', mood: 4 },
    { date: '2026-08-19', mood: 4 },
    { date: '2026-08-18', mood: 4 },
    { date: '2026-07-20', mood: 2 },
    { date: '2026-07-19', mood: 2 },
    { date: '2026-07-18', mood: 2 },
  ], { now })

  assert.equal(model.emotion, null)
})
