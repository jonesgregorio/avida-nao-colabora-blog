import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FUNCTION_ERROR_FALLBACK, serverErrorMessage } from '../src/lib/functionError.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// o que o supabase-js devolve quando a função responde 400/500
const httpError = (body: unknown, message = 'Edge Function returned a non-2xx status code') => ({
  message,
  context: { json: async () => body },
})

test('mostra o motivo que a função enviou no corpo da resposta, em vez do texto genérico em inglês', async () => {
  const msg = await serverErrorMessage(httpError({ error: 'Sem assinatura ativa para upgrade. Assine um plano primeiro.' }), null)
  assert.equal(msg, 'Sem assinatura ativa para upgrade. Assine um plano primeiro.')
  assert.equal(await serverErrorMessage(httpError({ error: 'Você já tem uma assinatura ativa. Use "Mudar plano" para trocar de plano.' }), null),
    'Você já tem uma assinatura ativa. Use "Mudar plano" para trocar de plano.')
})

test('aceita "message" no corpo e ignora espaços extras', async () => {
  assert.equal(await serverErrorMessage(httpError({ message: '  Algo   aconteceu \n agora ' }), null), 'Algo aconteceu agora')
})

test('sem corpo útil cai para data.error, depois para a mensagem do erro, depois para o texto padrão', async () => {
  // função respondeu 200 com erro no JSON
  assert.equal(await serverErrorMessage(null, { ok: false, error: 'Plano inválido.' }), 'Plano inválido.')
  // corpo ilegível (não é JSON): usa a mensagem do erro se ela for útil
  const unreadable = { message: 'Plano indisponível', context: { json: async () => { throw new Error('not json') } } }
  assert.equal(await serverErrorMessage(unreadable, null), 'Plano indisponível')
  // tudo genérico: texto padrão em português (nunca o inglês técnico)
  const generic = await serverErrorMessage({ message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({}) } }, null)
  assert.equal(generic, FUNCTION_ERROR_FALLBACK)
  assert.equal(await serverErrorMessage({ message: 'Failed to send a request to the Edge Function' }, null, 'Não foi possível fazer o upgrade agora.'), 'Não foi possível fazer o upgrade agora.')
  assert.equal(await serverErrorMessage(undefined, undefined), FUNCTION_ERROR_FALLBACK)
})

test('texto genérico dentro do corpo também é descartado e mensagens enormes são cortadas', async () => {
  assert.equal(await serverErrorMessage(httpError({ error: 'Edge Function returned a non-2xx status code' }), null, 'tente depois'), 'tente depois')
  const long = 'x'.repeat(1000)
  assert.equal((await serverErrorMessage(httpError({ error: long }), null)).length, 300)
  // valores que não são texto são ignorados
  assert.equal(await serverErrorMessage(httpError({ error: { detalhe: 'objeto' } }), null, 'padrão'), 'padrão')
})

test('telas de plano e de preços usam a mensagem real do servidor e não o texto genérico do erro', () => {
  const plan = read('src/components/MyPlanPageCore.tsx')
  const pricing = read('src/components/Pricing.tsx')
  assert.match(plan, /import \{ serverErrorMessage \} from '\.\.\/lib\/functionError'/)
  assert.match(pricing, /import \{ serverErrorMessage \} from '\.\.\/lib\/functionError'/)
  assert.equal((plan.match(/await serverErrorMessage\(error, data,/g) ?? []).length, 5) // checkout, upgrade, downgrade, cancelar, reativar
  assert.match(pricing, /await serverErrorMessage\(fnError, data,/)
  // o padrão antigo (mensagem genérica do erro) não pode voltar para as funções de cobrança
  assert.doesNotMatch(plan, /throw new Error\(error\?\.message \?\?/)
  assert.doesNotMatch(pricing, /throw new Error\(fnError\?\.message \|\|/)
})

test('só o texto exibido muda: as chamadas às funções de cobrança continuam idênticas', () => {
  const plan = read('src/components/MyPlanPageCore.tsx')
  assert.match(plan, /functions\.invoke\('create-checkout', \{\s+body: \{ plan: targetPlan, origin: window\.location\.origin \},/)
  assert.match(plan, /body: \{ action: 'upgrade', targetPlan \}/)
  assert.match(plan, /body: \{ action: 'reactivate' \}/)
})
