import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const home = readFileSync(new URL('../src/components/LoggedHomeLegacy.tsx', import.meta.url), 'utf8')

test('Home sem registro oferece somente acesso claro ao Diário no próximo passo', () => {
  assert.match(home, /action: null,[\s\S]*secondary: 'Quero escrever no diário'/)
  assert.match(home, /\{nextStep\.action && \([\s\S]*\{nextStep\.action\}/)
  assert.doesNotMatch(home, /action: 'Fazer check-in'/)
})
