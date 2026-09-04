import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getEffectivePlan, hasPlanAccess, type PlanKey } from '../src/lib/officialPlans.ts'

// Regressão: Descobertas e Meu Jardim ficaram acessíveis para qualquer usuário
// autenticado, inclusive Gratuito. A regra comercial é Essencial+.

const descobertas = readFileSync(new URL('../src/components/DescobertasPage.tsx', import.meta.url), 'utf8')
const garden = readFileSync(new URL('../src/components/MyGardenPage.tsx', import.meta.url), 'utf8')
const maisPage = readFileSync(new URL('../src/components/MaisPage.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('DescobertasPage aplica hasPlanAccess(plan, "essential") como defesa própria', () => {
  assert.match(descobertas, /hasPlanAccess\(plan,\s*'essential'\)/)
  assert.match(descobertas, /if \(!hasAccess\)/)
  assert.match(descobertas, /disponível a partir do plano Essencial/i)
})

test('MyGardenPage aplica hasPlanAccess(plan, "essential") como defesa própria', () => {
  assert.match(garden, /hasPlanAccess\(getEffectivePlan\(profile\),\s*'essential'\)/)
  assert.match(garden, /if\(!hasAccess\)/)
  assert.match(garden, /Disponível a partir do plano Essencial/i)
})

test('MaisPage bloqueia o card Meu Jardim para quem não tem Essencial+', () => {
  assert.match(maisPage, /gardenAccess\s*=\s*hasPlanAccess\(plan,\s*'essential'\)/)
  assert.match(maisPage, /disponível a partir do Essencial/i)
})

test('App.tsx passa profile ao MyGardenPage para a rota /my-garden não vazar acesso', () => {
  assert.match(app, /<MyGardenPage userId=\{user\.id\} profile=\{accessProfile\}/)
})

function access(plan: PlanKey, unlimited = false): boolean {
  return hasPlanAccess(getEffectivePlan({ plan, unlimited_access: unlimited }), 'essential')
}

test('matriz de acesso a Descobertas/Meu Jardim: free bloqueado, essential e plus liberados', () => {
  assert.equal(access('free'), false)
  assert.equal(access('essential'), true)
  assert.equal(access('plus'), true)
})

test('unlimited_access equivale a Plus para autorização de Descobertas/Meu Jardim', () => {
  assert.equal(access('free', true), true)
})
