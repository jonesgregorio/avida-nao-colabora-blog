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

// O painel administrativo de "Liberação progressiva" (AdminIdea1Rollout) foi removido do
// Admin: a rolagem já estava 100% concluída, e mantê-lo era um controle sem uso real. O
// flag em si (lib/idea1Rollout*.ts) e sua leitura no WeeklyFocusCard continuam ativos e
// testados acima — só a tela de ajuste manual no Admin deixou de existir.
