import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWeeklyFocusSuggestions } from '../src/lib/weeklyFocus.ts'

test('foco semanal usa os 14 dias anteriores à semana e ignora registros da semana atual', () => {
  const suggestions = buildWeeklyFocusSuggestions([
    { date: '2026-08-20', anxiety_level: 5 },
    { date: '2026-08-19', anxiety_level: 4 },
    { date: '2026-08-18', anxiety_level: 5 },
    { date: '2026-08-24', anxiety_level: 5 },
    { date: '2026-08-01', anxiety_level: 5 },
  ], { weekStart: '2026-08-23' })

  const anxiety = suggestions.find(item => item.key === 'history:pause_before_solving')
  assert.ok(anxiety)
  assert.match(anxiety.reason, /3 dias distintos/)
})

test('vários registros no mesmo dia não fabricam recorrência semanal', () => {
  const suggestions = buildWeeklyFocusSuggestions([
    { date: '2026-08-20', overload: 5 },
    { date: '2026-08-20', overload: 5 },
    { date: '2026-08-19', mood: 'Tranquilidade' },
  ], { weekStart: '2026-08-23' })

  assert.equal(suggestions.some(item => item.key === 'history:reduce_overload'), false)
})

test('energia é calculada por dia antes de decidir se ficou baixa', () => {
  const suggestions = buildWeeklyFocusSuggestions([
    { date: '2026-08-20', energy: 1 },
    { date: '2026-08-20', energy: 5 },
    { date: '2026-08-19', energy: 2 },
    { date: '2026-08-18', energy: 4 },
  ], { weekStart: '2026-08-23' })

  assert.equal(suggestions.some(item => item.key === 'history:protect_energy'), false)
})

test('gatilho só participa das sugestões quando autorizado para Plus', () => {
  const entries = [
    { date: '2026-08-20', trigger_tags: ['cobrança'] },
    { date: '2026-08-19', trigger_tags: ['cobrança'] },
    { date: '2026-08-18', mood: 'Tranquilidade' },
  ]

  const essential = buildWeeklyFocusSuggestions(entries, { weekStart: '2026-08-23' })
  const plus = buildWeeklyFocusSuggestions(entries, { weekStart: '2026-08-23', includeTriggers: true })

  assert.equal(essential.some(item => item.key.startsWith('history:notice_trigger:')), false)
  assert.equal(plus.some(item => item.key.startsWith('history:notice_trigger:')), true)
})

test('com poucos dados oferece opções gerais sem fingir que vieram do histórico', () => {
  const suggestions = buildWeeklyFocusSuggestions([
    { date: '2026-08-20', mood: 'Ansiedade' },
  ], { weekStart: '2026-08-23' })

  assert.equal(suggestions.length, 3)
  assert.ok(suggestions.every(item => item.source === 'general'))
  assert.match(suggestions[0].reason, /poucos registros|foco geral/i)
})

test('humor legado numérico não vira um sinal emocional do foco', () => {
  const suggestions = buildWeeklyFocusSuggestions([
    { date: '2026-08-20', mood: 4 },
    { date: '2026-08-19', mood: 4 },
    { date: '2026-08-18', mood: 4 },
  ], { weekStart: '2026-08-23' })

  assert.ok(suggestions.every(item => item.source === 'general'))
})
