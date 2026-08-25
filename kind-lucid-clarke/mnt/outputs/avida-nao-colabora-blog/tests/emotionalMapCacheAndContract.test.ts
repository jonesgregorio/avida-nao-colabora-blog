import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const fn = read('supabase/functions/explain-emotional-map/index.ts')
const migration = read('supabase/migrations/20260825210000_emotional_map_insights_cache.sql')
const clientLib = read('src/lib/explainEmotionalMap.ts')
const page = read('src/components/MyEvolutionPage.tsx')

// MISSÃO GERAL final (Decisão de Produto nº 2): contrato exato de campos
// (title/what_stands_out/possible_connections/helpful_signals/
// what_to_observe/reflection_question/data_quality_notice) + cache por
// usuário+período+fingerprint dos dados, com botão "Atualizar leitura".

test('explain-emotional-map usa o contrato de campos exato pedido', () => {
  for (const field of ['title', 'what_stands_out', 'possible_connections', 'helpful_signals', 'what_to_observe', 'reflection_question', 'data_quality_notice']) {
    assert.ok(fn.includes(field), `campo ausente no contrato: ${field}`)
  }
  assert.match(clientLib, /what_stands_out: string/)
  assert.match(clientLib, /possible_connections: string\[\]/)
})

test('cache é por usuário+período+fingerprint dos dados, não recalcula à toa', () => {
  assert.match(fn, /const fingerprint = await sha256Hex\(JSON\.stringify\(payload\)\)/)
  assert.match(fn, /\.eq\('user_id', user\.id\)\.eq\('period_start', current\.period_start\)\.eq\('period_end', current\.period_end\)/)
  assert.match(fn, /if \(cached && cached\.data_fingerprint === fingerprint\)/)
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS emotional_map_insights_unique_period/)
  assert.match(migration, /ON public\.emotional_map_insights \(user_id, period_start, period_end\)/)
})

test('botão "Atualizar leitura" pula o cache de propósito (force=true)', () => {
  assert.match(fn, /const force = body\.force === true/)
  assert.match(fn, /if \(!force\) \{/)
  assert.match(clientLib, /force\?: boolean/)
  assert.match(page, /Atualizar leitura/)
  assert.match(page, /handleClick\(true\)/)
})

test('cache só é lido pelo próprio usuário — sem policy de escrita para authenticated', () => {
  assert.match(migration, /CREATE POLICY "emotional_map_insights_own_select" ON public\.emotional_map_insights\s*\n\s*FOR SELECT TO authenticated\s*\n\s*USING \(user_id = auth\.uid\(\)\)/)
  assert.doesNotMatch(migration, /FOR (INSERT|UPDATE|ALL) TO authenticated/)
})

test('resultado do cache/fallback nunca inclui texto livre — só os 7 campos estruturados', () => {
  const lowSample = fn.match(/function lowSampleFallback\(\)[\s\S]*?\n\}/)?.[0] ?? ''
  assert.notEqual(lowSample, '')
  for (const field of ['title', 'what_stands_out', 'possible_connections', 'helpful_signals', 'what_to_observe', 'reflection_question', 'data_quality_notice']) {
    assert.match(lowSample, new RegExp(field))
  }
})
