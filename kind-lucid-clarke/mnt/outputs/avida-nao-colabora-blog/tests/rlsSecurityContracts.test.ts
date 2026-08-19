import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(here, '..', 'supabase', 'migrations', '096_ticket_messages_internal_rls.sql')
const sql = readFileSync(migrationPath, 'utf8')

function occurrences(pattern: RegExp): number {
  return [...sql.matchAll(pattern)].length
}

test('RLS de suporte remove a policy ampla que ignorava mensagens internas', () => {
  assert.match(
    sql,
    /DROP\s+POLICY\s+IF\s+EXISTS\s+"ticket_messages_own"\s+ON\s+public\.ticket_messages\s*;/i,
  )
})

test('usuário só acessa mensagens não internas de tickets próprios', () => {
  assert.match(sql, /CREATE\s+POLICY\s+"users_own_messages"[\s\S]*FOR\s+ALL[\s\S]*TO\s+authenticated/i)
  assert.ok(
    occurrences(/st\.user_id\s*=\s*auth\.uid\(\)/gi) >= 2,
    'a regra de propriedade do ticket deve existir em USING e WITH CHECK',
  )
  assert.ok(
    occurrences(/NOT\s+COALESCE\(ticket_messages\.is_internal,\s*false\)/gi) >= 2,
    'mensagens internas devem ser bloqueadas em USING e WITH CHECK',
  )
})

test('migration mantém RLS explicitamente habilitado e não remove policies admin', () => {
  assert.match(sql, /ALTER\s+TABLE\s+public\.ticket_messages\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\s*;/i)
  assert.doesNotMatch(sql, /DROP\s+POLICY[^;]*(?:admin|admins)[^;]*;/i)
})
