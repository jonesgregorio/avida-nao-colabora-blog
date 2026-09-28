import test from 'node:test'
import assert from 'node:assert/strict'
import { experimentVariantFromContent, parseCampaignAttribution } from '../src/lib/campaignAttribution.ts'

test('URL oficial da variante landing /ig é atribuída ao grupo ig_landing', () => {
  const attribution = parseCampaignAttribution('?utm_source=facebook&utm_medium=paid_social&utm_campaign=avnc_ab_signup&utm_content=ab_ig_landing&fbclid=test', '/ig')
  assert.equal(attribution?.experiment_variant, 'ig_landing')
  assert.equal(attribution?.landing_path, '/ig')
  assert.equal(attribution?.click_id_type, 'fbclid')
})

test('URL oficial da variante Home é atribuída ao grupo site_home', () => {
  const attribution = parseCampaignAttribution('?utm_source=facebook&utm_medium=paid_social&utm_campaign=avnc_ab_signup&utm_content=ab_site_home&fbclid=test', '/')
  assert.equal(attribution?.experiment_variant, 'site_home')
  assert.equal(attribution?.landing_path, '/')
  assert.equal(attribution?.click_id_type, 'fbclid')
})

test('nomes oficiais do A/B não se confundem entre si', () => {
  assert.equal(experimentVariantFromContent('ab_ig_landing'), 'ig_landing')
  assert.equal(experimentVariantFromContent('ab_site_home'), 'site_home')
})
