import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/hooks/useAuth.ts', import.meta.url), 'utf8')

test('bootstrap de autenticação nunca mantém o app em loading infinito', () => {
  assert.match(source, /const AUTH_BOOT_TIMEOUT_MS = 8_000/)
  assert.match(source, /window\.setTimeout\(\(\) => \{[\s\S]*setLoading\(false\)[\s\S]*AUTH_BOOT_TIMEOUT_MS/)
  assert.match(source, /window\.clearTimeout\(bootTimeout\)/)
  assert.match(source, /active = false/)
})

test('perfil é resolvido antes de liberar o shell após a sessão ser conhecida', () => {
  assert.match(source, /acceptConfirmedUser\(session\?\.user \?\? null\)/)
  assert.doesNotMatch(source, /acceptConfirmedUser\(session\?\.user \?\? null, false\)/)
  assert.match(source, /const profilePromise = fetchProfile/)
  assert.match(source, /if \(waitForProfile\)[\s\S]*await profilePromise/)
})

test('fluxos posteriores de autenticação continuam carregando o perfil normalmente', () => {
  assert.match(source, /return acceptConfirmedUser\(candidate\)/)
  assert.match(source, /onAuthStateChange/)
  assert.match(source, /void handleAuthCandidate\(event, session\?\.user \?\? null\)/)
})
