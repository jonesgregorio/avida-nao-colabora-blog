import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const imageSearch = readFileSync(new URL('../supabase/functions/image-search/index.ts', import.meta.url), 'utf8')
const youtubeSearch = readFileSync(new URL('../supabase/functions/youtube-search/index.ts', import.meta.url), 'utf8')
const stripeSelftest = readFileSync(new URL('../supabase/functions/stripe-selftest/index.ts', import.meta.url), 'utf8')

for (const [name, source] of [
  ['image-search', imageSearch],
  ['youtube-search', youtubeSearch],
  ['stripe-selftest', stripeSelftest],
] as const) {
  test(`${name} exige helper administrativo AAL2`, () => {
    assert.match(source, /requireAdminAal2/)
    assert.match(source, /const auth = await requireAdminAal2\(req\)/)
    assert.doesNotMatch(source, /select\('role'\)/)
  })
}

test('buscas externas só chamam provider depois do gate AAL2', () => {
  assert.ok(imageSearch.indexOf('requireAdminAal2(req)') < imageSearch.indexOf('api.pexels.com'))
  assert.ok(youtubeSearch.indexOf('requireAdminAal2(req)') < youtubeSearch.indexOf('googleapis.com/youtube'))
})

test('stripe-selftest preserva a trava de modo live antes de criar objetos Stripe', () => {
  const authPos = stripeSelftest.indexOf('requireAdminAal2(req)')
  const liveGuardPos = stripeSelftest.indexOf("secret.startsWith('sk_live_')")
  const customerCreatePos = stripeSelftest.indexOf('stripe.customers.create')
  assert.ok(authPos >= 0 && liveGuardPos > authPos)
  assert.ok(customerCreatePos > liveGuardPos, 'nenhum customer pode ser criado antes da trava de modo live')
})
