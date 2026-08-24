import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/DiaryPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/components/diarySingleWritingField.css', import.meta.url), 'utf8')
const diary = readFileSync(new URL('../src/components/DiaryExperience.tsx', import.meta.url), 'utf8')

test('Diário aplica apresentação de campo único sem remover compatibilidade legada', () => {
  assert.match(page, /diarySingleWritingField\.css/)
  assert.match(page, /diary-single-writing-field/)

  const hiddenOpenFields = [
    'Algo pelo qual sinto gratidão',
    'Uma pequena coisa que consegui',
    'O que parece ter disparado isso?',
    'Pensamentos que voltaram mais de uma vez',
    'O que você sente que precisa emocionalmente',
    'Algo sobre seus relacionamentos',
    'Algo sobre seus hábitos',
  ]

  for (const label of hiddenOpenFields) {
    assert.match(css, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(css, /display:\s*none\s*!important/)
})

test('Diário mantém editor principal, voz, ajuda, mapas e tags', () => {
  assert.match(diary, /aria-label="Texto do diário"/)
  assert.match(diary, /Prefiro falar/)
  assert.match(diary, /Preciso de ajuda para começar/)
  assert.match(diary, /Sugira uma pergunta/)
  assert.match(diary, /Organizar o que já escrevi/)
  assert.match(diary, /SliderField label="Humor"/)
  assert.match(diary, /SliderField label="Energia"/)
  assert.match(diary, /TagGroup title="Quais sentimentos apareceram\?"/)
  assert.match(diary, /TagGroup title="Onde isso apareceu\?"/)
  assert.match(diary, /TagGroup title="Gatilhos que você reconhece"/)
})
