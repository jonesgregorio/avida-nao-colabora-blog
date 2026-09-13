import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/SelfCarePlanPage.tsx', import.meta.url), 'utf8')

test('Plano de Autocuidado evita linguagem de cobrança ou conclusão', () => {
  assert.match(page, /sem transformar autocuidado em cobrança/i)
  assert.match(page, /Sem porcentagem, sequência ou meta\. O importante é perceber o que funciona\./)
  assert.match(page, /não precisa completar o plano para ele ser útil/i)
  assert.match(page, /sem aumentar a cobrança/i)
  assert.doesNotMatch(page, /Continue registrando no diário e respondendo aos questionários|Meta emocional leve|Semana \{i \+ 1\}|metas simples para o seu mês/i)
})
