import test from 'node:test'
import assert from 'node:assert/strict'
import { buildContinuityPrompt, type ContinuityEntry } from '../src/lib/todayContinuity.ts'

const TODAY = '2026-08-29'

function entry(date: string, extra: Partial<ContinuityEntry> = {}): ContinuityEntry {
  return { date, created_at: `${date}T12:00:00.000Z`, ...extra }
}

test('não insiste em continuidade depois que o usuário já registrou hoje', () => {
  const prompt = buildContinuityPrompt([entry('2026-08-28', { mood: 'ansiedade' })], TODAY, true)
  assert.equal(prompt, null)
})

test('retorno depois de alguns dias acolhe sem cobrar sequência perdida', () => {
  const prompt = buildContinuityPrompt([entry('2026-08-25', { mood: 'cansaco' })], TODAY)
  assert.equal(prompt?.kind, 'return')
  assert.match(prompt?.description ?? '', /não precisa recuperar/i)
  assert.doesNotMatch(prompt?.description ?? '', /sequência|perdeu|atrasad/i)
})

test('ansiedade alta de ontem tem prioridade sobre retomadas mais genéricas', () => {
  const prompt = buildContinuityPrompt([
    entry('2026-08-28', { mood: 'ansiedade', anxiety_level: 5, energy: 1 }),
    entry('2026-08-27', { mood: 'cansaco' }),
  ], TODAY)
  assert.equal(prompt?.kind, 'yesterday_anxiety')
  assert.match(prompt?.title ?? '', /ansiedade/i)
})

test('energia e sono de ontem podem gerar continuidade sem diagnóstico', () => {
  const energy = buildContinuityPrompt([entry('2026-08-28', { energy: 2 })], TODAY)
  assert.equal(energy?.kind, 'yesterday_energy')
  assert.doesNotMatch(energy?.description ?? '', /caus|diagn/i)

  const sleep = buildContinuityPrompt([entry('2026-08-28', { sleep_quality: 2 })], TODAY)
  assert.equal(sleep?.kind, 'yesterday_sleep')
})

test('gatilho recorrente conta dias distintos, não vários registros no mesmo dia', () => {
  const sameDayOnly = buildContinuityPrompt([
    entry('2026-08-27', { trigger_tags: ['cobrança'] }),
    { ...entry('2026-08-27', { trigger_tags: ['cobrança'] }), created_at: '2026-08-27T18:00:00.000Z' },
  ], TODAY)
  assert.notEqual(sameDayOnly?.kind, 'repeated_trigger')

  const repeated = buildContinuityPrompt([
    entry('2026-08-27', { trigger_tags: ['cobrança'] }),
    entry('2026-08-26', { trigger_tags: ['cobrança'] }),
  ], TODAY)
  assert.equal(repeated?.kind, 'repeated_trigger')
  assert.match(repeated?.title ?? '', /2 dias recentes/)
})

test('somente tags estruturadas oficiais podem aparecer na Home', () => {
  const prompt = buildContinuityPrompt([
    entry('2026-08-27', { trigger_tags: ['texto íntimo inventado'] }),
    entry('2026-08-26', { trigger_tags: ['texto íntimo inventado'] }),
    entry('2026-08-24', { context_tags: ['frase privada qualquer'] }),
    entry('2026-08-23', { context_tags: ['frase privada qualquer'] }),
    entry('2026-08-22', { context_tags: ['frase privada qualquer'] }),
  ], TODAY)
  assert.equal(prompt, null)
})

test('contexto recorrente exige pelo menos três dias distintos', () => {
  const prompt = buildContinuityPrompt([
    entry('2026-08-27', { context_tags: ['trabalho'] }),
    entry('2026-08-26', { context_tags: ['trabalho'] }),
    entry('2026-08-25', { context_tags: ['trabalho'] }),
  ], TODAY)
  assert.equal(prompt?.kind, 'repeated_context')
  assert.match(prompt?.title ?? '', /trabalho/)
})
