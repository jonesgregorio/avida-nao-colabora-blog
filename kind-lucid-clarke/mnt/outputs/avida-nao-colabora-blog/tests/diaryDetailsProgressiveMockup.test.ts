import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const drawer = readFileSync(new URL('../src/components/DiaryDetailsDrawer.tsx', import.meta.url), 'utf8')
const fields = readFileSync(new URL('../src/components/DiaryFormFields.tsx', import.meta.url), 'utf8')

test('mockup de detalhes mantém cinco decisões progressivas e remove aprofundamento extra', () => {
  for (const label of ['Energia e sono', 'Sentimentos principais', 'Contexto do dia', 'O que você precisa agora?', 'O que pode ajudar um pouco?', 'Salvar detalhes']) assert.ok(drawer.includes(label), label)
  assert.doesNotMatch(drawer, /Aprofundar sinais/)
  assert.doesNotMatch(drawer, /Gatilhos que você reconhece/)
})

test('+ outro permite escrever uma opção curta em todos os grupos exibidos de tags', () => {
  assert.ok((drawer.match(/allowCustom/g) || []).length >= 4)
  assert.match(fields, /\+ outro/)
  assert.match(fields, /Escreva em poucas palavras/)
  assert.match(fields, /onToggle\(clean\)/)
})

test('sentimentos usam uma única cor clara e os demais grupos usam tons neutros e claros', () => {
  assert.match(drawer, /allowCustom uniformLight maxSelected=\{5\}/)
  assert.ok((drawer.match(/allowCustom neutralLight/g) || []).length >= 3)
  assert.match(fields, /bg-\[#f4f8f4\]/)
  assert.match(fields, /bg-\[#faf8f4\]/)
  assert.match(fields, /border-\[#ddd7cc\]/)
  assert.match(fields, /selected\.length < maxSelected/)
  assert.match(fields, /disabled=\{!isSelected && !canAdd\}/)
})

test('tag digitada em "+ outro" sempre volta como chip (bug: ficava salva mas nunca aparecia na tela)', () => {
  // a causa: `visible` (lista fechada/aberta) só incluía itens de `selected` que também
  // estivessem em `options` — um texto digitado nunca está em `options`, então sumia da tela
  // mesmo indo pro registro normalmente.
  assert.match(fields, /const customSelected = selected\.filter\(item => !options\.includes\(item\)\)/)
  assert.match(fields, /customSelected\.map\(tag =>/)
  // renderizado incondicionalmente (fora do `open ? ... : ...` que fecha a lista padrão) —
  // não fica escondido atrás de "Ver mais opções" nem exige nada além de estar selecionado.
  assert.doesNotMatch(fields, /open \? options : unique\(\[\.\.\.options\.slice\(0, 6\), \.\.\.selected\.filter\(item => options\.includes\(item\)\)\]\)\)[\s\S]{0,40}customSelected/)
})

test('tag personalizada aparece com destaque leve (âmbar), distinto das opções pré-definidas', () => {
  assert.match(fields, /customSelected\.map\(tag => \([\s\S]{0,220}border-amber-200 bg-amber-50[\s\S]{0,60}text-amber-900/)
})
