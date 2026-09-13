import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260828013500_care_plan_action_feedback.sql')
const livingMigration = read('supabase/migrations/20260908211000_living_self_care_plan.sql')
const grantFix = read('supabase/migrations/20260828015000_care_plan_feedback_minimum_grants.sql')
const component = read('src/components/CarePlanActionFeedback.tsx')
const page = read('src/components/SelfCarePlanPage.tsx')
const runner = read('supabase/functions/run-emotional-automations/runner.ts')
const contracts = read('supabase/functions/_shared/emotionalPromptContracts.ts')

test('feedback por ação continua estruturado, reversível e não representa conclusão', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.care_plan_action_feedback/)
  assert.match(migration, /feedback IN \('helpful', 'later', 'not_for_me'\)/)
  assert.match(livingMigration, /outcome IN \('helped','neutral','not_tried','could_not','adapt','not_for_me'\)/)
  assert.match(livingMigration, /adapted_text text/)
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
  assert.match(livingMigration, /ALTER TABLE public\.care_plan_action_state ENABLE ROW LEVEL SECURITY/)
  assert.match(livingMigration, /p\.status = 'sent'/)
  assert.match(migration, /care_plan_feedback_admin_all/)
  assert.match(migration, /REVOKE ALL ON public\.care_plan_action_feedback FROM anon/)
})

test('authenticated recebe somente operações CRUD necessárias na tabela legada de feedback', () => {
  assert.match(grantFix, /REVOKE ALL ON public\.care_plan_action_feedback FROM authenticated/)
  assert.match(grantFix, /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.care_plan_action_feedback TO authenticated/)
  assert.match(grantFix, /REVOKE ALL ON public\.care_plan_action_feedback FROM anon/)
  assert.doesNotMatch(grantFix, /GRANT[^\n]*(TRUNCATE|TRIGGER|REFERENCES)[^\n]*authenticated/)
})

test('Plano de Autocuidado mantém compatibilidade com o componente de percepção', () => {
  assert.match(page, /import CarePlanActionFeedback from '.\/CarePlanActionFeedback'/)
  assert.match(page, /<CarePlanActionFeedback userId=\{user\.id\} carePlanId=\{previous\.id\} actions=\{actionsOf\(previous\.care_plan\)\}\/>/)
})

test('próximo Plano de Autocuidado lê primeiro os seis retornos do estado vivo', () => {
  assert.match(runner, /loadPreviousCarePlanFeedback/)
  assert.match(runner, /\.from\('monthly_care_plans'\)[\s\S]*\.eq\('status', 'sent'\)[\s\S]*\.lt\('period_end', beforeStart\)/)
  assert.match(runner, /\.from\('care_plan_action_state'\)[\s\S]*\.select\('action_key,action_text,state,outcome,adapted_text,updated_at'\)/)
  assert.match(runner, /\['helped', 'neutral', 'not_tried', 'could_not', 'adapt', 'not_for_me'\]/)
  assert.match(runner, /adapted_action: adapted \|\| null/)
  assert.match(runner, /source: 'living'/)
  assert.match(runner, /prompt\('self_care_plan', s, previousCareFeedback\)/)
  assert.match(runner, /previous_care_action_feedback: careFeedbackSummary\(previousCareFeedback\)/)
})

test('feedback legado permanece como fallback sem bloquear a automação mensal', () => {
  assert.match(runner, /Compatibilidade para planos antigos/)
  assert.match(runner, /\.from\('care_plan_action_feedback'\)[\s\S]*\.select\('action_index,feedback'\)/)
  assert.match(runner, /source: 'legacy'/)
})

test('prompt v4 diferencia as seis respostas sem tratar percepção como eficácia', () => {
  assert.match(contracts, /self_care_plan: 'self_care_plan_v4'/)
  assert.match(runner, /feedback=helped/)
  assert.match(runner, /feedback=neutral/)
  assert.match(runner, /feedback=not_tried/)
  assert.match(runner, /feedback=could_not/)
  assert.match(runner, /feedback=adapt/)
  assert.match(runner, /feedback=not_for_me/)
  assert.match(runner, /priorize adapted_action/)
  assert.match(runner, /não são progresso, conclusão, diagnóstico ou prova de melhora/)
  assert.match(runner, /Não mencione mecanismo de feedback, pontuação, sistema interno ou bastidores/)
})

test('resumo interno preserva contagens sem armazenar o texto adaptado', () => {
  assert.match(runner, /adapted_actions: items\.filter\(item => Boolean\(item\.adapted_action\)\)\.length/)
  assert.doesNotMatch(runner, /previous_care_action_feedback:\s*previousCareFeedback/)
})
