import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260907200000_admin_audit_hardening.sql')
const comp = read('src/components/admin/AdminLogs.tsx')

test('a auditoria vira somente-anexar: sem policy FOR ALL, com gatilho que barra UPDATE/DELETE', () => {
  assert.match(migration, /drop policy if exists "admin_logs_admin" on public\.admin_logs/i)
  assert.match(migration, /create policy "admin_logs_select_admin"[\s\S]*?for select/i)
  assert.match(migration, /create policy "admin_logs_insert_admin"[\s\S]*?for insert/i)
  assert.doesNotMatch(migration, /create policy[\s\S]*?admin_logs[\s\S]*?for all/i)
  assert.match(migration, /before update or delete on public\.admin_logs/i)
  assert.match(migration, /raise exception 'admin_logs é somente-anexar/i)
})

test('o gatilho de auditoria grava o diff de valor anterior/novo no UPDATE', () => {
  assert.match(migration, /if tg_op = 'UPDATE' then/i)
  assert.match(migration, /jsonb_build_object\('de', v_old->v_key, 'para', v_new->v_key\)/i)
  assert.match(migration, /'changes',\s*case when v_changes/i)
  // Campos ruidosos/sensíveis ficam de fora do diff.
  assert.match(migration, /v_skip\s+text\[\]\s*:=\s*array\[/i)
  assert.match(migration, /'content','body'/i)
})

test('admin_audit_query é admin-only, paginada e não exposta a anon', () => {
  assert.match(migration, /create or replace function public\.admin_audit_query\(/i)
  assert.match(migration, /if not public\.is_admin\(\) then\s*\n\s*raise exception 'not authorized'/i)
  assert.match(migration, /v_limit\s+integer\s*:=\s*least\(greatest\(coalesce\(p_limit, 50\), 1\), 200\)/i)
  assert.match(migration, /limit v_limit offset v_offset/i)
  assert.match(migration, /revoke all on function public\.admin_audit_query\([^)]*\) from public, anon/i)
  assert.match(migration, /grant execute on function public\.admin_audit_query\([^)]*\) to authenticated/i)
})

test('a RPC devolve as listas de filtros (administradores, módulos, ações)', () => {
  assert.match(migration, /'filters', jsonb_build_object\(/i)
  assert.match(migration, /'admins',/i)
  assert.match(migration, /'modules',/i)
  assert.match(migration, /'actions',/i)
})

test('a tela de Auditoria usa a RPC filtrada, degrada e mostra valor anterior/novo', () => {
  assert.match(comp, /supabase\.rpc\('admin_audit_query'/)
  assert.match(comp, /admin_audit_query\|does not exist\|schema cache/)
  assert.match(comp, /from\('admin_logs'\)/) // fallback de leitura direta
  assert.match(comp, /p_admin|p_module|p_action|p_from|p_to/)
  assert.match(comp, /changes/)
  assert.match(comp, /não podem ser editados nem apagados/i)
})
