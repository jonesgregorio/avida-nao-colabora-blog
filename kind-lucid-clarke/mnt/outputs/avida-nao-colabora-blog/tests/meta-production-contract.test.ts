import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const metaConversions = readFileSync(new URL('../src/lib/metaConversions.ts', import.meta.url), 'utf8')
const auth = readFileSync(new URL('../src/components/Auth.tsx', import.meta.url), 'utf8')
const attribution = readFileSync(new URL('../src/lib/campaignAttribution.ts', import.meta.url), 'utf8')

test('Meta Pixel continua condicionado ao consentimento de marketing', () => {
  assert.match(metaConversions, /marketingConsent\(\) !== 'granted'/)
  assert.match(metaConversions, /VITE_META_PIXEL_ID/)
})

test('CompleteRegistration mantém deduplicação entre Pixel e CAPI', () => {
  assert.match(metaConversions, /registration:\$\{userId\}/)
  assert.match(metaConversions, /eventID: eventId/)
  assert.match(metaConversions, /supabase\.functions\.invoke\('meta-conversions'/)
})

test('conversão de cadastro ocorre somente após confirmação da conta', () => {
  assert.match(auth, /registration_complete/)
  assert.match(auth, /trackMetaCompleteRegistration\(confirmedUser\.id\)/)
})

test('teste A\/B reconhece as duas variantes oficiais da campanha', () => {
  assert.match(attribution, /ab_ig_landing/)
  assert.match(attribution, /ab_site_home/)
  assert.match(attribution, /ig_landing/)
  assert.match(attribution, /site_home/)
})
