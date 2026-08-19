import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = join(here, '..')
const implPath = join(appRoot, 'src/components/admin/AdminUsersImpl.tsx')
const overviewPath = join(appRoot, 'src/components/admin/AdminUsersOverview.tsx')

const impl = readFileSync(implPath, 'utf8')
const overview = readFileSync(overviewPath, 'utf8')

test('AdminUsers delega a camada visual para componentes próprios', () => {
  assert.match(impl, /import AdminUsersOverview from '\.\/AdminUsersOverview'/)
  assert.match(impl, /<AdminUsersOverview/)
  assert.match(overview, /export function AdminUsersHeader/)
  assert.match(overview, /export function AdminUsersList/)
  assert.match(overview, /export function AdminUsersKanban/)
})

test('componentes visuais de AdminUsers não ganham efeitos colaterais de dados ou cobrança', () => {
  assert.doesNotMatch(overview, /from ['"]\.\.\/\.\.\/lib\/supabase['"]/)
  assert.doesNotMatch(overview, /supabase\./)
  assert.doesNotMatch(overview, /stripe/i)
  assert.doesNotMatch(overview, /functions\.invoke/)
})

test('fluxos administrativos sensíveis continuam no orquestrador', () => {
  for (const marker of [
    'async function adminChangePlan',
    'async function adminCancelSub',
    'async function adminReactivateSub',
    'async function saveDiscount',
    'async function clearDiscount',
    'async function handleResetPassword',
    'async function handleChangeEmail',
  ]) {
    assert.match(impl, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('filtro e exportação permanecem orquestrados pelo AdminUsersImpl', () => {
  assert.match(impl, /filterAdminUsers\(users,/)
  assert.match(impl, /buildAdminUsersCsv\(filtered\)/)
  assert.match(impl, /resolveTabFilter\(tab\)/)
})
