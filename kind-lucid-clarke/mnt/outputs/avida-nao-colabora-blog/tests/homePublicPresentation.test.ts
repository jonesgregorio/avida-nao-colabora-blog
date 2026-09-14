import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const home = readFileSync(new URL('../src/components/HomeContent.tsx', import.meta.url), 'utf8')

test('home deixa claro que os cards de planos são apenas um resumo', () => {
  assert.match(home, /Ver mais funcionalidades/)
  assert.match(home, /Comparar todos os planos/)
  assert.match(home, /bg-forest-900 px-5 py-2\.5 text-sm font-semibold text-white/)
})

test('home usa a linguagem visual atual do Meu Jardim em vez do mockup antigo de emojis', () => {
  assert.match(home, /\/gardens\/japones\/45\.webp/)
  assert.match(home, /cenários fotorrealistas/i)
  assert.doesNotMatch(home, /absolute bottom-4 right-5 flex items-end gap-1 text-5xl/)
})
