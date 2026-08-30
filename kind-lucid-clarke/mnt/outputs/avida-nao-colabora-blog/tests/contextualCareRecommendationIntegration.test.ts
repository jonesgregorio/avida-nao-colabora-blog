import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const recommended = readFileSync(new URL('../src/components/RecommendedContent.tsx', import.meta.url), 'utf8')
const structured = readFileSync(new URL('../src/lib/structuredContentRecommendation.ts', import.meta.url), 'utf8')
const cuidar = readFileSync(new URL('../src/components/CuidarPage.tsx', import.meta.url), 'utf8')

test('Home Hoje, Cuidar e Mapa usam o contexto estruturado para pontuar recomendações', () => {
  assert.match(recommended, /source === 'home-hoje' \|\| source === 'map' \|\| source === 'care'/)
  assert.match(recommended, /fetchStructuredUserSignal\(user\?\.id\)/)
})

test('consulta de pontuação estruturada não seleciona texto livre', () => {
  assert.match(structured, /select\('mood,energy,anxiety_level,emotional_tags,context_tags,need_tags,care_action_tags,trigger_tags,entry_type,created_at,date'\)/)
})

test('barreira de risco continua separada da pontuação de conteúdo', () => {
  assert.match(structured, /select\('text,free_note,recurring_thoughts,emotional_triggers,emotional_need,relationships,habits'\)/)
  assert.match(structured, /merged\.risk = hasRiskSignal/)
})

test('Plano de Autocuidado mantém contexto explícito nas recomendações', () => {
  assert.match(recommended, /source === 'care_plan'/)
  assert.match(recommended, /foco do seu Plano de Autocuidado é o contexto principal/)
})

test('Cuidar registra a própria origem e não se passa pelo Mapa', () => {
  assert.match(cuidar, /source="care"/)
  assert.doesNotMatch(cuidar, /source="map"/)
})
