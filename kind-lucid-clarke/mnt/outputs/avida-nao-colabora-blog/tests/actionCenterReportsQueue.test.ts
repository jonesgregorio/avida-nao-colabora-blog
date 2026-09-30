import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('fila de relatórios do action center não conta relatórios já gerados', () => {
  const sql = read('supabase/migrations/20260930200000_action_center_reports_only_failed.sql')
  assert.match(sql, /from reports where status = 'failed'/)
  assert.doesNotMatch(sql, /from reports where status in \(/)
  assert.match(sql, /create or replace function public\.admin_action_center_snapshot/)
  assert.match(sql, /if not public\.is_admin\(\)/)
  assert.match(sql, /grant execute on function public\.admin_action_center_snapshot\(\) to authenticated,service_role/)
})
