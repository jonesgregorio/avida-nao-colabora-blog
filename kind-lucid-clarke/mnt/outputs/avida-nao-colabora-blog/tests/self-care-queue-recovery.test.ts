import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260819233500_self_care_queue_recovery.sql', import.meta.url),
  'utf8',
)
const runner = readFileSync(
  new URL('../supabase/functions/run-emotional-automations/index.ts', import.meta.url),
  'utf8',
)

test('schema inclui os metadados já gravados pelo runner emocional', () => {
  assert.match(runner, /error_message: errorMessage/)
  assert.match(runner, /generated_by: actor/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS error_message text/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS generated_by text/)
})

test('cron remove somente placeholders vazios e vencidos antes da geração', () => {
  assert.match(migration, /status = 'pending_generation'/)
  assert.match(migration, /available_at <= \(now\(\) AT TIME ZONE 'America\/Sao_Paulo'\)::date/)
  assert.match(migration, /generated_at IS NULL/)
  assert.match(migration, /reviewed_at IS NULL/)
  assert.match(migration, /sent_at IS NULL/)
  assert.match(migration, /ai_summary IS NULL/)
  assert.match(migration, /jsonb_object_length\(care_plan\)/)
})

test('o mesmo job continua chamando a automação emocional após a limpeza', () => {
  assert.match(migration, /cron\.alter_job/)
  assert.match(migration, /cleared_empty_placeholders/)
  assert.match(migration, /net\.http_post/)
  assert.match(migration, /run-emotional-automations/)
})
