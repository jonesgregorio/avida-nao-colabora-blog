import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const service = readFileSync(
  new URL('../src/services/personalizedDeliveryService.ts', import.meta.url),
  'utf8',
)
const professionalBlock = service.match(/async function reflectInProfessionalComments\([\s\S]*$/)?.[0] ?? ''
const insertPayload = professionalBlock.match(/\.from\('professional_comments'\)\.insert\(\{([\s\S]*?)\}\)/)?.[1] ?? ''

test('comentário profissional usa somente campos do schema oficial', () => {
  assert.ok(professionalBlock)
  assert.ok(insertPayload, 'payload do insert profissional deve existir')
  assert.match(professionalBlock, /\.eq\('report_month', reportMonth\)/)
  assert.match(insertPayload, /report_month: reportMonth/)
  assert.match(insertPayload, /comment_text: body/)
  assert.match(insertPayload, /visibility: 'user'/)
  assert.match(insertPayload, /is_read: false/)
  assert.doesNotMatch(professionalBlock, /\.eq\('month_key'/)
  assert.doesNotMatch(insertPayload, /\bmonth_key:/)
  assert.doesNotMatch(insertPayload, /\bplan_key:/)
  assert.doesNotMatch(insertPayload, /\bstatus:/)
  assert.doesNotMatch(insertPayload, /\bupdated_at:/)
})

test('falhas de leitura ou gravação não são tratadas como sucesso', () => {
  assert.match(professionalBlock, /if \(selectError\) return \{ ok: false/)
  assert.match(professionalBlock, /insertError/)
  assert.match(professionalBlock, /Falha ao gravar comentário profissional/)
})

test('orientação mensal também devolve erro explícito quando não consegue refletir', () => {
  assert.match(service, /Falha ao atualizar orientação mensal/)
  assert.match(service, /Nenhuma orientação mensal aberta foi encontrada/)
  assert.match(service, /Falha ao refletir orientação mensal/)
})
