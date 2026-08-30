import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/MyHistoryPage.tsx', import.meta.url), 'utf8')

test('Minha História reaproveita memórias reconhecidas sem criar pontuação', () => {
  assert.match(page, /fetchDiscoveryMemories/)
  assert.match(page, /Coisas que já fizeram sentido na sua história/)
  assert.match(page, /apenas descobertas que você escolheu reconhecer/)
  assert.match(page, /não viram pontuação, meta ou obrigação de continuidade/i)
  assert.doesNotMatch(page, /\bXP\b|ranking|streak|pontos conquistados|faltam\s+\d+|\d+%/i)
})

test('memória contextual preserva a fronteira de privacidade do Diário', () => {
  assert.match(page, /Nenhum trecho do texto livre do Diário é exibido/)
  assert.match(page, /O que sustentou essa percepção/)
  assert.match(page, /Fez sentido para você em/)
  assert.doesNotMatch(page, /content,content_html|entry_text|diary_text/i)
})
