import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCurrentWeeklyPeriod,
  getCurrentMonthlyPeriod,
  getPreviousWeeklyPeriod,
  getPreviousMonthlyPeriod,
  getReportAvailabilityDate,
  shouldGenerateReport,
} from '../src/lib/reportPeriods.ts'

test('primeira semana começa na ativação quando assinatura ocorre no meio do ciclo', () => {
  const now = new Date(2026, 7, 19, 12, 0, 0)
  const p = getCurrentWeeklyPeriod('2026-08-19T09:00:00-03:00', now)
  assert.equal(p.start, '2026-08-19')
  assert.equal(p.end, '2026-08-22')
  assert.equal(p.clampedToActivation, true)
})

test('primeiro mês começa na ativação quando Plus inicia no meio do mês', () => {
  const now = new Date(2026, 7, 19, 12, 0, 0)
  const p = getCurrentMonthlyPeriod('2026-08-17T09:00:00-03:00', now)
  assert.equal(p.start, '2026-08-17')
  assert.equal(p.end, '2026-08-31')
  assert.equal(p.clampedToActivation, true)
})

test('não retorna período anterior fechado se a ativação aconteceu depois dele', () => {
  const now = new Date(2026, 7, 23, 12, 0, 0)
  const p = getPreviousWeeklyPeriod('2026-08-23T09:00:00-03:00', now)
  assert.equal(p, null)
})

test('período mensal anterior é cortado pela ativação', () => {
  const now = new Date(2026, 8, 1, 12, 0, 0)
  const p = getPreviousMonthlyPeriod('2026-08-17T09:00:00-03:00', now)
  assert.ok(p)
  assert.equal(p?.start, '2026-08-17')
  assert.equal(p?.end, '2026-08-31')
})

test('disponibilidade começa no dia seguinte ao fim do período', () => {
  assert.equal(getReportAvailabilityDate('2026-08-22'), '2026-08-23')
  assert.equal(shouldGenerateReport('2026-08-22', new Date(2026, 7, 22, 12)), false)
  assert.equal(shouldGenerateReport('2026-08-22', new Date(2026, 7, 23, 12)), true)
})
