import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const diaryEntry = readFileSync(new URL('../src/components/DiaryPage.tsx', import.meta.url), 'utf8')
const diary = readFileSync(new URL('../src/components/DiaryExperience.tsx', import.meta.url), 'utf8')
const questionnaire = readFileSync(new URL('../src/lib/questionnaireResult.ts', import.meta.url), 'utf8')
const player = readFileSync(new URL('../src/components/QuestionnairePlayer.tsx', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260823150500_diary_single_deepening_flow.sql', import.meta.url), 'utf8')

test('rota canônica usa a nova experiência e check-in continua levando ao diário', () => {
  assert.match(diaryEntry, /DiaryExperience/)
  assert.match(diary, /Quero escrever sobre isso/)
  assert.match(diary, /Check-in rápido/)
  assert.match(diary, /setMode\(todayMain \? 'main-saved' : 'diary'\)/)
})

test('novo fluxo não cria complemento separado e mantém um único aprofundamento', () => {
  assert.equal(diary.includes("setMode('addon')"), false)
  assert.equal(diary.includes("mode === 'addon'"), false)
  assert.equal(diary.includes('Adicionar complemento'), false)
  assert.equal(diary.includes('Editar diário de hoje'), false)
  assert.equal(diary.includes('Editar registro de hoje'), false)
  assert.match(diary, /Aprofundar meu registro/)
  assert.match(diary, /Salvar aprofundamento/)
})

test('banco bloqueia segundo aprofundamento e novos addons sem regredir entitlement efetivo', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS deepened_at TIMESTAMPTZ/)
  assert.match(migration, /effective_plan_for_user\(NEW\.user_id\)/)
  assert.match(migration, /TG_OP = 'INSERT' AND new_kind = 'addon'/)
  assert.match(migration, /OLD\.deepened_at IS NOT NULL/)
  assert.match(migration, /Você já aprofundou o registro de hoje/)
  assert.match(migration, /NEW\.deepened_at := now\(\)/)
})

test('devolutiva de questionário é observacional e rejeita linguagem diagnóstica explícita', () => {
  assert.match(questionnaire, /O que ficou perceptível nas suas respostas:/)
  assert.match(questionnaire, /não é um diagnóstico/)
  assert.match(questionnaire, /safeAdminPerceptionText/)
  assert.match(questionnaire, /DIAGNOSTIC_LANGUAGE/)
  assert.match(questionnaire, /Ansiedade percebida e pensamentos acelerados apareceram/)
  assert.equal(questionnaire.includes('Sinais de ansiedade e sobrecarga emocional'), false)
})

test('questionário continua sugerindo conteúdos relacionados reais e compatíveis com o plano', () => {
  assert.match(questionnaire, /fetchGuidedCatalog/)
  assert.match(questionnaire, /scoreCatalog\(catalog, sig, plan/)
  assert.match(player, /recommendGuidedContent\(_profile\?\.plan, allTags, limit\)/)
  assert.match(player, /Conteúdos guiados recomendados para você/)
})
