import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const diary = readFileSync(new URL('../src/components/DiaryExperience.tsx', import.meta.url), 'utf8')
const mood = readFileSync(new URL('../src/components/DiaryMoodSelector.tsx', import.meta.url), 'utf8')

test('Fase 21.2 mantém a escrita como entrada principal', () => {
  assert.match(diary, /O que você quer colocar para fora hoje\?/)
  assert.match(diary, /Comece pelo texto(?:\. Se quiser, acrescente contexto depois\.| e acrescente contexto somente se fizer sentido\.)/)
  assert.match(diary, /Guardar meu registro/)
})

test('Fase 21.2 mantém o contexto emocional opcional e recolhido', () => {
  assert.match(mood, /Quer acrescentar algo sobre este momento\?/)
  assert.match(mood, /Opcional — só se isso ajudar a dar contexto ao que você escreveu\./)
  assert.match(mood, /Como você está se sentindo\?/)
  assert.match(mood, /Escolha apenas se isso ajudar a dar contexto ao que você escreveu\./)
  assert.doesNotMatch(mood, /É diferente da pergunta da página inicial/)
})

test('Fase 21.2 não transforma sentimentos em resposta sobre colaboração do dia', () => {
  assert.doesNotMatch(mood, /como o dia, no geral, colaborou/)
  assert.match(mood, /Outros sentimentos/)
})
