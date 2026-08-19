import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const facadeUrl = new URL('../src/components/admin/AdminUsers.tsx', import.meta.url)
const implementationUrl = new URL('../src/components/admin/AdminUsersImpl.tsx', import.meta.url)

test('AdminUsers mantém uma fachada pequena e estável', () => {
  const facade = fs.readFileSync(facadeUrl, 'utf8')
  const lines = facade.split(/\r?\n/).length

  assert.ok(lines <= 12, `AdminUsers.tsx voltou a crescer (${lines} linhas)`)
  assert.match(facade, /export \{ default \} from '\.\/AdminUsersImpl'/)
})

test('implementação preserva os fluxos administrativos sensíveis existentes', () => {
  const implementation = fs.readFileSync(implementationUrl, 'utf8')

  assert.match(implementation, /AdminSubscriptionPanel/)
  assert.match(implementation, /functions\.invoke\('admin-discount'/)
  assert.match(implementation, /admin_set_user_password/)
  assert.match(implementation, /admin_change_user_email/)
})
