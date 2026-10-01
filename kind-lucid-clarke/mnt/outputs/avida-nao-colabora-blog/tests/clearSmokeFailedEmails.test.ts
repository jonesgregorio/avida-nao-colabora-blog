import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('limpeza de e-mails de teste é restrita às contas técnicas prod-smoke', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260930240000_clear_smoke_failed_emails.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  assert.match(code, /delete from public\.email_logs\s+where lower\(coalesce\(to_email, email, ''\)\) like 'prod-smoke-%@example\.com'/)
  assert.doesNotMatch(code, /truncate|drop /i)
  assert.equal((code.match(/delete from/gi) ?? []).length, 1)
})
