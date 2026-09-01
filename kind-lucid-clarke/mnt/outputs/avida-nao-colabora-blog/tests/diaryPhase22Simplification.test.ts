import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/DiaryPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/components/diarySingleWritingField.css', import.meta.url), 'utf8')
const mood = readFileSync(new URL('../src/components/DiaryMoodSelector.tsx', import.meta.url), 'utf8')

test('Fase 22.2 apresenta o Diário como espaço de escrita antes das ferramentas', () => {
  assert.match(page, /Seu espaço de escrita/)
  assert.match(page, />Diário<\/h1>/)
  assert.match(page, /Escreva primeiro\. Sentimentos, contexto e outros detalhes ficam disponíveis quando ajudarem/)
  assert.match(css, /textarea\[aria-label="Texto do diário"\]/)
  assert.match(css, /min-height: 420px/)
  assert.match(css, /--diary-paper/)
})

test('Fase 22.2 reduz o peso visual de continuidade, ferramentas e privacidade', () => {
  assert.match(css, /diary-phase22-continuity/)
  assert.match(css, /textarea\[aria-label="Texto do diário"\] \+ div button/)
  assert.match(css, /diary-ai-privacy-help/)
  assert.doesNotMatch(mood, /w-full rounded-2xl border border-line bg-white\/70/)
  assert.match(mood, /inline-flex items-center gap-1\.5 py-2 text-sm/)
})
