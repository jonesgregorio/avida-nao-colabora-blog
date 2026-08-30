import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/components/QuestionnairesPage.tsx', import.meta.url), 'utf8')

test('Questionários usa histórico sem transformar catálogo em meta de conclusão', () => {
  assert.match(source, /Suas avaliações/)
  assert.match(source, /Não existe objetivo de completar todos/)
  assert.match(source, /Respondidos anteriormente/)
  assert.match(source, /Para retomar, se quiser/)
  assert.match(source, /Disponíveis para você/)

  assert.doesNotMatch(source, /Seu progresso/)
  assert.doesNotMatch(source, /questionários concluídos/)
  assert.doesNotMatch(source, /Cada reflexão te aproxima/)
  assert.doesNotMatch(source, /function Ring/)
  assert.doesNotMatch(source, /strokeDashoffset/)
})

test('Questionários mantém estados úteis sem linguagem de cobrança', () => {
  assert.match(source, /Respondido antes/)
  assert.match(source, /Para continuar/)
  assert.match(source, /Responder novamente/)
  assert.match(source, /Retomar/)
  assert.match(source, /Não existe frequência certa/)
})
