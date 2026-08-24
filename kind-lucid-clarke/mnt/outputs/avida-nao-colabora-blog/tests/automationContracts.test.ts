import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('cron emocional está versionado e protegido por token interno', () => {
  const sql = read('supabase/migrations/20260816061853_emotional_automation_permissions_and_cron.sql')
  assert.match(sql, /cron\.schedule\(\s*'run-emotional-automations'/)
  assert.match(sql, /'20 3 \* \* \*'/)
  assert.match(sql, /automation_token/)
  assert.match(sql, /run-emotional-automations/)
})

test('notificação de relatório depende de relatório persistido e generated', () => {
  const sql = read('supabase/migrations/20260816060131_notify_reports_only_after_persist.sql')
  assert.match(sql, /NEW\.status <> 'generated'/)
  assert.match(sql, /reports_notify_after_persist/)
  assert.match(sql, /AFTER INSERT OR UPDATE OF status ON public\.reports/)
  assert.match(sql, /report_id/)
})

test('acesso ilimitado usa entitlement Plus também na defesa do banco', () => {
  const sql = read('supabase/migrations/20260817190000_unlimited_access_effective_plus.sql')
  assert.match(sql, /effective_plan_for_user/)
  assert.match(sql, /has_active_unlimited_access/)
  assert.match(sql, /monthly report requires plus entitlement/)
  assert.match(sql, /enforce_diary_entry_rules/)
})

test('relatório mensal exige qualidade maior que o semanal', () => {
  const edge = read('supabase/functions/run-emotional-automations/index.ts') + read('supabase/functions/run-emotional-automations/runner.ts') + read('supabase/functions/run-emotional-automations/providerReliability.ts')
  assert.match(edge, /periodKind === 'monthly' \? 8 : 3/)
  assert.match(edge, /periodKind === 'monthly' \? 12 : 5/)
})

test('personalização automática usa as tags modernas do diário', () => {
  const edge = read('supabase/functions/run-automations/index.ts')
  assert.match(edge, /emotional_tags/)
  assert.match(edge, /context_tags/)
  assert.match(edge, /need_tags/)
  assert.match(edge, /care_action_tags/)
  assert.match(edge, /trigger_tags/)
})

test('automações editoriais sem executor não podem voltar como ativas', () => {
  const edge = read('supabase/functions/run-automations/index.ts')
  const admin = read('src/components/admin/AdminAutomacoesBlog.tsx')
  for (const legacy of ['update_old', 'notify_after_publish', 'email_after_publish', 'social_caption', 'review_low_perf']) {
    assert.ok(!admin.includes(`value: '${legacy}'`) || admin.includes('LEGACY'))
  }
  assert.match(edge, /executeArticleAutomation/)
  assert.match(edge, /executePautaAutomation/)
  assert.match(edge, /a\.type === 'generate_daily' \|\| a\.type === 'generate_weekly_package'/)
  assert.match(edge, /type === 'monthly_pauta'/)
  assert.match(edge, /editorial_calendar/)
})

test('healthchecks de automações emocional e editorial estão ligados ao Admin', () => {
  const health = read('src/lib/systemHealth.ts')
  const migration = read('supabase/migrations/20260817234000_editorial_automation_health_and_timeout.sql')
  assert.match(health, /get_emotional_automation_health/)
  assert.match(health, /get_editorial_automation_health/)
  assert.match(health, /automation_emotional/)
  assert.match(health, /automation_editorial/)
  assert.match(migration, /run-content-automations/)
  assert.match(migration, /timeout_milliseconds := 120000/)
})

test('helpers de plano efetivo não expõem entitlement de outros usuários autenticados', () => {
  const sql = read('supabase/migrations/20260817235000_harden_effective_plan_helpers.sql')
  assert.match(sql, /auth\.uid\(\) IS DISTINCT FROM p_user_id/)
  assert.match(sql, /NOT public\.is_admin\(\)/)
  assert.match(sql, /not allowed to inspect another user plan/)
})

test('IA emocional possui failover, timeout, retry e validação antes do fallback determinístico', () => {
  const edge = read('supabase/functions/run-emotional-automations/index.ts') + read('supabase/functions/run-emotional-automations/runner.ts') + read('supabase/functions/run-emotional-automations/providerReliability.ts')
  assert.match(edge, /GEMINI_API_KEY/)
  assert.match(edge, /GROQ_API_KEY/)
  assert.match(edge, /OPENAI_API_KEY/)
  assert.match(edge, /EMOTIONAL_AI_TIMEOUT_MS/)
  assert.match(edge, /EMOTIONAL_AI_ATTEMPTS/)
  assert.match(edge, /AbortController/)
  assert.match(edge, /retry-after/)
  assert.match(edge, /JSON inválido/)
  assert.match(edge, /formato incompleto/)
  assert.match(edge, /fallback determinístico aplicado/)
})

test('versões e regras de segurança dos prompts emocionais são compartilhadas', () => {
  const frontend = read('src/lib/aiPrompts/emotionalPrompts.ts')
  const edge = read('supabase/functions/run-emotional-automations/index.ts') + read('supabase/functions/run-emotional-automations/runner.ts') + read('supabase/functions/run-emotional-automations/providerReliability.ts')
  assert.match(frontend, /emotionalPromptContracts/)
  assert.match(edge, /emotionalPromptContracts/)
  assert.match(edge, /EMOTIONAL_PROMPT_VERSIONS/)
  assert.match(edge, /EMOTIONAL_AI_SAFETY_TEXT/)
})

test('falha editorial é reagendada sem fingir execução concluída', () => {
  const source = read('supabase/functions/run-automations/index.ts')
  const start = source.indexOf('Falhas não contam como execução concluída')
  assert.ok(start >= 0)
  const retryBlock = source.slice(start, source.indexOf("results.push({ id: a.id, result: 'erro:", start))
  assert.match(retryBlock, /next_run_at/)
  assert.doesNotMatch(retryBlock, /last_run_at\s*:/)
})

test('indicadores operacionais são admin-only e integrados à Saúde do Sistema', () => {
  const migration = read('supabase/migrations/20260817235500_operational_metrics.sql')
  const health = read('src/lib/systemHealth.ts')
  assert.match(migration, /get_operational_metrics/)
  assert.match(migration, /IF NOT public\.is_admin\(\)/)
  assert.match(migration, /reports_generated_30d/)
  assert.match(migration, /articles_auto_publish_blocked_30d/)
  assert.match(health, /get_operational_metrics/)
  assert.match(health, /operational_metrics/)
})
