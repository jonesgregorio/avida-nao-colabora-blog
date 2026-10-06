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
  assert.match(metaConversions, /eventID: payload\.event_id/)
  assert.match(metaConversions, /supabase\.functions\.invoke\('meta-conversions'/)
  assert.match(metaConversions, /BROWSER_REGISTRATION_KEY/)
  assert.match(metaConversions, /SERVER_REGISTRATION_KEY/)
})

test('Pixel registra a conta criada e CAPI repete o evento após confirmação', () => {
  assert.match(auth, /trackMetaRegistrationCreated\(signUpData\.user\.id\)/)
  assert.match(auth, /registration_complete/)
  assert.match(auth, /trackMetaCompleteRegistration\(confirmedUser\.id\)/)
  assert.match(auth, /signUpData\.user\.identities\.length > 0/)
})

test('falhas de entrega CAPI ficam observáveis e podem ser tentadas novamente', () => {
  assert.match(metaConversions, /meta_conversion_delivery/)
  assert.match(metaConversions, /status: 'failed'/)
  assert.match(metaConversions, /status: 'accepted'/)
  assert.match(metaConversions, /if \(registrationWasSent\(SERVER_REGISTRATION_KEY, userId\)\) return/)
})

test('teste A/B reconhece as duas variantes oficiais da campanha', () => {
  assert.match(attribution, /ab_ig_landing/)
  assert.match(attribution, /ab_site_home/)
  assert.match(attribution, /ig_landing/)
  assert.match(attribution, /site_home/)
})

test('atribuição preserva primeiro contato e atualiza último contato separadamente', () => {
  assert.match(attribution, /FIRST_TOUCH_KEY/)
  assert.match(attribution, /LAST_TOUCH_KEY/)
  assert.match(attribution, /if \(!readStoredAttribution\(FIRST_TOUCH_KEY\)\) localStorage\.setItem\(FIRST_TOUCH_KEY/)
  assert.match(attribution, /localStorage\.setItem\(LAST_TOUCH_KEY/)
  assert.match(attribution, /readStoredAttribution\(LAST_TOUCH_KEY\) \?\? readStoredAttribution\(FIRST_TOUCH_KEY\)/)
})
