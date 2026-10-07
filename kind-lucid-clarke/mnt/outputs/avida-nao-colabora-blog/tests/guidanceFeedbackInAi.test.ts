import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('rascunho da orientação recebe as avaliações anteriores, filtradas por valores conhecidos', () => {
  const prompts = read('src/lib/aiPrompts/emotionalPrompts.ts')
  assert.match(prompts, /previous_guidance_feedback: compactGuidanceFeedback\(context\?\.previous_guidance_feedback\)/)
  assert.match(prompts, /GUIDANCE_FEEDBACK_VALUES = new Set\(\['helpful', 'partial', 'not_for_me'\]\)/)
  assert.match(prompts, /GUIDANCE_FEEDBACK_TAGS = new Set\(\[[^\]]*'missing_practical_steps'\]\)/)
  assert.match(prompts, /topic" for parecido com o pedido atual ou quando fizer sentido/)
  assert.match(prompts, /Nunca mencione avaliação, retorno ou sistema na resposta/)
})

test('Admin envia as avaliações das orientações anteriores ao gerar o rascunho', () => {
  const admin = read('src/components/admin/AdminGuidanceRequests.tsx')
  assert.match(admin, /from\('monthly_guidance_feedback'\)[\s\S]*neq\('guidance_request_id', selected\.id\)[\s\S]*limit\(3\)/)
  assert.match(admin, /previous_guidance_feedback: previousGuidanceFeedback/)
})

test('plano de autocuidado considera as avaliações da orientação sem levar texto livre', () => {
  const runner = read('supabase/functions/run-emotional-automations/runner.ts')
  assert.match(runner, /from\('monthly_guidance_feedback'\)\s*\n\s*\.select\('feedback,tags,monthly_guidance_requests\(month_key\)'\)/)
  assert.doesNotMatch(runner, /monthly_guidance_requests\([^)]*message/)
  assert.match(runner, /prompt\('self_care_plan', s, previousCareFeedback, guidanceFeedback/)
  assert.match(runner, /guidanceContext = guidanceFeedback\.length/)
})

test('relatórios e plano consideram as percepções sobre Descobertas, respeitando "não quero acompanhar"', () => {
  const runner = read('supabase/functions/run-emotional-automations/runner.ts')
  assert.match(runner, /from\('user_discovery_feedback'\)\s*\n\s*\.select\('discovery_key,feedback'\)/)
  assert.match(runner, /allowed = new Set\(\['made_sense', 'sort_of', 'not_following'\]\)/)
  assert.match(runner, /feedback=not_following indica que a pessoa NÃO quer acompanhar esse assunto/)
  assert.match(runner, /'weekly_report' : 'monthly_deep_report', summary, \[\], await loadGuidanceFeedback\(admin, profile\.user_id\), await loadDiscoveryFeedback\(admin, profile\.user_id\)/)
  assert.match(runner, /prompt\('self_care_plan', s, previousCareFeedback, guidanceFeedback, await loadDiscoveryFeedback/)
})
