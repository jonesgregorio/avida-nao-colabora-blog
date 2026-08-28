import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260828013500_care_plan_action_feedback.sql')
const component = read('src/components/CarePlanActionFeedback.tsx')
const page = read('src/components/SelfCarePlanPage.tsx')
const runner = read('supabase/functions/run-emotional-automations/runner.ts')
const contracts = read('supabase/functions/_shared/emotionalPromptContracts.ts')

test('feedback por ação é estruturado, reversível e não representa conclusão', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.care_plan_action_feedback/)
  assert.match(migration, /feedback IN \('helpful', 'later', 'not_for_me'\)/)
  assert.match(migration, /UNIQUE \(care_plan_id, action_index\)/)
  assert.match(component, /Fez sentido/)
  assert.match(component, /Talvez depois/)
  assert.match(component, /Não combinou comigo/)
  assert.match(component, /aria-pressed=/)
  assert.match(component, /\.upsert\(/)
  assert.match(component, /\.delete\(\)/)
  assert.match(component, /Não há meta, pontuação ou sequência\./)
  assert.doesNotMatch(component, /\bsetScore\b|\bsetPoints\b|\bsetStreak\b|\bsetCompleted\b/)
})

test('RLS limita feedback ao próprio plano enviado e mantém administração separada', () => {
  assert.match(migration, /ALTER TABLE public\.care_plan_action_feedback ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /p\.user_id = auth\.uid\(\)/)
  assert.match(migration, /p\.status = 'sent'/)
  assert.match(migration, /has_active_unlimited_access\(auth\.uid\(\)\)/)
  assert.match(migration, /effective_plan_for_user\(pr\.user_id\) = 'plus'/)
  assert.match(migration, /care_plan_feedback_admin_all/)
  assert.match(migration, /REVOKE ALL ON public\.care_plan_action_feedback FROM anon/)
})

test('Plano de Autocuidado delega microações ao componente de percepção', () => {
  assert.match(page, /import CarePlanActionFeedback from '.\/CarePlanActionFeedback'/)
  assert.match(page, /<CarePlanActionFeedback userId=\{userId\} carePlanId=\{plan\.id\} actions=\{microActions\}/)
  assert.doesNotMatch(page, /microActions\.map\(\(t, i\)/)
})

test('próximo roteiro usa apenas feedback estruturado do último plano enviado', () => {
  assert.match(runner, /loadPreviousCarePlanFeedback/)
  assert.match(runner, /\.from\('monthly_care_plans'\)[\s\S]*\.eq\('status', 'sent'\)[\s\S]*\.lt\('period_end', beforeStart\)/)
  assert.match(runner, /\.from\('care_plan_action_feedback'\)[\s\S]*\.select\('action_index,feedback'\)/)
  assert.match(runner, /prompt\('self_care_plan', s, previousCareFeedback\)/)
  assert.match(runner, /previous_care_action_feedback: careFeedbackSummary\(previousCareFeedback\)/)
  assert.match(runner, /if \(feedbackError \|\| !rows\?\.length\) return \[\]/)
  assert.doesNotMatch(runner, /care_plan_action_feedback[\s\S]{0,220}select\([^)]*(content|body|description|diary)/)
})

test('prompt trata percepção como preferência, não como eficácia ou progresso', () => {
  assert.match(contracts, /self_care_plan: 'self_care_plan_v3'/)
  assert.match(runner, /helpful apenas como "fez sentido"/)
  assert.match(runner, /later como "talvez depois"/)
  assert.match(runner, /not_for_me como "não combinou comigo"/)
  assert.match(runner, /não são progresso, conclusão, diagnóstico ou prova de melhora/)
  assert.match(runner, /Não mencione mecanismo de feedback, pontuação, sistema interno ou bastidores/)
})
