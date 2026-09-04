import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_PLAN_ACCESS,
  OFFICIAL_FEATURES,
  OFFICIAL_PLAN_COMPARISON,
  OWN_FEATURE_KEYS,
  PLAN_KEYS,
  getPublicPlanBenefits,
} from '../src/lib/officialPlans.ts'

// PR2 — Comentário profissional deixa de ser um recurso comercial ativo na
// fonte oficial dos planos. (Aposentadoria operacional completa é PR3.)

test('professional_comment_on_monthly_report não é mais um recurso oficial ativo', () => {
  const key = 'professional_comment_on_monthly_report'
  assert.equal(OFFICIAL_FEATURES.some(f => f.key === key), false)
  for (const plan of PLAN_KEYS) {
    assert.equal(OWN_FEATURE_KEYS[plan].includes(key), false)
    assert.equal(DEFAULT_PLAN_ACCESS[plan].includes(key), false)
    assert.equal(getPublicPlanBenefits(plan).some(label => /comentário profissional/i.test(label)), false)
  }
  assert.equal(OFFICIAL_PLAN_COMPARISON.some(row => row.key === 'professional-comment'), false)
  assert.equal(JSON.stringify(OFFICIAL_PLAN_COMPARISON).includes(key), false)
})

test('Edge Function admin-plan-consistency não audita mais o recurso aposentado', () => {
  const fn = readFileSync(new URL('../supabase/functions/admin-plan-consistency/index.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(fn, /professional_comment_on_monthly_report/)
})
