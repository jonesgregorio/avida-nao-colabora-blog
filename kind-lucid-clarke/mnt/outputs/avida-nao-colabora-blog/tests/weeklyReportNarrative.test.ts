import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveWeeklyImprovementFallback,
  deriveWeeklyInterpretationFallback,
  deriveWeeklyPatternsFallback,
  normalizeWeeklyNarrative,
} from '../src/lib/weeklyReportNarrative.ts'

const richWeek = {
  interpretation: 'Há registros suficientes para uma leitura cuidadosa do período.',
  patterns: ['Há registros suficientes para uma leitura cuidadosa do período.'],
  improvementMoments: 'Continue observando os pequenos momentos que ajudaram.',
  topEmotions: [
    { label: 'Ansiedade', count: 3 },
    { label: 'Tranquilidade', count: 2 },
  ],
  emotionalMarkers: [{ tag: 'cobrança', count: 2 }],
  topContexts: [{ tag: 'Trabalho', count: 3 }],
  avgEnergy: 2.6,
  avgAnxiety: 3.8,
  energyByDay: [
    { day: 17, value: 2 },
    { day: 18, value: 2 },
    { day: 19, value: 4 },
    { day: 20, value: 4 },
  ],
  anxietyByDay: [
    { day: 17, value: 5 },
    { day: 18, value: 4 },
    { day: 19, value: 2 },
    { day: 20, value: 2 },
  ],
  checkinCount: 5,
  diaryCount: 2,
  data_quality: { total_entries: 7, active_days: 4, has_enough_data: true },
}

test('substitui o fallback de qualidade por uma interpretação coerente com o bloco', () => {
  const text = deriveWeeklyInterpretationFallback(richWeek)
  assert.match(text, /ansiedade/i)
  assert.match(text, /energia média/i)
  assert.match(text, /Trabalho/)
  assert.equal(text.includes('registros suficientes para uma leitura cuidadosa'), false)
})

test('padrões exigem recorrência e usam evidências reais', () => {
  const patterns = deriveWeeklyPatternsFallback(richWeek)
  assert.ok(patterns.some(line => /energia mais baixa/i.test(line) && /ansiedade/i.test(line)))
  assert.ok(patterns.some(line => /Trabalho/.test(line)))
  assert.ok(patterns.some(line => /cobrança/.test(line)))
  assert.equal(patterns.some(line => /registros suficientes para uma leitura cuidadosa/i.test(line)), false)
})

test('momentos de melhora citam sinais positivos existentes sem inventar melhora', () => {
  const text = deriveWeeklyImprovementFallback(richWeek)
  assert.match(text, /tranquilidade/i)
  assert.match(text, /energia/i)
  assert.equal(text.includes('Continue observando os pequenos momentos'), false)
})

test('cada bloco tem mensagem própria quando os dados são insuficientes', () => {
  const sparse = {
    topEmotions: [{ label: 'Ansiedade', count: 1 }],
    energyByDay: [{ day: 20, value: 2 }],
    anxietyByDay: [{ day: 20, value: 4 }],
    checkinCount: 1,
    diaryCount: 0,
    data_quality: { total_entries: 1, active_days: 1 },
  }
  const interpretation = deriveWeeklyInterpretationFallback(sparse)
  const patterns = deriveWeeklyPatternsFallback(sparse)[0]
  const improvement = deriveWeeklyImprovementFallback(sparse)

  assert.match(interpretation, /poucos registros para interpretar/i)
  assert.match(patterns, /recorrência suficiente/i)
  assert.match(improvement, /não foi possível identificar um momento de melhora/i)
  assert.notEqual(interpretation, patterns)
  assert.notEqual(patterns, improvement)
})

test('normalização corrige relatórios antigos sem sobrescrever narrativa específica válida', () => {
  const normalized = normalizeWeeklyNarrative(richWeek)
  assert.notEqual(normalized.interpretation, richWeek.interpretation)
  assert.notDeepEqual(normalized.patterns, richWeek.patterns)
  assert.notEqual(normalized.improvementMoments, richWeek.improvementMoments)

  const authored = normalizeWeeklyNarrative({
    ...richWeek,
    interpretation: 'Na quarta-feira, a ansiedade apareceu junto de energia mais baixa.',
    patterns: ['O contexto “Trabalho” se repetiu em três registros.'],
    improvementMoments: 'Na sexta-feira houve tranquilidade e energia 4/5.',
  })
  assert.equal(authored.interpretation, 'Na quarta-feira, a ansiedade apareceu junto de energia mais baixa.')
  assert.deepEqual(authored.patterns, ['O contexto “Trabalho” se repetiu em três registros.'])
  assert.equal(authored.improvementMoments, 'Na sexta-feira houve tranquilidade e energia 4/5.')
})
