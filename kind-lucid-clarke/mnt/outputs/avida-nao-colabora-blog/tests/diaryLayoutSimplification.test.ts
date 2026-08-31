import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('escrita do diário não volta a ter sidebar ou grid de duas colunas', () => {
  const diary = read('src/components/DiaryExperience.tsx')
  assert.match(diary, /mx-auto max-w-3xl/)
  assert.doesNotMatch(diary, /<aside/)
  assert.doesNotMatch(diary, /lg:grid-cols-\[minmax\(0,1fr\)_280px\]/)
})

test('detalhes ficam fora do fluxo principal em drawer responsivo', () => {
  const drawer = read('src/components/DiaryDetailsDrawer.tsx')
  assert.match(drawer, /fixed inset-x-0 bottom-0/)
  assert.match(drawer, /md:right-0/)
  assert.match(drawer, /role="dialog"/)
  assert.match(drawer, /useModalA11y/)
})

test('seletor emocional começa recolhido, mostra grupo curto e oferece outros sentimentos', () => {
  const selector = read('src/components/DiaryMoodSelector.tsx')
  const featured = selector.match(/FEATURED_MOOD_KEYS = new Set\(\[([\s\S]*?)\]\)/)?.[1] || ''
  assert.equal((featured.match(/'/g) || []).length / 2, 6)
  assert.match(selector, /Quer acrescentar algo sobre este momento\?/)
  assert.match(selector, /Outros sentimentos/)
  assert.match(selector, /Menos estados/)
})

test('mobile preserva barra de ações essenciais', () => {
  const diary = read('src/components/DiaryExperience.tsx')
  assert.match(diary, /sticky bottom-0/)
  assert.match(diary, /Usar microfone/)
  assert.match(diary, /Abrir detalhes opcionais/)
  assert.match(diary, /Guardar meu registro/)
})
