import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/DescobertasPage.tsx', import.meta.url), 'utf8')

test('Descobertas separa a coleção pessoal das observações em andamento', () => {
  assert.match(page, /Fez sentido para mim/)
  assert.match(page, /Sua coleção pessoal/)
  assert.match(page, /feedback\[d\.stableKey\] === 'made_sense'/)
  assert.match(page, /feedback\[d\.stableKey\] !== 'made_sense'/)
  assert.match(page, /Reconhecida por você/)
})

test('coleção reaproveita feedback existente sem virar sistema de pontos', () => {
  assert.match(page, /saveDiscoveryFeedback/)
  assert.match(page, /Você pode mudar de ideia quando quiser/)
  assert.doesNotMatch(page, /\bXP\b|ranking|streak|pontos conquistados|faltam\s+\d+|\d+%/i)
  assert.doesNotMatch(page, /progress|aria-valuenow/i)
})

test('texto deixa explícito o limite temporal da coleção atual', () => {
  assert.match(page, /janela atual de registros/)
  assert.match(page, /arquivo histórico permanente pode ser criado depois/i)
  assert.doesNotMatch(page, /coleção permanente|para sempre/i)
})
