import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GUIDANCE_RESPONSE_SLA_DAYS, guidanceResponseDueDate, guidanceDaysUntilDue } from '../src/lib/monthlyGuidanceResponse.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('prazo de resposta da orientação mensal é de 7 dias corridos a partir do envio', () => {
  assert.equal(GUIDANCE_RESPONSE_SLA_DAYS, 7)
  const sentAt = '2026-08-01T10:00:00.000Z'
  const due = guidanceResponseDueDate(sentAt)
  assert.equal(due.toISOString(), '2026-08-08T10:00:00.000Z')
})

test('dias restantes é calculado a partir do mesmo prazo', () => {
  const future = new Date(Date.now() + 2 * 86400_000).toISOString()
  assert.equal(guidanceDaysUntilDue(future), 9)
})

test('Admin e usuário calculam o prazo a partir da mesma fonte compartilhada', () => {
  const admin = read('src/components/admin/AdminGuidanceRequests.tsx')
  assert.match(admin, /from '..\/..\/lib\/monthlyGuidanceResponse'/)
  assert.doesNotMatch(admin, /const RESPONSE_SLA_DAYS = 7/, 'Admin não deve mais duplicar o número de dias do SLA')

  const userPage = read('src/components/MonthlyGuidancePage.tsx')
  assert.match(userPage, /guidanceResponseDueDate/)
})

test('tela do usuário mostra a data prevista de resposta enquanto o pedido está em análise', () => {
  const userPage = read('src/components/MonthlyGuidancePage.tsx')
  assert.match(userPage, /resposta prevista até/)
})
