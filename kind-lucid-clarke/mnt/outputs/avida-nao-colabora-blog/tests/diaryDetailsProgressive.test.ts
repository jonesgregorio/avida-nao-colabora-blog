import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const drawer = readFileSync(new URL('../src/components/DiaryDetailsDrawer.tsx', import.meta.url), 'utf8')
const fields = readFileSync(new URL('../src/components/DiaryFormFields.tsx', import.meta.url), 'utf8')

test('detalhes do diário são progressivos e não repetem humor/ansiedade como escalas gerais', () => {
  assert.match(drawer, /Nada aqui é obrigatório/)
  assert.match(drawer, /Como esse momento apareceu em você\?/)
  assert.match(drawer, /Quer acrescentar contexto\?/)
  assert.match(drawer, /O que pode ajudar um pouco\?/)
  assert.match(drawer, /Possibilidades de cuidado, não uma lista de tarefas/)
  assert.match(drawer, /Sinais mais específicos/)
  assert.match(drawer, /contextOpen/)
  assert.match(drawer, /careOpen/)
  assert.doesNotMatch(drawer, /SliderField label="Humor"/)
  assert.doesNotMatch(drawer, /SliderField label="Ansiedade"/)
})

test('grupos de tags começam compactos para reduzir sensação de formulário', () => {
  assert.match(fields, /options\.slice\(0, 6\)/)
  assert.match(fields, /options\.length > 6/)
})
