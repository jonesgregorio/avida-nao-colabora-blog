import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_IDEA1_ROLLOUT_SETTINGS,
  extractIdea1RolloutSettings,
  isIdea1RolloutEnabledForUser,
  normalizeIdea1RolloutSettings,
  stableIdea1RolloutBucket,
} from '../src/lib/idea1RolloutRules.ts'

const rolloutData = readFileSync(new URL('../src/lib/idea1Rollout.ts', import.meta.url), 'utf8')
const weeklyFocus = readFileSync(new URL('../src/components/WeeklyFocusCard.tsx', import.meta.url), 'utf8')
const admin = readFileSync(new URL('../src/components/admin/AdminIdea1Rollout.tsx', import.meta.url), 'utf8')
const systemArea = readFileSync(new URL('../src/components/admin/AdminAreaSistema.tsx', import.meta.url), 'utf8')

test('rollout nasce em 100% e normaliza valores sem criar estados inválidos', () => {
  assert.deepEqual(DEFAULT_IDEA1_ROLLOUT_SETTINGS, { enabled: true, percentage: 100 })
  assert.deepEqual(normalizeIdea1RolloutSettings({ enabled: true, percentage: 140 }), { enabled: true, percentage: 100 })
  assert.deepEqual(normalizeIdea1RolloutSettings({ enabled: false, percentage: -9 }), { enabled: false, percentage: 0 })
  assert.deepEqual(normalizeIdea1RolloutSettings(null), { enabled: true, percentage: 100 })
})

test('coorte é determinística, estável e sempre fica entre 0 e 99', () => {
  const ids = ['user-a', 'user-b', '0b7f9c64-861c-4d11-8be4-eab2fb111111']
  for (const id of ids) {
    const first = stableIdea1RolloutBucket(id)
    assert.equal(first, stableIdea1RolloutBucket(id))
    assert.ok(first >= 0 && first <= 99)
  }
})

test('0%, 100% e pausa operacional têm semântica explícita', () => {
  const userId = 'stable-user'
  assert.equal(isIdea1RolloutEnabledForUser(userId, { enabled: true, percentage: 100 }), true)
  assert.equal(isIdea1RolloutEnabledForUser(userId, { enabled: true, percentage: 0 }), false)
  assert.equal(isIdea1RolloutEnabledForUser(userId, { enabled: false, percentage: 100 }), false)
})

test('configuração ausente mantém comportamento publicado e campo isolado é extraído com segurança', () => {
  assert.deepEqual(extractIdea1RolloutSettings({ track_pageviews: true }), { enabled: true, percentage: 100 })
  assert.deepEqual(
    extractIdea1RolloutSettings({ track_pageviews: true, idea1_rollout: { enabled: true, percentage: 25 } }),
    { enabled: true, percentage: 25 },
  )
})

test('persistência reutiliza analytics_settings sem migration e preserva o restante do JSON', () => {
  assert.match(rolloutData, /from\('analytics_settings'\)/)
  assert.match(rolloutData, /\.eq\('id', 1\)/)
  assert.match(rolloutData, /\.\.\.currentConfig,\s*idea1_rollout: settings/s)
  assert.match(rolloutData, /Fail-open/)
  assert.doesNotMatch(rolloutData, /stripe|checkout|subscription|payment/i)
})

test('rollout controla somente novos convites e nunca esconde foco já salvo', () => {
  assert.match(weeklyFocus, /fetchIdea1RolloutDecision\(userId\)/)
  assert.match(weeklyFocus, /Promise\.all\(\[\s*loadWeeklyFocusState\(userId, period\.start\),\s*fetchIdea1RolloutDecision\(userId\)/s)
  assert.match(weeklyFocus, /if \(!rolloutEligible && !current && !previousOpen\) return null/)
  assert.match(weeklyFocus, /if \(previousOpen\)/)
  assert.match(weeklyFocus, /if \(current && !choosing\)/)
  assert.match(weeklyFocus, /hasPlanAccess\(plan, 'essential'\)/)
})

test('admin deixa explícito o escopo e não apresenta o rollout como mudança de plano', () => {
  assert.match(admin, /Novos convites de Foco da Semana/)
  assert.match(admin, /Quem já tem um foco salvo ou uma reflexão pendente continua vendo e usando normalmente/)
  assert.match(admin, /não altera planos, assinaturas, Stripe, Diário, Mapa Emocional, relatórios, conteúdos ou acessos contratados/)
  assert.match(admin, /type="range"/)
  assert.match(admin, /role="switch"/)
  assert.match(admin, /Coorte estável/)
  assert.match(systemArea, /id: 'liberacao', label: 'Liberação'/)
  assert.match(systemArea, /<AdminIdea1Rollout \/>/)
})
