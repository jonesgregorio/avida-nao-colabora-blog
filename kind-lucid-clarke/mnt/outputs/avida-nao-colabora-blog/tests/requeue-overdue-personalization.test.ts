import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260820002500_requeue_overdue_personalization.sql', import.meta.url),
  'utf8',
)
const commandBlock = migration.match(/command := \$cron\$([\s\S]*?)\$cron\$/)?.[1] ?? ''

test('tarefas overdue sem rascunho voltam a pending antes do worker', () => {
  assert.ok(commandBlock)
  assert.match(commandBlock, /requeued_overdue_personalization/)
  assert.match(commandBlock, /status='overdue'/)
  assert.match(commandBlock, /SET status='pending'/)
  assert.match(commandBlock, /delivery_id IS NULL/)
  assert.match(commandBlock, /generated_at IS NULL/)
})

test('cron editorial mantém chamada e timeout existentes', () => {
  assert.match(commandBlock, /run-automations/)
  assert.match(commandBlock, /net\.http_post/)
  assert.match(commandBlock, /timeout_milliseconds := 120000/)
  assert.match(migration, /'0 \* \* \* \*'/)
})

test('migration não contém envio automático ao usuário', () => {
  assert.doesNotMatch(migration, /notifications.*insert/i)
  assert.doesNotMatch(migration, /send-transactional-email/i)
  assert.doesNotMatch(migration, /status='sent'/)
})
