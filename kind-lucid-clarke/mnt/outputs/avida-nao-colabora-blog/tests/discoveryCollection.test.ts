import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/DescobertasPage.tsx', import.meta.url), 'utf8')

test('Descobertas separa percepções guardadas das observações em andamento', () => {
  assert.match(page, /Guardadas/)
  assert.match(page, /O que já fez sentido para você/)
  assert.match(page, /feedback\[discovery\.stableKey\] === 'made_sense'/)
  assert.match(page, /feedback\[discovery\.stableKey\] !== 'made_sense'/)
  assert.match(page, /saved=\{feedback\[discovery\.stableKey\] === 'made_sense'\}/)
})

test('coleção reaproveita feedback existente sem virar sistema de pontos', () => {
  assert.match(page, /saveDiscoveryFeedback/)
  assert.match(page, /Isso fez sentido para você\?/)
  assert.doesNotMatch(page, /\bXP\b|ranking|streak|pontos conquistados|faltam\s+\d+|\d+%/i)
  assert.doesNotMatch(page, /progress|aria-valuenow/i)
})

test('20.4 mantém memória histórica explícita dentro de Guardadas', () => {
  assert.match(page, /DiscoveryMemoryArchive/)
  assert.match(page, /activeTab === 'saved'/)
  assert.doesNotMatch(page, /arquivo histórico permanente pode ser criado depois/i)
})
