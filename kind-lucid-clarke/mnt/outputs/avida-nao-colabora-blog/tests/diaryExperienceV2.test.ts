import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const diary = readFileSync(new URL('../src/components/DiaryExperience.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('../src/lib/diaryCompanion.ts', import.meta.url), 'utf8')
const edge = readFileSync(new URL('../supabase/functions/diary-companion/index.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260823210500_diary_ai_companion.sql', import.meta.url), 'utf8')
const config = readFileSync(new URL('../src/lib/diaryConfig.ts', import.meta.url), 'utf8')

test('diário v2 prioriza escrita, foco e detalhes progressivos', () => {
  assert.match(diary, /Modo foco/)
  assert.match(diary, /Só quero escrever/)
  assert.match(diary, /Me ajude a começar/)
  assert.match(diary, /Não sei o que escrever/)
  assert.match(diary, /Quero detalhar um pouco/)
  assert.match(diary, /Escreva do seu jeito/)
  assert.equal(diary.includes('Que bom ter você aqui.'), false)
})

test('jornada deixa de punir ausência com streak', () => {
  assert.match(diary, /Sua presença em/)
  assert.match(diary, /Não existe sequência para perder/)
  assert.match(diary, /Sua história deste mês, até aqui/)
  assert.equal(diary.includes('dias de escrita seguidos'), false)
  assert.equal(diary.includes('calcStreak'), false)
})

test('IA é opcional, não clínica e devolve recompensa depois de escrever', () => {
  assert.match(diary, /Não analisar este registro com IA/)
  assert.match(diary, /O que apareceu no seu registro/)
  assert.match(diary, /Uma pergunta para levar com você/)
  assert.match(diary, /Não é diagnóstico/)
  assert.match(client, /diary-companion/)
  assert.match(edge, /Não diagnostique/)
  assert.match(edge, /não presuma causa/i)
  assert.match(edge, /FORBIDDEN/)
})

test('IA não relê silenciosamente textos antigos para buscar padrões', () => {
  assert.match(edge, /select\('date,mood,emotional_tags,context_tags,need_tags,care_action_tags,trigger_tags,energy,anxiety_level'\)/)
  assert.equal(edge.includes("select('date,mood,text,"), false)
  assert.match(edge, /count >= 2/)
})

test('tags sugeridas só entram nos dados após confirmação explícita', () => {
  assert.match(diary, /Elas só entram no seu mapa e nos relatórios se você confirmar/)
  assert.match(diary, /Confirmar estas marcações/)
  assert.match(diary, /applySuggestions/)
  assert.match(migration, /ai_suggested_tags jsonb/)
})

test('metadados de IA e confirmação de tags não consomem o único aprofundamento', () => {
  assert.match(migration, /meaningful_update BOOLEAN/)
  assert.match(migration, /OLD\.text IS DISTINCT FROM NEW\.text/)
  assert.match(migration, /NEW\.deepened_at := OLD\.deepened_at/)
  assert.match(migration, /Arrays de tags e colunas ai_\*/)
})

test('planos preservam Free, Essencial e Plus sem voltar a criar complementos', () => {
  assert.match(config, /plan: 'free'[\s\S]*entriesPerMonth: 5/)
  assert.match(config, /plan: 'essential'[\s\S]*entriesPerMonth: null/)
  assert.match(config, /plan: 'plus'[\s\S]*entriesPerMonth: null/)
  const enabled = config.match(/addonsEnabled: true/g) || []
  assert.equal(enabled.length, 0)
  assert.match(diary, /isEssential/)
  assert.match(diary, /isPlus/)
})

test('ditado e organização não substituem silenciosamente o texto original', () => {
  assert.match(diary, /Prefiro falar/)
  assert.match(diary, /Organizar minha escrita/)
  assert.match(diary, /Usar esta versão/)
  assert.match(diary, /Manter meu texto/)
  assert.match(edge, /mantendo a PRIMEIRA PESSOA/)
  assert.match(migration, /não é\n-- substituído automaticamente/)
})
