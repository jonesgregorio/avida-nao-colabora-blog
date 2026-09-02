import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/SelfCarePlanPageLegacy.tsx', import.meta.url), 'utf8')

test('Plano de Autocuidado evita linguagem de cobrança ou conclusão', () => {
  assert.match(page, /quando quiser podem ajudar a contextualizar seu próximo plano/i)
  assert.match(page, /possibilidades de cuidado/i)
  assert.match(page, /Uma intenção emocional possível/)
  assert.match(page, /Você pode testar nenhuma, uma ou várias delas/i)
  assert.doesNotMatch(page, /Continue registrando no diário e respondendo aos questionários|Meta emocional leve|Semana \{i \+ 1\}|metas simples para o seu mês/i)
})
