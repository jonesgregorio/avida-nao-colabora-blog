import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SUPPORT_SLA_HOURS, getSupportSlaHours, getSupportSlaLabel } from '../src/lib/supportSla.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('SLA de suporte oficial: Gratuito 72h, Essencial 48h, Plus 24h', () => {
  assert.deepEqual(SUPPORT_SLA_HOURS, { free: 72, essential: 48, plus: 24 })
  assert.equal(getSupportSlaHours('free'), 72)
  assert.equal(getSupportSlaHours('essential'), 48)
  assert.equal(getSupportSlaHours('plus'), 24)
  assert.equal(getSupportSlaHours('therapeutic'), 24)
  assert.equal(getSupportSlaHours('therapeutic-plus'), 24)
  assert.equal(getSupportSlaHours(null), 72)
  assert.equal(getSupportSlaLabel('essential'), 'até 48h úteis')
})

test('SupportPage (usuário) consome a mesma fonte de SLA usada pelo Admin, sem número fixo duplicado', () => {
  const supportPage = read('src/components/SupportPage.tsx')
  assert.match(supportPage, /from '..\/lib\/supportSla'/)
  assert.doesNotMatch(supportPage, /24h úteis/, 'não deve haver SLA fixo de 24h para todos os planos')

  const adminSupport = read('src/components/admin/AdminSupport.tsx')
  assert.match(adminSupport, /from '..\/..\/lib\/supportSla'/)
  assert.doesNotMatch(adminSupport, /free: 72, essential: 48, plus: 24/, 'Admin não deve duplicar a tabela de SLA')
})
