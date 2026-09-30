import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('rede de segurança do boas-vindas usa a mesma idempotency_key do navegador', () => {
  const fn = read('supabase/functions/run-lifecycle-emails/index.ts')
  const triggers = read('src/lib/emailTriggers.ts')
  assert.match(triggers, /idempotencyKey: `welcome:\$\{userId\}`/)
  assert.match(fn, /only === 'welcome'/)
  assert.match(fn, /`welcome:\$\{u\.user_id\}`/)
})

test('rede de segurança só olha confirmações recentes (sem backfill) e respeita carência', () => {
  const fn = read('supabase/functions/run-lifecycle-emails/index.ts')
  assert.match(fn, /WINDOW_MS = 24 \* 60 \* 60 \* 1000/)
  assert.match(fn, /GRACE_MS = 2 \* 60 \* 1000/)
  assert.match(fn, /email_confirmed_at/)
})

test('cron do boas-vindas roda a cada 15 min com o token interno e é idempotente', () => {
  const sql = read('supabase/migrations/20260930180000_cron_welcome_email_safety_net.sql')
  assert.match(sql, /\*\/15 \* \* \* \*/)
  assert.match(sql, /"only":"welcome"/)
  assert.match(sql, /private\.cron_config/)
  assert.match(sql, /cron\.unschedule/)
})
