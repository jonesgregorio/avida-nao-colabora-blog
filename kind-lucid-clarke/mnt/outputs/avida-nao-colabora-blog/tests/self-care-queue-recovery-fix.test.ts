import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260819235000_self_care_queue_recovery_fix.sql', import.meta.url),
  'utf8',
)
const commandBlock = migration.match(/command := \$cron\$([\s\S]*?)\$cron\$/)?.[1] ?? ''

test('recuperação usa operações JSONB compatíveis com o banco live', () => {
  assert.ok(commandBlock, 'bloco de comando do cron deve existir')
  assert.doesNotMatch(commandBlock, /jsonb_object_length/)
  assert.match(commandBlock, /COALESCE\(ai_summary_json, '\{\}'::jsonb\) = '\{\}'::jsonb/)
  assert.match(commandBlock, /COALESCE\(care_plan, '\{\}'::jsonb\) = '\{\}'::jsonb/)
})

test('limpeza fica limitada ao último mês fechado', () => {
  assert.match(commandBlock, /month_reference = date_trunc/)
  assert.match(commandBlock, /interval '1 month'/)
  assert.match(commandBlock, /America\/Sao_Paulo/)
})

test('hotfix mantém o mesmo cron e a mesma Edge Function', () => {
  assert.match(migration, /cron\.alter_job/)
  assert.match(commandBlock, /run-emotional-automations/)
  assert.match(commandBlock, /net\.http_post/)
})
