import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const rbac = read('supabase/migrations/20260907260000_admin_rbac.sql')
const enforce = read('supabase/migrations/20260907260100_admin_rbac_enforce.sql')
const layout = read('src/components/admin/AdminLayout.tsx')
const perms = read('src/components/admin/AdminPermissions.tsx')

test('não altera is_admin() e ninguém perde acesso (admin atual vira super_admin)', () => {
  assert.doesNotMatch(rbac, /create or replace function public\.is_admin\(/i)
  assert.match(rbac, /update public\.profiles set admin_role = 'super_admin'\s*\n\s*where role = 'admin' and admin_role is null/i)
})

test('admin_can exige is_admin() por dentro (anônimo continua bloqueado)', () => {
  assert.match(rbac, /create or replace function public\.admin_can\(p_module text, p_action text/i)
  assert.match(rbac, /select public\.is_admin\(\) and \(/i)
  assert.match(rbac, /= 'super_admin'\s*\n\s*or exists \(/i)
})

test('trocar papel exige quem gerencia permissões e protege o último super admin', () => {
  assert.match(rbac, /create or replace function public\.admin_set_admin_role\(/i)
  assert.match(rbac, /if not public\.admin_can\('permissions','manage'\) then/i)
  assert.match(rbac, /não é possível rebaixar o último super admin/i)
})

test('a checagem por papel é aplicada no BACKEND das RPCs sensíveis', () => {
  assert.match(enforce, /admin_grant_courtesy_days[\s\S]*?if not public\.admin_can\('finance','operate'\) then/i)
  assert.match(enforce, /admin_segment_notify[\s\S]*?if not public\.admin_can\('users','operate'\) then/i)
  assert.match(enforce, /admin_communication_send[\s\S]*?if not public\.admin_can\('communication','operate'\) then/i)
  assert.match(enforce, /admin_restore_article_version[\s\S]*?if not public\.admin_can\('content','operate'\) then/i)
  assert.match(enforce, /admin_audit_query[\s\S]*?if not public\.admin_can\('audit','view'\) then/i)
})

test('a matriz e as permissões só são graváveis via RPC (cliente não escreve direto)', () => {
  assert.match(rbac, /revoke insert, update, delete on public\.admin_permissions from authenticated, anon/i)
  assert.match(rbac, /create policy admin_permissions_read on public\.admin_permissions\s*\n\s*for select/i)
})

test('o menu é filtrado por papel mas degrada para completo quando a RPC não existe', () => {
  assert.match(layout, /supabase\.rpc\('admin_my_permissions'\)/)
  assert.match(layout, /if \(error \|\| !mods \|\| mods\.includes\('\*'\)\) \{ setAllowed\(null\)/)
  assert.match(layout, /visibleNav\.map/)
})

test('a tela de Permissões troca papel e mostra a matriz, degradando sem RBAC', () => {
  assert.match(perms, /supabase\.rpc\('admin_set_admin_role'/)
  assert.match(perms, /supabase\.rpc\('admin_rbac_matrix'\)/)
  assert.match(perms, /dispon[íi]ve(l|is) após o deploy desta etapa/i)
  assert.match(perms, /logAdminAction\('config', 'admin_role'/)
})
