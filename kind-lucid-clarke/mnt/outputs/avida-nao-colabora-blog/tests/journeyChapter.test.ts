import test from 'node:test'
import assert from 'node:assert/strict'
import { buildJourneyChapter } from '../src/lib/journeyChapter.ts'

test('jornada começa sem transformar ausência em atraso', () => {
  const chapter = buildJourneyChapter({
    activeDays: 0,
    reports: 0,
    months: 0,
    milestones: 0,
    hasSteadyMonth: false,
  })

  assert.equal(chapter.key, 'starting')
  assert.match(chapter.title, /quando fizer sentido/i)
  assert.match(chapter.note, /sem sequência/i)
  assert.deepEqual(chapter.evidence, [])
})

test('primeiros registros são reconhecidos sem virar meta de frequência', () => {
  const chapter = buildJourneyChapter({
    activeDays: 3,
    reports: 0,
    months: 1,
    milestones: 1,
    hasSteadyMonth: false,
  })

  assert.equal(chapter.key, 'starting')
  assert.equal(chapter.title, 'Primeiros sinais')
  assert.deepEqual(chapter.evidence, ['3 dias registrados'])
  assert.match(chapter.note, /não por frequência obrigatória/i)
})

test('história ganha forma quando já há material longitudinal, sem criar nível', () => {
  const chapter = buildJourneyChapter({
    activeDays: 8,
    reports: 0,
    months: 2,
    milestones: 1,
    hasSteadyMonth: false,
  })

  assert.equal(chapter.key, 'forming')
  assert.equal(chapter.title, 'Sua história está ganhando forma')
  assert.deepEqual(chapter.evidence, ['8 dias registrados', '2 meses com registros'])
  assert.match(chapter.note, /não é um nível nem uma meta/i)
})

test('primeira retrospectiva muda o capítulo para revisitar', () => {
  const chapter = buildJourneyChapter({
    activeDays: 8,
    reports: 1,
    months: 2,
    milestones: 2,
    hasSteadyMonth: false,
  })

  assert.equal(chapter.key, 'reflecting')
  assert.deepEqual(chapter.evidence, ['8 dias registrados', '1 retrospectiva pronta'])
})

test('trajetória com memória não regride nem pune ausências', () => {
  const chapter = buildJourneyChapter({
    activeDays: 18,
    reports: 2,
    months: 3,
    milestones: 3,
    hasSteadyMonth: true,
  })

  assert.equal(chapter.key, 'remembering')
  assert.equal(chapter.title, 'Uma trajetória com memória')
  assert.deepEqual(chapter.evidence, [
    '18 dias registrados',
    '2 retrospectivas prontas',
    '3 momentos reconhecidos',
  ])
  assert.match(chapter.note, /não regride/i)
  assert.doesNotMatch(JSON.stringify(chapter), /pontos|xp|streak|sequência de dias/i)
})
