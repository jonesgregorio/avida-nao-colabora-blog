import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260820004000_canonical_emotional_availability.sql', import.meta.url),
  'utf8',
)
const periods = readFileSync(new URL('../src/lib/reportPeriods.ts', import.meta.url), 'utf8')

test('banco força disponibilidade para period_end + 1', () => {
  assert.match(migration, /NEW\.available_at := NEW\.period_end \+ 1/)
  assert.match(migration, /reports_canonical_available_at/)
  assert.match(migration, /care_plans_canonical_available_at/)
  assert.match(migration, /UPDATE public\.reports[\s\S]*?available_at = period_end \+ 1/)
  assert.match(migration, /UPDATE public\.monthly_care_plans[\s\S]*?available_at = period_end \+ 1/)
})

test('regra central de períodos também usa fim + 1 dia', () => {
  assert.match(periods, /getReportAvailabilityDate\(periodEnd: string\)/)
  assert.match(periods, /return addDays\(periodEnd, 1\)/)
  assert.match(periods, /Semanal: domingo → sábado; disponível no domingo seguinte/)
  assert.match(periods, /Mensal:\s+dia 1 → último dia; disponível no dia 1 do mês seguinte/)
})

test('backfill não altera status nem conteúdo', () => {
  assert.doesNotMatch(migration, /SET\s+status\s*=/i)
  assert.doesNotMatch(migration, /SET\s+content\s*=/i)
})
