import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildDiaryPatternInsight } from '../src/lib/diaryPatternRules.ts'

test('recorrência exige o marcador atual em pelo menos dois outros dias distintos', () => {
  const insight = buildDiaryPatternInsight(
    { id: 'today', date: '2026-08-29', context_tags: ['trabalho'] },
    [
      { id: 'a', date: '2026-08-28', context_tags: ['trabalho'] },
      { id: 'b', date: '2026-08-27', context_tags: ['trabalho'] },
      { id: 'c', date: '2026-08-27', context_tags: ['trabalho'] },
      { id: 'd', date: '2026-08-26', context_tags: ['família'] },
    ],
  )

  assert.ok(insight)
  assert.equal(insight.tag, 'trabalho')
  assert.equal(insight.previousDays, 2)
  assert.equal(insight.totalDays, 3)
  assert.equal(insight.title, 'Tem uma coisa que talvez valha observar')
  assert.match(insight.description, /registro de hoje.*2 outros dias/i)
  assert.match(insight.evidence, /não uma causa nem um diagnóstico/i)
})

test('vários registros no mesmo dia não fabricam um padrão', () => {
  const insight = buildDiaryPatternInsight(
    { id: 'today', date: '2026-08-29', emotional_tags: ['ansiedade'] },
    [
      { id: 'a', date: '2026-08-28', emotional_tags: ['ansiedade'] },
      { id: 'b', date: '2026-08-28', emotional_tags: ['ansiedade'] },
      { id: 'c', date: '2026-08-29', emotional_tags: ['ansiedade'] },
    ],
  )
  assert.equal(insight, null)
})

test('tema frequente no histórico é ignorado quando não aparece no registro atual', () => {
  const insight = buildDiaryPatternInsight(
    { id: 'today', date: '2026-08-29', context_tags: ['trabalho'] },
    [
      { date: '2026-08-28', context_tags: ['família'] },
      { date: '2026-08-27', context_tags: ['família'] },
      { date: '2026-08-26', context_tags: ['família'] },
    ],
  )
  assert.equal(insight, null)
})

test('em empate, gatilho estruturado tem prioridade sobre contexto genérico', () => {
  const insight = buildDiaryPatternInsight(
    { id: 'today', date: '2026-08-29', trigger_tags: ['cobrança'], context_tags: ['trabalho'] },
    [
      { date: '2026-08-28', trigger_tags: ['cobrança'], context_tags: ['trabalho'] },
      { date: '2026-08-27', trigger_tags: ['cobrança'], context_tags: ['trabalho'] },
    ],
  )
  assert.ok(insight)
  assert.equal(insight.kind, 'trigger')
  assert.equal(insight.tag, 'cobrança')
})

test('busca de recorrência não consulta texto livre do diário', () => {
  const source = readFileSync(new URL('../src/lib/diaryPatternInsight.ts', import.meta.url), 'utf8')
  const select = source.match(/\.select\('([^']+)'\)/)?.[1]
  assert.equal(select, 'id,date,created_at,emotional_tags,context_tags,need_tags,trigger_tags')
  assert.ok(!select?.split(',').includes('text'))
  assert.doesNotMatch(source, /free_note/)
})

test('devolutiva separa espelho do registro e recorrência explorável', () => {
  const screen = readFileSync(new URL('../src/components/DiarySavedReflection.tsx', import.meta.url), 'utf8')
  assert.match(screen, /\{patternInsight\.title\}/)
  assert.match(screen, />Explorar isso</)
  assert.match(screen, />Agora não</)
  assert.match(screen, /Uma pergunta para olhar com mais calma/)
  assert.match(screen, /hasPlanAccess\(plan, 'plus'\)/)
  assert.doesNotMatch(screen, /saved\.mirror\.pattern/)
})
