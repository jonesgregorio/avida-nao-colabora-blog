import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('limpeza do suporte é restrita aos 2 tickets de teste por ID e não toca templates nem storage', () => {
  const sql = read('supabase/migrations/20260930210000_clear_support_test_tickets.sql')
  const code = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
  assert.match(code, /delete from public\.ticket_messages\s+where ticket_id in/)
  assert.match(code, /delete from public\.support_tickets\s+where id in/)
  assert.equal((code.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? []).length, 4)
  assert.doesNotMatch(code, /support_reply_templates|storage\.|truncate/i)
})
