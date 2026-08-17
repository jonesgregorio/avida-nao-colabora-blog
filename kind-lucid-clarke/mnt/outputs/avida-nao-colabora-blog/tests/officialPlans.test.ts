import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePlan,
  hasActiveUnlimitedAccess,
  getEffectivePlan,
  hasPlanAccess,
  isContentLocked,
} from '../src/lib/officialPlans.ts'

test('normaliza planos legados para Plus', () => {
  assert.equal(normalizePlan('therapeutic'), 'plus')
  assert.equal(normalizePlan('therapeutic-plus'), 'plus')
  assert.equal(normalizePlan('therapeutic_plus'), 'plus')
  assert.equal(normalizePlan('essential'), 'essential')
  assert.equal(normalizePlan(undefined), 'free')
})

test('acesso ilimitado ativo equivale a Plus sem mudar o plano comercial', () => {
  const now = new Date('2026-08-17T12:00:00-03:00')
  const profile = { plan: 'free', unlimited_access: true, unlimited_access_until: '2026-08-20T00:00:00-03:00' }
  assert.equal(hasActiveUnlimitedAccess(profile, now), true)
  assert.equal(getEffectivePlan(profile, now), 'plus')
  assert.equal(profile.plan, 'free')
})

test('acesso ilimitado expirado deixa de liberar Plus', () => {
  const now = new Date('2026-08-17T12:00:00-03:00')
  const profile = { plan: 'free', unlimited_access: true, unlimited_access_until: '2026-08-16T23:59:59-03:00' }
  assert.equal(hasActiveUnlimitedAccess(profile, now), false)
  assert.equal(getEffectivePlan(profile, now), 'free')
})

test('matriz de acesso Gratuito, Essencial e Plus', () => {
  assert.equal(hasPlanAccess('free', 'essential'), false)
  assert.equal(hasPlanAccess('free', 'plus'), false)
  assert.equal(hasPlanAccess('essential', 'essential'), true)
  assert.equal(hasPlanAccess('essential', 'plus'), false)
  assert.equal(hasPlanAccess('plus', 'essential'), true)
  assert.equal(hasPlanAccess('plus', 'plus'), true)
})

test('paywall diferencia público, conta, Essencial e Plus', () => {
  assert.equal(isContentLocked('free', 'free', false), false)
  assert.equal(isContentLocked('account', 'free', false), true)
  assert.equal(isContentLocked('account', 'free', true), false)
  assert.equal(isContentLocked('essential', 'free', true), true)
  assert.equal(isContentLocked('essential', 'essential', true), false)
  assert.equal(isContentLocked('plus', 'essential', true), true)
  assert.equal(isContentLocked('plus', 'plus', true), false)
})
