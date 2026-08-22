import test from 'node:test'
import assert from 'node:assert/strict'
import { isGuidanceAnswered, resolveGuidanceResponse } from '../src/lib/monthlyGuidanceResponse.ts'

const finalLetter = { gentle_guidance: 'Você não precisa atravessar isso sem apoio.' }
const draftLetter = { final_response: { final_message_draft: 'Respire e escolha um passo possível hoje.' } }

test('reconhece a resposta canônica mesmo sem o campo legado response', () => {
  assert.equal(isGuidanceAnswered('answered', { finalResponseJson: finalLetter, response: null }), true)
  assert.deepEqual(resolveGuidanceResponse({ finalResponseJson: finalLetter }), { letter: finalLetter, fallback: '' })
})

test('mantém a ordem canônica e os fallbacks históricos', () => {
  assert.deepEqual(
    resolveGuidanceResponse({ finalResponseJson: finalLetter, aiDraftJson: draftLetter, response: 'Texto antigo' }),
    { letter: finalLetter, fallback: '' },
  )
  assert.deepEqual(resolveGuidanceResponse({ aiDraftJson: draftLetter, response: 'Texto antigo' }), {
    letter: draftLetter.final_response,
    fallback: '',
  })
  assert.deepEqual(resolveGuidanceResponse({ response: 'Texto antigo' }), { letter: undefined, fallback: 'Texto antigo' })
})

test('só marca como respondida com status correto e conteúdo válido', () => {
  assert.equal(isGuidanceAnswered('open', { finalResponseJson: finalLetter }), false)
  assert.equal(isGuidanceAnswered('answered', { finalResponseJson: {}, response: '   ' }), false)
})
