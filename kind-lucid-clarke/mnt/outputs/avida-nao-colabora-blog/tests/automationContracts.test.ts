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
  const edge = read('supabase/functions/run-emotional-automations/index.ts')
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
  assert.match(edge, /generate_daily/)
  assert.match(edge, /generate_weekly_package/)
  assert.match(edge, /generate_pauta/)
  assert.match(edge, /monthly_pauta/)
})
