import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWeeklyRetrospective } from '../src/lib/weeklyRetrospective.ts'

const richWeek = {
  summary: 'A semana reuniu ansiedade, trabalho e alguns momentos de maior tranquilidade.',
  interpretation: 'Ansiedade apareceu em diferentes momentos da semana, junto de energia mais baixa em parte dos registros.',
  patterns: ['O contexto Trabalho apareceu em três dias distintos.', 'Cobrança se repetiu em dois dias.'],
  attentionPoints: ['Ansiedade mais alta apareceu em parte dos registros.'],
  improvementMoments: 'Na sexta-feira houve tranquilidade e energia mais alta.',
  topEmotions: [{ label: 'Ansiedade', count: 3 }, { label: 'Tranquilidade', count: 2 }],
  emotionalMarkers: [{ tag: 'cobrança', count: 2 }],
  topContexts: [{ tag: 'Trabalho', count: 3 }],
  comparison: ['Ansiedade apareceu em mais dias do que na semana anterior.'],
  nextSteps: ['Fazer uma pausa curta no meio do dia', 'Observar o contexto de trabalho sem tentar concluir uma causa'],
  avgEnergy: 2.8,
  avgAnxiety: 3.9,
  checkinCount: 5,
  diaryCount: 2,
  dominantEmotion: 'Ansiedade',
  topEmotionalMarker: 'cobrança',
  hasEnoughData: true,
  data_quality: { total_entries: 7, active_days: 4, has_enough_data: true },
}

test('retrospectiva prioriza síntese, evidências e uma coisa para levar', () => {
  const model = buildWeeklyRetrospective(richWeek)
  assert.equal(model.summary, richWeek.summary)
  assert.match(model.evidenceLine, /7 registros/)
  assert.match(model.evidenceLine, /4 dias com dados/)
  assert.deepEqual(model.highlights.map(item => item.value), ['Ansiedade', 'cobrança', 'Trabalho'])
  assert.equal(model.carryForward, 'Fazer uma pausa curta no meio do dia')
  assert.deepEqual(model.otherNextSteps, ['Observar o contexto de trabalho sem tentar concluir uma causa'])
})

test('retrospectiva reutiliza comparação e percepções já fechadas sem inventar conteúdo', () => {
  const model = buildWeeklyRetrospective(richWeek)
  assert.deepEqual(model.comparison, richWeek.comparison)
  assert.equal(model.perceptions[0], richWeek.interpretation)
  assert.ok(model.perceptions.includes(richWeek.patterns[0]))
  assert.deepEqual(model.attention, richWeek.attentionPoints)
  assert.equal(model.relief, richWeek.improvementMoments)
})

test('pouca amostra permanece explicitamente inicial', () => {
  const model = buildWeeklyRetrospective({
    summary: '',
    topEmotions: [{ label: 'Ansiedade', count: 1 }],
    checkinCount: 1,
    diaryCount: 0,
    hasEnoughData: false,
    data_quality: { total_entries: 1, active_days: 1, has_enough_data: false },
  })
  assert.equal(model.hasEnoughData, false)
  assert.match(model.summary, /sinal inicial/i)
  assert.match(model.evidenceLine, /1 registro/)
  assert.equal(model.comparison.length, 0)
  assert.equal(model.carryForward, null)
})

test('não transforma médias em destaque quando já existem três sinais mais concretos', () => {
  const model = buildWeeklyRetrospective(richWeek)
  assert.equal(model.highlights.length, 3)
  assert.equal(model.highlights.some(item => /Energia média|Ansiedade percebida média/i.test(item.label)), false)
})
