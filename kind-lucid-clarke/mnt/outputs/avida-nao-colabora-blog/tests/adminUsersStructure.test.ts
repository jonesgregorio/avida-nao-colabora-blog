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

test('Admin pode redefinir o 2FA de um usuário travado na tela de MFA', () => {
  const implementation = fs.readFileSync(implementationUrl, 'utf8')
  const migration = fs.readFileSync(
    new URL('../supabase/migrations/20260907120000_admin_reset_user_mfa.sql', import.meta.url),
    'utf8',
  )

  // UI: chama a RPC, exige confirmação e registra auditoria.
  assert.match(implementation, /supabase\.rpc\('admin_reset_user_mfa'/)
  assert.match(implementation, /confirmMfaReset/)
  assert.match(implementation, /logAdminAction\('update', 'user_mfa_reset'/)

  // RPC: SECURITY DEFINER + is_admin() (que já exige role=admin E AAL2),
  // apaga os fatores TOTP e não fica exposta para anon.
  assert.match(migration, /security definer/i)
  assert.match(migration, /if not is_admin\(\) then/i)
  assert.match(migration, /delete from auth\.mfa_factors where user_id = target_user_id/i)
  assert.match(migration, /revoke execute on function public\.admin_reset_user_mfa\(uuid\) from anon/i)
  assert.match(migration, /grant execute on function public\.admin_reset_user_mfa\(uuid\) to authenticated/i)
})
