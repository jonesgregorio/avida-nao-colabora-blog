import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('landing /ig tem proposta e CTA direto para cadastro', () => {
  const landing = read('src/components/InstagramLanding.tsx')
  assert.match(landing, /Como você está hoje\?/)
  assert.match(landing, /onNavigate\('auth-signup'\)/)
  assert.match(landing, /ig_landing_view/)
  assert.match(landing, /signup_cta_click/)
})

test('cadastro reduz atrito e mede as etapas principais', () => {
  const auth = read('src/components/Auth.tsx')
  assert.doesNotMatch(auth, /auth-name/)
  assert.doesNotMatch(auth, /auth-confirm-password/)
  for (const event of ['signup_view', 'signup_start', 'signup_submit', 'signup_success', 'signup_error', 'email_verification_required', 'email_verified']) {
    assert.match(auth, new RegExp(event))
  }
})

test('Vercel serve /ig como SPA e mantém variantes com aquisição identificada', () => {
  const config = JSON.parse(read('vercel.json')) as { redirects: Array<{ source: string; destination: string }> }
  assert.equal(config.redirects.some(({ source }) => source === '/ig'), false)
  assert.equal(config.redirects.find(({ source }) => source === '/ig-story')?.destination.startsWith('/ig?utm_source=instagram'), true)
})
