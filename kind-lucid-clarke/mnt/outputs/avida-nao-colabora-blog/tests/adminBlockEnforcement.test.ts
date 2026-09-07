import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260907140000_admin_set_account_status.sql')
const impl = read('src/components/admin/AdminUsersImpl.tsx')
const auth = read('src/components/Auth.tsx')

test('RPC de status de conta é admin-only e bane no GoTrue', () => {
  assert.match(migration, /create or replace function public\.admin_set_account_status/i)
  assert.match(migration, /security definer/i)
  assert.match(migration, /if not is_admin\(\) then/i)
  // Camada de verdade: mexe em auth.users.banned_until.
  assert.match(migration, /update auth\.users\s+set\s+banned_until = case when new_status = 'active' then null/i)
  // Admin não bane a si mesmo.
  assert.match(migration, /target_user_id = auth\.uid\(\) and new_status <> 'active'/i)
  assert.match(migration, /revoke execute on function public\.admin_set_account_status\(uuid, text, text\) from anon/i)
  assert.match(migration, /grant execute on function public\.admin_set_account_status\(uuid, text, text\) to authenticated/i)
})

test('bloquear/suspender/desbloquear passam pela RPC (não mais UPDATE direto em profiles)', () => {
  assert.match(impl, /supabase\.rpc\('admin_set_account_status'/)
  assert.match(impl, /logAdminAction\('update', 'account_status'/)
  assert.doesNotMatch(impl, /from\('profiles'\)\.update\(\{\s*account_status: 'blocked'/)
  assert.match(impl, /não pode bloquear ou suspender a sua própria conta/i)
})

test('login de conta banida mostra mensagem amigável', () => {
  assert.match(auth, /user_banned|user is banned/i)
  assert.match(auth, /Esta conta está bloqueada/i)
})
