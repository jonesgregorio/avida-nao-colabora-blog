import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/DiaryPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/components/diarySingleWritingField.css', import.meta.url), 'utf8')
const diary = readFileSync(new URL('../src/components/DiaryExperience.tsx', import.meta.url), 'utf8')

test('Diário para de renderizar os campos legados de texto livre na fonte (não só via CSS)', () => {
  assert.match(page, /diarySingleWritingField\.css/)
  assert.match(page, /diary-single-writing-field/)

  // Estes 7 campos eram inputs/textareas reais, só escondidos por CSS
  // (display:none). Isso escondia visualmente mas continuava montando o
  // input no DOM. A simplificação definitiva do Diário exige parar de
  // RENDERIZAR esses campos na experiência de escrita de um novo registro
  // -- não apenas escondê-los. Os aria-labels abaixo não podem mais
  // aparecer como inputs/textareas no componente.
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
  }

  // O CSS não precisa mais esconder nada por display:none -- os campos
  // simplesmente não existem mais na árvore de componentes.
  assert.doesNotMatch(css, /display:\s*none\s*!important/)

  // Compatibilidade histórica: as colunas continuam existindo no tipo/banco
  // para leitura de registros antigos -- só a UI de escrita foi removida.
  // contentRecommendation.ts é o único consumidor de leitura restante.
  const contentRecommendation = readFileSync(new URL('../src/lib/contentRecommendation.ts', import.meta.url), 'utf8')
  assert.match(contentRecommendation, /emotional_triggers/)
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
