import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/SelfCarePlanPage.tsx', import.meta.url), 'utf8')

test('Plano de Autocuidado acompanha ações escolhidas, experimentadas e úteis sem meta percentual', () => {
  assert.match(page, /const tried=active\.filter/)
  assert.match(page, /helped=active\.filter/)
  assert.match(page, /escolhidas/)
  assert.match(page, /experimentadas/)
  assert.match(page, /ajudando/)
  assert.match(page, /Sem porcentagem, sequência ou meta/)
  assert.doesNotMatch(page, /role=["']progressbar["']|aria-valuenow|Math\.round\(withOutcome/)
})

test('feedback difícil oferece adaptação concreta em vez de cobrança', () => {
  assert.match(page, /Foi difícil hoje/)
  assert.match(page, /Quero adaptar/)
  assert.match(page, /Que tal uma versão menor\?/)
  assert.match(page, /Usar esta adaptação/)
  assert.match(page, /adapted_text:minimum\(a\)/)
})

test('fechamento do ciclo tabula resultados do plano específico sem nota de desempenho', () => {
  assert.match(page, /const cycleReview=outcomes\.map/)
  assert.match(page, /Fechamento do ciclo/)
  assert.match(page, /O que vale levar adiante/)
  assert.match(page, /loadCarePlanActionStates\(user\.id,current\.id\)/)
  assert.match(page, /próximo Plano de Autocuidado/)
})
