import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('eventos do Admin ignoram contas técnicas do smoke e limpam o histórico técnico', () => {
  const sql = read('supabase/migrations/20260930190000_admin_activity_ignore_technical_accounts.sql')
  assert.match(sql, /create or replace function public\._admin_activity_emit/)
  assert.match(sql, /like 'prod-smoke-%@example\.com'/)
  assert.match(sql, /insert into public\.admin_activity_events/)
  // o delete é restrito ao padrão técnico, nunca a todos os eventos
  const del = sql.slice(sql.indexOf('delete from public.admin_activity_events'))
  assert.match(del, /where lower\(coalesce\(metadata->>'email', ''\)\) like 'prod-smoke-%@example\.com'/)
})
