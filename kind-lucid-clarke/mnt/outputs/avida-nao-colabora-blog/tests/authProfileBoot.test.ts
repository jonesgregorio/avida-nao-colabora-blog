import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const auth = readFileSync(new URL('../src/hooks/useAuth.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('bootstrap autenticado resolve o perfil antes de liberar o shell', () => {
  assert.match(auth, /const accepted = await acceptConfirmedUser\(session\?\.user \?\? null\)/)
  assert.doesNotMatch(auth, /acceptConfirmedUser\(session\?\.user \?\? null, false\)/)
  assert.match(auth, /\.finally\(\(\) => \{[\s\S]*setLoading\(false\)/)
})

test('tela de completar perfil continua protegida pelo loading global', () => {
  const loadingGate = app.indexOf('if (loading)')
  const missingProfileGate = app.indexOf("if (user && !profile && view !== 'auth' && view !== 'admin')")
  assert.ok(loadingGate >= 0)
  assert.ok(missingProfileGate > loadingGate)
})
