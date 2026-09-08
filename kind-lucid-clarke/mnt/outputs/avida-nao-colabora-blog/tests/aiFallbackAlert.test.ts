import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const runner = read('supabase/functions/run-emotional-automations/runner.ts')
const migration = read('supabase/migrations/20260908010000_ai_fallback_alert_template.sql')
const carePlan = read('src/components/admin/AdminMonthlyCarePlans.tsx')

test('run-emotional-automations rastreia fallbacks e alerta o admin no fim da execução', () => {
  assert.match(runner, /const fallbackItems: \{ user_id: string; kind: string; reason: string \}\[\] = \[\]/)
  assert.match(runner, /if \(fallback\) fallbackItems\.push\(\{ user_id: profile\.user_id, kind: promptType/)
  assert.match(runner, /if \(fallback\) fallbackItems\.push\(\{ user_id: profile\.user_id, kind: 'self_care_plan'/)
  assert.match(runner, /if \(fallbackItems\.length > 0\)/)
})

test('o alerta vai por e-mail (ADMIN_ALERT_EMAIL) e para a auditoria, sem quebrar a execução', () => {
  assert.match(runner, /template_key: 'admin_ai_fallback_alert'/)
  assert.match(runner, /ADMIN_ALERT_EMAIL/)
  assert.match(runner, /from\('admin_logs'\)\.insert\(\{[\s\S]*?target_type: 'ai_fallback'/)
  // Best-effort: cada bloco de alerta tem seu try/catch e não interrompe o return.
  assert.match(runner, /catch \(e\) \{ console\.error\('ai_fallback admin_log:'/)
  assert.match(runner, /catch \(e\) \{ console\.error\('ai_fallback alert email:'/)
  assert.match(runner, /return json\(\{ ok: true, prompt_versions: PROMPT_VERSION, results, fallbacks: fallbackItems\.length \}\)/)
})

test('o template de e-mail do alerta existe e é idempotente', () => {
  assert.match(migration, /template_key.*'admin_ai_fallback_alert'|'admin_ai_fallback_alert'/)
  assert.match(migration, /on conflict \(template_key\) do update set/i)
  assert.match(migration, /\{\{quantidade\}\}/)
  assert.match(migration, /\{\{motivo\}\}/)
  assert.match(migration, /\{\{link_admin\}\}/)
})

test('a tela de revisão do plano avisa e trava quando o rascunho é de emergência', () => {
  assert.match(carePlan, /Rascunho de emergência — a IA falhou/)
  assert.match(carePlan, /error_message: string \| null/)
  // Guard no envio: fallback não editado exige confirmação forte.
  assert.match(carePlan, /if \(next === 'send' && fallbackUsed && !generatedByAI && !editedByHuman\)/)
  assert.match(carePlan, /RASCUNHO DE EMERGÊNCIA \(a IA falhou\)/)
  // O botão de regeração muda de rótulo quando é fallback.
  assert.match(carePlan, /fallbackUsed \? 'Tentar gerar com IA de novo'/)
})
