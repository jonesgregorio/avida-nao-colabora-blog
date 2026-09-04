import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Reset de senha e troca de e-mail são as ações mais sensíveis do painel
// (equivalem a assumir a conta de um usuário) e ficaram sem trilha de
// auditoria em admin_logs. Corrige a lacuna encontrada na auditoria do
// blog: as duas passam a chamar logAdminAction, como já acontece com
// mudança de plano/cancelamento/promoção de admin no mesmo arquivo.

const src = readFileSync(
  new URL('../src/components/admin/AdminUsersImpl.tsx', import.meta.url),
  'utf8',
)

function bodyOf(fnName: string): string {
  const start = src.indexOf(`async function ${fnName}(`)
  assert.ok(start >= 0, `função ${fnName} não encontrada`)
  const nextFn = src.indexOf('\n  async function ', start + 1)
  return src.slice(start, nextFn > 0 ? nextFn : undefined)
}

test('handleResetPassword registra a ação em admin_logs sem gravar a senha em texto', () => {
  const body = bodyOf('handleResetPassword')
  assert.match(body, /logAdminAction\('update', 'user_password_reset', selectedUser\.user_id,/)
  assert.doesNotMatch(body, /logAdminAction[\s\S]*newPassword/)
})

test('handleChangeEmail registra a ação em admin_logs com o e-mail novo', () => {
  const body = bodyOf('handleChangeEmail')
  assert.match(body, /logAdminAction\('update', 'user_email_change', selectedUser\.user_id,/)
  assert.match(body, /to: newEmail\.trim\(\)/)
})
