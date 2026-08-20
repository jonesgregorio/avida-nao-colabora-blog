import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePricingPlanAction } from '../src/lib/pricingPlanAction.ts'

test('visitante precisa autenticar antes de escolher qualquer plano', () => {
  assert.equal(resolvePricingPlanAction(false, 'free', 'essential'), 'auth')
  assert.equal(resolvePricingPlanAction(false, 'free', 'plus'), 'auth')
})

test('usuário gratuito usa checkout apenas para primeira assinatura paga', () => {
  assert.equal(resolvePricingPlanAction(true, 'free', 'free'), 'current')
  assert.equal(resolvePricingPlanAction(true, 'free', 'essential'), 'checkout')
  assert.equal(resolvePricingPlanAction(true, 'free', 'plus'), 'checkout')
})

test('assinante pago nunca abre novo checkout para trocar de plano', () => {
  assert.equal(resolvePricingPlanAction(true, 'essential', 'essential'), 'current')
  assert.equal(resolvePricingPlanAction(true, 'essential', 'plus'), 'manage')
  assert.equal(resolvePricingPlanAction(true, 'essential', 'free'), 'manage')
  assert.equal(resolvePricingPlanAction(true, 'plus', 'plus'), 'current')
  assert.equal(resolvePricingPlanAction(true, 'plus', 'essential'), 'manage')
  assert.equal(resolvePricingPlanAction(true, 'plus', 'free'), 'manage')
})
