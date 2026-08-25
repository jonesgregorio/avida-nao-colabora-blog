import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fn = readFileSync(new URL('../supabase/functions/explain-emotional-map/index.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/components/MyEvolutionPage.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('../src/lib/explainEmotionalMap.ts', import.meta.url), 'utf8')

test('explain-emotional-map nunca lê o diário bruto nem respostas abertas — só recebe o resumo já calculado', () => {
  // A função não consulta diary_entries/questionnaire_responses/answers; todo
  // dado estruturado chega já pronto no corpo da requisição (§3.1 da MISSÃO GERAL).
  assert.doesNotMatch(fn, /diary_entries/)
  assert.doesNotMatch(fn, /questionnaire_responses/)
  assert.doesNotMatch(fn, /\banswers\b/)
  assert.match(fn, /DADO ESTRUTURADO/)
  assert.match(fn, /NUNCA texto livre/)
})

test('explain-emotional-map trata amostra baixa sem inventar padrão e nunca diagnostica', () => {
  assert.match(fn, /has_enough_data/)
  assert.match(fn, /Ainda há poucos registros neste período para identificar padrões com confiança/)
  assert.match(fn, /FORBIDDEN/)
  assert.match(fn, /diagn[oó]stic/)
})

test('explain-emotional-map audita a geração em ai_generation_logs sem gravar texto íntimo', () => {
  assert.match(fn, /ai_generation_logs/)
  assert.match(fn, /content_type:\s*'emotional_map_explanation'/)
  assert.doesNotMatch(fn, /prompt_preview/)
})

test('cliente do Mapa Emocional só envia o resumo estruturado (buildEmotionalSummary), nunca o texto do diário', () => {
  assert.match(client, /explain-emotional-map/)
  assert.doesNotMatch(client, /diary_entries/)
})

test('Mapa Emocional mostra o CTA "Entender meu mapa com IA" e o aviso de privacidade', () => {
  assert.match(page, /Entender meu mapa com IA/)
  assert.match(page, /A IA analisa apenas os dados resumidos deste mapa, não o texto completo do seu Diário\./)
  assert.match(page, /buildEmotionalSummary\(entries, period\.start, period\.end, plan, prevEntries\)/)
})
