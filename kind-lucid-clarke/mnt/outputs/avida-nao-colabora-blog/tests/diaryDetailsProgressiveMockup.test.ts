import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const drawer = readFileSync(new URL('../src/components/DiaryDetailsDrawer.tsx', import.meta.url), 'utf8')
const fields = readFileSync(new URL('../src/components/DiaryFormFields.tsx', import.meta.url), 'utf8')

test('mockup de detalhes reduz a experiência a cinco decisões progressivas e Plus discreto', () => {
  for (const label of ['Energia e sono', 'Sentimentos principais', 'Contexto do dia', 'O que você precisa agora?', 'O que pode ajudar um pouco?', 'Aprofundar sinais', 'Salvar detalhes']) assert.ok(drawer.includes(label), label)
})

test('+ outro permite escrever uma opção curta em todos os grupos baseados em tags', () => {
  assert.ok((drawer.match(/allowCustom/g) || []).length >= 5)
  assert.match(fields, /\+ outro/)
  assert.match(fields, /Escreva em poucas palavras/)
  assert.match(fields, /onToggle\(clean\)/)
})

test('sentimentos principais usam uma única família clara e respeitam limite de cinco', () => {
  assert.match(drawer, /allowCustom uniformLight maxSelected=\{5\}/)
  assert.match(fields, /border-forest-200 bg-mint\/35 text-forest-700/)
  assert.match(fields, /selected\.length < maxSelected/)
  assert.match(fields, /disabled=\{!selected\.includes\(tag\) && !canAdd\}/)
})