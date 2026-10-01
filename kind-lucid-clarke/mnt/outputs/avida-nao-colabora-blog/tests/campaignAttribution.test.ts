import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { experimentVariantFromContent, parseCampaignAttribution } from '../src/lib/campaignAttribution.ts'

test('maps the two controlled experiment variants', () => {
  assert.equal(experimentVariantFromContent('ab_ig_landing'), 'ig_landing')
  assert.equal(experimentVariantFromContent('ab_site_home'), 'site_home')
  assert.equal(experimentVariantFromContent('unrelated'), null)
})

test('captures all UTMs without persisting the raw Meta click id', () => {
  const attribution = parseCampaignAttribution(
    '?utm_source=instagram&utm_medium=paid_social&utm_campaign=ig_checkin_ab&utm_content=ab_ig_landing&utm_term=reel&fbclid=secret-click-id',
    '/ig',
  )

  assert.deepEqual(attribution, {
    utm_source: 'instagram',
    utm_medium: 'paid_social',
    utm_campaign: 'ig_checkin_ab',
    utm_content: 'ab_ig_landing',
    utm_term: 'reel',
    landing_path: '/ig',
    click_id_type: 'fbclid',
    experiment_variant: 'ig_landing',
  })
  assert.doesNotMatch(JSON.stringify(attribution), /secret-click-id/)
})

test('the final Meta conversion fires only in the confirmed-account flow', () => {
  const auth = readFileSync(new URL('../src/components/Auth.tsx', import.meta.url), 'utf8')
  const confirmationStart = auth.indexOf('const finishConfirmation')
  const signupStart = auth.indexOf("mode === 'signup'")
  const metaConversion = auth.indexOf('trackMetaCompleteRegistration(confirmedUser.id)')

  assert.ok(confirmationStart >= 0)
  assert.ok(metaConversion > confirmationStart)
  assert.ok(metaConversion < signupStart || signupStart < confirmationStart)
  // Duas conversões finais, ambas só com e-mail verificado: a confirmação por e-mail e o cadastro novo
  // com o Google (e-mail já verificado pelo Google; ver docs/LOGIN_GOOGLE.md). Nunca no submit do formulário.
  const calls = auth.match(/trackMetaCompleteRegistration\(/g) ?? []
  assert.equal(calls.length, 2) // confirmação por e-mail + cadastro novo com o Google
  const google = auth.indexOf('trackMetaCompleteRegistration(user.id)')
  assert.ok(google > auth.indexOf('if (isNewOAuthUser(user))'))
  assert.ok(google > auth.indexOf("query.get('oauth') !== 'google'"))
})

test('the campaign funnel exposes the five requested stages and AB threshold', () => {
  const funnel = readFileSync(new URL('../src/components/admin/AdminConversionFunnel.tsx', import.meta.url), 'utf8')
  for (const label of ['Visita', 'Início do check-in', 'Check-in concluído', 'Clique no cadastro', 'Conta criada e confirmada']) {
    assert.match(funnel, new RegExp(label))
  }
  assert.match(funnel, /visits >= 100/)
  assert.match(funnel, /200 por versão/)
})
