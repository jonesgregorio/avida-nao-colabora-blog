import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('cron do boas-vindas roda a cada 15 min com o token interno e é idempotente', () => {
  const sql = read('supabase/migrations/20260930180000_cron_welcome_email_safety_net.sql')
  assert.match(sql, /\*\/15 \* \* \* \*/)
  assert.match(sql, /"only":"welcome"/)
  assert.match(sql, /private\.cron_config/)
  assert.match(sql, /cron\.unschedule/)
})

test('a função chamada pelo cron já suporta o modo welcome', () => {
  assert.match(read('supabase/functions/run-lifecycle-emails/index.ts'), /only === 'welcome'/)
})
