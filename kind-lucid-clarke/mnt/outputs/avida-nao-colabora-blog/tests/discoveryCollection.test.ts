import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/DescobertasPage.tsx', import.meta.url), 'utf8')

test('Descobertas separa a coleção pessoal das observações em andamento', () => {
  assert.match(page, /Minha coleção/)
  assert.match(page, /Coisas que já fizeram sentido para mim/)
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

test('20.4 substitui o limite temporal por memória histórica explícita', () => {
  assert.match(page, /DiscoveryMemoryArchive/)
  assert.match(page, /continua disponível em “O que já fez sentido antes”/i)
  assert.doesNotMatch(page, /arquivo histórico permanente pode ser criado depois/i)
})
