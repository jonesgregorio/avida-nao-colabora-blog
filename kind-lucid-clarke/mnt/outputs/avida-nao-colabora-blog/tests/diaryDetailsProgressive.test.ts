import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const drawer = readFileSync(new URL('../src/components/DiaryDetailsDrawer.tsx', import.meta.url), 'utf8')
const fields = readFileSync(new URL('../src/components/DiaryFormFields.tsx', import.meta.url), 'utf8')

test('detalhes do diário seguem o mockup progressivo sem repetir humor ou ansiedade geral', () => {
  assert.match(drawer, /Adicionar mais detalhes \(opcional\)/)
  assert.match(drawer, /Energia e sono/)
  assert.match(drawer, /Sentimentos principais/)
  assert.match(drawer, /Contexto do dia/)
  assert.match(drawer, /O que você precisa agora\?/)
  assert.match(drawer, /O que pode ajudar um pouco\?/)
  assert.match(drawer, /Aprofundar sinais/)
  assert.doesNotMatch(drawer, /SliderField label="Humor"/)
  assert.doesNotMatch(drawer, /SliderField label="Ansiedade"/)
})

test('grupos de tags continuam compactos para reduzir sensação de formulário', () => {
  assert.match(fields, /options\.slice\(0, 6\)/)
  assert.match(fields, /options\.length > 6/)
  assert.match(fields, /Ver mais opções/)
})