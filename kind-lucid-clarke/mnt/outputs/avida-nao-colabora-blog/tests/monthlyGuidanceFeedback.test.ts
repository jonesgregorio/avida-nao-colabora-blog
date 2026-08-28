import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260828020500_monthly_guidance_feedback.sql')
const component = read('src/components/MonthlyGuidanceFeedback.tsx')
const page = read('src/components/MonthlyGuidancePage.tsx')

test('feedback da orientação é único, estruturado e reversível', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.monthly_guidance_feedback/)
  assert.match(migration, /feedback IN \('helpful', 'partial', 'not_for_me'\)/)
  assert.match(migration, /UNIQUE \(guidance_request_id\)/)
  assert.match(migration, /cardinality\(tags\) <= 3/)
  assert.match(component, /Me ajudou/)
  assert.match(component, /Em parte/)
  assert.match(component, /Não combinou comigo/)
  assert.match(component, /\.upsert\(/)
  assert.match(component, /\.delete\(\)/)
  assert.match(component, /Remover avaliação/)
})

test('feedback não cria chat, texto livre nem gamificação', () => {
  assert.doesNotMatch(component, /<textarea|contentEditable|placeholder=.*mensagem|Enviar mensagem|Responder orientação/i)
  assert.doesNotMatch(component, /\bscore\b|\bpoints?\b|\bstreak\b|\bcompleted\b/i)
  assert.match(component, /não abre uma nova conversa/i)
  assert.doesNotMatch(migration, /message\s+text|response\s+text|reply\s+text/i)
})

test('RLS só permite avaliar orientação própria já respondida e grants são mínimos', () => {
  assert.match(migration, /ALTER TABLE public\.monthly_guidance_feedback ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /g\.user_id = auth\.uid\(\)/)
  assert.match(migration, /g\.status = 'answered'/)
  assert.match(migration, /has_active_unlimited_access\(auth\.uid\(\)\)/)
  assert.match(migration, /effective_plan_for_user\(p\.user_id\) = 'plus'/)
  assert.match(migration, /REVOKE ALL ON public\.monthly_guidance_feedback FROM authenticated/)
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.monthly_guidance_feedback TO authenticated/)
  assert.doesNotMatch(migration, /GRANT[^\n]*(TRUNCATE|TRIGGER|REFERENCES)[^\n]*authenticated/)
})

test('avaliação aparece somente depois da orientação respondida', () => {
  assert.match(page, /import MonthlyGuidanceFeedback from '.\/MonthlyGuidanceFeedback'/)
  assert.match(page, /\{answered \? \([\s\S]*<MonthlyGuidanceFeedback userId=\{userId\} guidanceRequestId=\{req\.id\} \/>[\s\S]*\) : \(/)
  assert.match(page, /Sua orientação já está disponível no histórico abaixo/)
})
