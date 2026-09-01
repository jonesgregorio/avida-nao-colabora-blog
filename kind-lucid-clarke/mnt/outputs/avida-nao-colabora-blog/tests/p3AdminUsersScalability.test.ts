import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('P3.22 move listagem, agregados e atividade do AdminUsers para o servidor', () => {
  const migration = read('supabase/migrations/20260901025500_admin_users_scalable.sql')
  const server = read('src/components/admin/adminUsersServer.ts')
  const impl = read('src/components/admin/AdminUsersImpl.tsx')

  assert.match(migration, /admin_users_stats_v2/)
  assert.match(migration, /admin_list_users_v2/)
  assert.match(migration, /OFFSET \(safe_page - 1\) \* safe_page_size/)
  assert.match(migration, /LIMIT safe_page_size/)
  assert.match(migration, /LEFT JOIN LATERAL/)
  assert.match(migration, /MAX\(d\.created_at\)/i)
  assert.match(migration, /idx_support_tickets_user_status/)
  assert.match(migration, /public\.is_admin\(\)/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_list_users_v2/)

  assert.match(server, /rpc\('admin_users_stats_v2'\)/)
  assert.match(server, /rpc\('admin_list_users_v2'/)
  assert.match(server, /pageSize = 200/)
  assert.match(server, /while \(rows\.length < total\)/)

  assert.doesNotMatch(impl, /filterAdminUsers\(users/)
  assert.doesNotMatch(impl, /\.limit\(1000\)/)
  assert.doesNotMatch(impl, /\.from\('profiles'\)[\s\S]{0,240}\.order\('created_at'/)
})

test('P3.22 mantém totais globais e paginação real na interface administrativa', () => {
  const overview = read('src/components/admin/AdminUsersOverview.tsx')
  const impl = read('src/components/admin/AdminUsersImpl.tsx')

  assert.match(overview, /usersWithUnreadNotifications/)
  assert.match(overview, /Mostrando/)
  assert.match(overview, /Página \{page\} de \{totalPages\}/)
  assert.match(overview, /onPageChange/)
  assert.match(overview, /aria-label="Página anterior"/)
  assert.match(overview, /aria-label="Próxima página"/)

  assert.match(impl, /PAGE_SIZE = 40/)
  assert.match(impl, /loadAdminUsersPage/)
  assert.match(impl, /loadAdminUsersStats/)
  assert.match(impl, /loadAllAdminUsersForExport/)
  assert.match(impl, /filteredCount=\{filteredTotal\}/)
  assert.match(impl, /pageSize=\{PAGE_SIZE\}/)
})

test('P3.22 preserva filtros oficiais, aliases legados de Plus e drawer sob demanda', () => {
  const migration = read('supabase/migrations/20260901025500_admin_users_scalable.sql')
  const impl = read('src/components/admin/AdminUsersImpl.tsx')

  assert.match(migration, /p_plan = 'plus' AND p\.plan IN \('plus', 'therapeutic', 'therapeutic-plus'\)/)
  assert.match(migration, /p_access = 'tickets'/)
  assert.match(migration, /p_access = 'discount'/)
  assert.match(migration, /p_access = 'unlimited'/)
  assert.match(migration, /p_access = 'admin'/)

  assert.match(impl, /loadDrawerData\(u\.user_id\)/)
  assert.match(impl, /loadAdminSub\(u\.user_id\)/)
  assert.match(impl, /loadAiSummaries\(u\.user_id\)/)
})
