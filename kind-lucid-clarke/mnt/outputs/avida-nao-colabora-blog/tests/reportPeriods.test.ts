import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getCurrentWeeklyPeriod,
  getCurrentMonthlyPeriod,
  getPreviousWeeklyPeriod,
  getPreviousMonthlyPeriod,
  getReportAvailabilityDate,
  resolveReportActivation,
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

test('períodos usam explicitamente America/Sao_Paulo perto da virada UTC', () => {
  // 02:30 UTC ainda é 23:30 do dia anterior em São Paulo.
  const now = new Date('2026-08-18T02:30:00Z')
  const current = getCurrentWeeklyPeriod(null, now)
  assert.equal(current.start, '2026-08-16')
  assert.equal(current.end, '2026-08-22')
})

test('ativação canônica e assinatura criada não são substituídas pela renovação atual', () => {
  assert.equal(
    resolveReportActivation({
      planActivatedAt: '2026-01-10T12:00:00Z',
      subscriptionCreatedAt: '2026-01-09T12:00:00Z',
      profileCreatedAt: '2025-12-01T12:00:00Z',
    }),
    '2026-01-10T12:00:00Z',
  )
  assert.equal(
    resolveReportActivation({
      subscriptionCreatedAt: '2026-02-15T12:00:00Z',
      profileCreatedAt: '2025-12-01T12:00:00Z',
    }),
    '2026-02-15T12:00:00Z',
  )
})

test('tela de relatórios não grava perfil nem usa início do período renovável', () => {
  const source = readFileSync(new URL('../src/components/MyReportPageContent.tsx', import.meta.url), 'utf8')
  assert.match(source, /select\('subscription_created_at'\)/)
  assert.equal(source.includes("select('current_period_start')"), false)
  assert.equal(source.includes('update({ plan_activated_at:'), false)
})
