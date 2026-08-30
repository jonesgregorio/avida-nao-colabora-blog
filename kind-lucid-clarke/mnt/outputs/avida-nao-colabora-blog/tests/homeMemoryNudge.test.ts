import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHomeMemoryNudge } from '../src/lib/homeMemoryNudge'
import type { DiscoveryMemory } from '../src/lib/discoveryMemoryStore'
import type { HomeDiscovery } from '../src/lib/homeDiscoveries'

const current: HomeDiscovery = {
  id: 'current-context',
  stableKey: 'context:trabalho',
  status: 'ready',
  kind: 'context',
  eyebrow: 'Uma descoberta',
  title: 'Trabalho tem aparecido com frequência',
  description: 'Esse contexto voltou a aparecer nos seus registros recentes.',
  evidence: 'Trabalho apareceu em vários registros.',
  question: 'Isso ainda faz sentido para você?',
  matchedDays: 4,
  baseDays: 6,
}

function memory(recognizedAt: string): DiscoveryMemory {
  return {
    id: 'memory-1',
    user_id: 'user-1',
    discovery_key: 'context:trabalho',
    discovery_kind: 'context',
    title: current.title,
    description: current.description,
    evidence: current.evidence,
    question: current.question,
    recognized_at: recognizedAt,
    last_seen_at: recognizedAt,
    created_at: recognizedAt,
    updated_at: recognizedAt,
  }
}

test('Home só resgata memória quando uma descoberta reconhecida volta a aparecer', () => {
  const now = new Date('2026-08-30T12:00:00Z')
  const result = buildHomeMemoryNudge([memory('2026-07-01T12:00:00Z')], [current], now)
  assert.ok(result)
  assert.equal(result?.stableKey, 'context:trabalho')
})

test('memória recente não vira nudge permanente na Home', () => {
  const now = new Date('2026-08-30T12:00:00Z')
  const result = buildHomeMemoryNudge([memory('2026-08-25T12:00:00Z')], [current], now)
  assert.equal(result, null)
})

test('memória antiga sem recorrência atual não aparece na Home', () => {
  const now = new Date('2026-08-30T12:00:00Z')
  const unrelated = { ...current, stableKey: 'context:familia' }
  const result = buildHomeMemoryNudge([memory('2026-06-01T12:00:00Z')], [unrelated], now)
  assert.equal(result, null)
})

test('nudge não cria linguagem de pontos, ranking ou streak', () => {
  const now = new Date('2026-08-30T12:00:00Z')
  const result = buildHomeMemoryNudge([memory('2026-07-01T12:00:00Z')], [current], now)
  assert.doesNotMatch(JSON.stringify(result), /\bXP\b|ranking|streak|pontos|sequência obrigatória|\d+%/i)
})
