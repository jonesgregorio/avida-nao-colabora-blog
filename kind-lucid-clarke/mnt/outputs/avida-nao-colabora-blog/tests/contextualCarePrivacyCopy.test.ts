import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/RecommendedContent.tsx', import.meta.url), 'utf8')

test('explica que texto livre não entra na pontuação e segurança é separada', () => {
  assert.match(source, /O texto completo do Diário não entra na pontuação/)
  assert.match(source, /sinais de segurança são verificados separadamente/)
})
