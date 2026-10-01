import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fn = readFileSync(new URL('../supabase/functions/send-transactional-email/index.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('envio de e-mail ignora contas técnicas do smoke antes de criar log ou chamar o provedor', () => {
  const guard = fn.indexOf("/^prod-smoke-.+@example\\.com$/i.test(payload.to_email.trim())")
  const insertLog = fn.indexOf("const insertRow: Record<string, unknown>")
  const provider = fn.indexOf('api.resend.com')
  assert.ok(guard > 0, 'guarda das contas técnicas ausente')
  assert.ok(insertLog > guard, 'a guarda precisa vir antes de gravar o log')
  assert.ok(provider === -1 || provider > guard, 'a guarda precisa vir antes do provedor')
  assert.match(fn, /return json\(\{ skipped: true, reason: 'technical_account' \}\)/)
})

test('a guarda é restrita ao padrão técnico e vem depois da autenticação', () => {
  const guard = fn.indexOf("reason: 'technical_account'")
  const auth = fn.indexOf("'Sem permissão para este envio'")
  assert.ok(auth > 0 && auth < guard, 'a autenticação precisa rodar antes')
  // domínios reais nunca são ignorados por esta regra
  const re = /^prod-smoke-.+@example\.com$/i
  assert.equal(re.test('prod-smoke-user-1790792483185-97e7dc53@example.com'), true)
  assert.equal(re.test('prod-smoke-admin-1@example.com'), true)
  assert.equal(re.test('maria@example.com'), false)
  assert.equal(re.test('prod-smoke-x@gmail.com'), false)
  assert.equal(re.test('contato@avidanaocolabora.com'), false)
})
