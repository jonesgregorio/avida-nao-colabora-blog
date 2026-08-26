import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fn = readFileSync(new URL('../supabase/functions/explain-emotional-map/index.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/components/MyEvolutionPage.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('../src/lib/explainEmotionalMap.ts', import.meta.url), 'utf8')

test('Edge Function nunca lê o diário bruto nem respostas abertas — recebe dados estruturados', () => {
  assert.doesNotMatch(fn, /diary_entries/)
  assert.doesNotMatch(fn, /questionnaire_responses/)
  assert.doesNotMatch(fn, /\banswers\b/)
  assert.match(fn, /DADO ESTRUTURADO/)
  assert.match(fn, /NÃO CONTÉM TEXTO LIVRE DO USUÁRIO/)
})

test('cliente calcula conexões somente com tags estruturadas e nunca seleciona texto do diário', () => {
  assert.match(client, /explain-emotional-map/)
  assert.match(client, /from\('diary_entries'\)/)
  assert.match(client, /select\('context_tags,emotional_tags,need_tags,care_action_tags'\)/)
  assert.doesNotMatch(client, /select\([^)]*\btext\b/)
  assert.doesNotMatch(client, /questionnaire_responses|\banswers\b/)
})

test('explain-emotional-map trata amostra baixa sem inventar padrão e nunca diagnostica', () => {
  assert.match(fn, /has_enough_data/)
  assert.match(fn, /Ainda há poucos registros neste período para identificar padrões com confiança/)
  assert.match(fn, /FORBIDDEN/)
  assert.match(fn, /Nunca diagnostique/)
})

test('explain-emotional-map audita a geração em ai_generation_logs sem gravar texto íntimo', () => {
  assert.match(fn, /ai_generation_logs/)
  assert.match(fn, /content_type:\s*'emotional_map_explanation'/)
  assert.doesNotMatch(fn, /prompt_preview/)
  assert.doesNotMatch(fn, /result_preview/)
})

test('Mapa Emocional oferece leitura complementar sem expor IA ao usuário', () => {
  assert.match(page, /Entender melhor meu mapa/)
  assert.match(page, /Esta leitura considera apenas os dados resumidos deste mapa, não o texto completo do seu Diário\./)
  assert.doesNotMatch(page, />Entender meu mapa com IA</)
  assert.doesNotMatch(page, />A IA analisa apenas/)
  assert.match(page, /buildEmotionalSummary\(entries, period\.start, period\.end, plan, prevEntries\)/)
  assert.match(client, /EXPLAIN_MAP_ERROR/)
  assert.doesNotMatch(client, /A leitura por IA|error\.message|data\?\.message/)
})
