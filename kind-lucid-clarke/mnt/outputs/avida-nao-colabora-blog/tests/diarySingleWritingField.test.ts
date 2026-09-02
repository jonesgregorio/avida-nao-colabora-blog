import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/DiaryPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/components/diarySingleWritingField.css', import.meta.url), 'utf8')
const diary = readFileSync(new URL('../src/components/DiaryExperience.tsx', import.meta.url), 'utf8')
const detailsDrawer = readFileSync(new URL('../src/components/DiaryDetailsDrawer.tsx', import.meta.url), 'utf8')

test('Diário para de renderizar os campos legados de texto livre na fonte (não só via CSS)', () => {
  assert.match(page, /diarySingleWritingField\.css/)
  assert.match(page, /diary-single-writing-field/)

  const removedOpenFields = [
    'Algo pelo qual sinto gratidão',
    'Uma pequena coisa que consegui',
    'O que parece ter disparado isso?',
    'Pensamentos que voltaram mais de uma vez',
    'O que você sente que precisa emocionalmente',
    'Algo sobre seus relacionamentos',
    'Algo sobre seus hábitos',
  ]

  for (const label of removedOpenFields) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.doesNotMatch(diary, new RegExp(`aria-label="${escaped}"`))
    assert.doesNotMatch(detailsDrawer, new RegExp(`aria-label="${escaped}"`))
  }

  assert.doesNotMatch(css, /display:\s*none\s*!important/)

  const contentRecommendation = readFileSync(new URL('../src/lib/contentRecommendation.ts', import.meta.url), 'utf8')
  assert.match(contentRecommendation, /emotional_triggers/)
})

test('Diário mantém editor principal, voz, ajuda, sinais e tags em camadas progressivas', () => {
  assert.match(diary, /aria-label="Texto do diário"/)
  assert.match(diary, /Prefiro falar/)
  assert.match(diary, /Preciso de ajuda para começar/)
  assert.match(diary, /Sugira uma pergunta/)
  assert.match(diary, /Organizar o que já escrevi/)
  assert.match(diary, /<DiaryDetailsDrawer/)
  assert.match(diary, /Adicionar mais detalhes/)
  assert.match(diary, /Usar este texto só como diário/)
  assert.doesNotMatch(detailsDrawer, /SliderField label="Humor"/)
  assert.doesNotMatch(detailsDrawer, /SliderField label="Ansiedade"/)
  assert.match(detailsDrawer, /SliderField label="Energia"/)
  assert.match(detailsDrawer, /SliderField label="Sono"/)
  assert.match(detailsDrawer, /title="Quais sentimentos apareceram\?"/)
  assert.match(detailsDrawer, /open=\{feelingsOpen\}/)
  assert.match(detailsDrawer, /TagGroup title="Sentimentos do momento"/)
  assert.match(detailsDrawer, /TagGroup title="Onde isso apareceu\?"/)
  assert.match(detailsDrawer, /TagGroup title="Gatilhos que você reconhece"/)
  assert.match(detailsDrawer, /Quer acrescentar contexto\?/)
  assert.match(detailsDrawer, /Sinais mais específicos/)
})
