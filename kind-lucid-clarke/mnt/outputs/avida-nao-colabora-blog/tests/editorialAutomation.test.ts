import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EDITORIAL_AUTOMATION_SPECS,
  clampAutomationQuantity,
  isEditorialAutomationType,
  plannedDateForIdea,
} from '../supabase/functions/_shared/editorialAutomationContracts.ts'

test('cada automação editorial possui saída funcional distinta', () => {
  assert.equal(EDITORIAL_AUTOMATION_SPECS.generate_daily.output, 'article')
  assert.equal(EDITORIAL_AUTOMATION_SPECS.generate_weekly_package.output, 'article_package')
  assert.equal(EDITORIAL_AUTOMATION_SPECS.generate_pauta.output, 'editorial_ideas')
  assert.equal(EDITORIAL_AUTOMATION_SPECS.monthly_pauta.output, 'monthly_editorial_plan')
  assert.equal(new Set(Object.values(EDITORIAL_AUTOMATION_SPECS).map(s => s.output)).size, 4)
})

test('quantidade respeita limites por tipo', () => {
  assert.equal(clampAutomationQuantity('generate_daily', 99), 1)
  assert.equal(clampAutomationQuantity('generate_weekly_package', 99), 4)
  assert.equal(clampAutomationQuantity('generate_weekly_package', 1), 2)
  assert.equal(clampAutomationQuantity('generate_pauta', undefined), 6)
  assert.equal(clampAutomationQuantity('monthly_pauta', 100), 20)
})

test('tipos editoriais suportados são reconhecidos sem aceitar legados', () => {
  for (const type of ['generate_daily', 'generate_weekly_package', 'generate_pauta', 'monthly_pauta']) {
    assert.equal(isEditorialAutomationType(type), true)
  }
  assert.equal(isEditorialAutomationType('notify_after_publish'), false)
  assert.equal(isEditorialAutomationType('social_caption'), false)
})

test('pauta quinzenal distribui datas nas próximas duas semanas', () => {
  const now = new Date('2026-08-17T12:00:00Z')
  const dates = Array.from({ length: 6 }, (_, i) => plannedDateForIdea('generate_pauta', i, 6, now))
  assert.equal(dates[0], '2026-08-18')
  assert.ok(dates.at(-1)! <= '2026-08-31')
  assert.equal(new Set(dates).size, dates.length)
})

test('pauta mensal é planejada no próximo mês', () => {
  const now = new Date('2026-08-17T12:00:00Z')
  const dates = Array.from({ length: 12 }, (_, i) => plannedDateForIdea('monthly_pauta', i, 12, now))
  assert.ok(dates.every(date => date.startsWith('2026-09-')))
  assert.equal(dates[0], '2026-09-01')
})
