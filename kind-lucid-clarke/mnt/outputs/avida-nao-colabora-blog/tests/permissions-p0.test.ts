import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260819214900_permissions_p0_hardening.sql', import.meta.url),
  'utf8',
)
const page = readFileSync(new URL('../src/components/QuestionnairesPage.tsx', import.meta.url), 'utf8')

test('catálogo público de questionários não expõe perguntas ou resultados', () => {
  assert.match(migration, /FUNCTION public\.get_questionnaire_catalog\(\)/)
  assert.match(migration, /question_count integer/)
  const catalogBody = migration.split('CREATE OR REPLACE FUNCTION public.get_questionnaire_catalog()')[1]?.split('REVOKE ALL')[0] ?? ''
  assert.doesNotMatch(catalogBody, /q\.results/)
  assert.match(page, /rpc\('get_questionnaire_catalog'\)/)
  assert.doesNotMatch(page, /scheduled_at,questions,created_at/)
})

test('questionário completo e tabelas-filhas exigem autorização do plano', () => {
  assert.match(migration, /CREATE POLICY "questionnaires_user_access"/)
  assert.match(migration, /public\.can_access_questionnaire\(id\)/)
  assert.match(migration, /CREATE POLICY "questionnaire_questions_user_access"/)
  assert.match(migration, /CREATE POLICY "questionnaire_options_user_access"/)
  assert.match(migration, /CREATE POLICY "questionnaire_results_user_access"/)
  assert.match(migration, /DROP POLICY IF EXISTS "questionnaires_read"/)
  assert.match(migration, /DROP POLICY IF EXISTS "qq_read"/)
  assert.match(migration, /DROP POLICY IF EXISTS "qo_read"/)
  assert.match(migration, /DROP POLICY IF EXISTS "qr_read"/)
})

test('criar ou continuar resposta exige direito atual ao questionário', () => {
  assert.match(migration, /CREATE POLICY "questionnaire_responses_user_insert"/)
  assert.match(migration, /CREATE POLICY "questionnaire_responses_user_update"/)
  assert.match(migration, /questionnaire_id IS NOT NULL[\s\S]*public\.can_access_questionnaire\(questionnaire_id\)/)
  assert.match(migration, /CREATE POLICY "questionnaire_responses_user_select"/)
})

test('comentários profissionais e revisões de autocuidado seguem Plus ativo', () => {
  assert.match(migration, /CREATE POLICY "professional_comments_plus_user"/)
  assert.match(migration, /CREATE POLICY "self_care_reviews_plus_user"/)
  assert.match(migration, /public\.current_user_has_plan\('plus'\)/)
})
