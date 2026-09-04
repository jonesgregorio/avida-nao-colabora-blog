import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const diaryEntry = readFileSync(new URL('../src/components/DiaryPage.tsx', import.meta.url), 'utf8')
const diary = readFileSync(new URL('../src/components/DiaryExperience.tsx', import.meta.url), 'utf8')
// A tela de "registro salvo" saiu de DiaryExperience.tsx pra
// DiarySavedReflection.tsx numa componentização posterior (Parte 17).
const savedReflection = readFileSync(new URL('../src/components/DiarySavedReflection.tsx', import.meta.url), 'utf8')
const questionnaire = readFileSync(new URL('../src/lib/questionnaireResult.ts', import.meta.url), 'utf8')
const player = readFileSync(new URL('../src/components/QuestionnairePlayer.tsx', import.meta.url), 'utf8')
const legacyMigration = readFileSync(new URL('../supabase/migrations/20260823150500_diary_single_deepening_flow.sql', import.meta.url), 'utf8')
const currentMigration = readFileSync(new URL('../supabase/migrations/20260904024500_checkin_unico_tres_aprofundamentos.sql', import.meta.url), 'utf8')

test('rota canônica usa o Diário e mantém o check-in como experiência separada da Home', () => {
  assert.match(diaryEntry, /DiaryExperience/)
  assert.match(savedReflection, /Quero escrever sobre isso/)
  assert.match(diary, /Check-in e Diário são separados/)
  assert.match(diary, /check-in é feito uma única vez ao dia pela Página Inicial/i)
  assert.doesNotMatch(diary, />Fazer check-in rápido<\/button>/)
  assert.match(diary, /setMode\('diary'\)/)
})

test('novo fluxo não cria complemento separado e permite até três aprofundamentos do mesmo Diário', () => {
  assert.equal(diary.includes("setMode('addon')"), false)
  assert.equal(diary.includes("mode === 'addon'"), false)
  assert.equal(diary.includes('Adicionar complemento'), false)
  assert.equal(diary.includes('Editar diário de hoje'), false)
  assert.equal(diary.includes('Editar registro de hoje'), false)
  assert.match(diary, /Aprofundar meu registro/)
  assert.match(diary, /Salvar aprofundamento/)
  assert.match(diary, /MAX_DEEPENINGS_PER_DAY = 3/)
})

test('banco limita o Diário a três aprofundamentos e continua bloqueando addons', () => {
  assert.match(legacyMigration, /ADD COLUMN IF NOT EXISTS deepened_at TIMESTAMPTZ/)
  assert.match(currentMigration, /effective_plan_for_user\(NEW\.user_id\)/)
  assert.match(currentMigration, /TG_OP = 'INSERT' AND new_kind = 'addon'/)
  assert.match(currentMigration, /deepening_count BETWEEN 0 AND 3/)
  assert.match(currentMigration, /COALESCE\(OLD\.deepening_count, 0\) >= 3/)
  assert.match(currentMigration, /Você já usou os 3 aprofundamentos disponíveis para o diário de hoje/)
  assert.match(currentMigration, /NEW\.deepening_count := COALESCE\(OLD\.deepening_count, 0\) \+ 1/)
  assert.match(currentMigration, /NEW\.deepened_at := now\(\)/)
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
