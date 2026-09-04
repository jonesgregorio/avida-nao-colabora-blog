import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const service = readFileSync(
  new URL('../src/services/personalizedDeliveryService.ts', import.meta.url),
  'utf8',
)

// Comentário profissional foi aposentado (PR3/PR2). O único jeito de este
// ramo ainda ser alcançado é uma tarefa de fila (user_personalization_tasks)
// criada ANTES da aposentadoria e nunca enviada — o serviço precisa recusar
// esse envio de forma explícita, nunca gravar em professional_comments de novo.
test('envio de comentário profissional é recusado explicitamente, nunca grava em professional_comments', () => {
  assert.doesNotMatch(service, /function reflectInProfessionalComments/)
  assert.doesNotMatch(service, /\.from\('professional_comments'\)\.insert/)
  assert.match(service, /COMMENT_TYPES\.has\(contentType\) \|\| targetArea === 'professional_comments'/)
  assert.match(service, /ok: false,\s*\n\s*error: 'Comentário profissional foi descontinuado e não pode mais ser enviado\. Cancele esta tarefa em vez de enviá-la\.',/)
})

test('orientação mensal continua refletindo normalmente e devolve erro explícito quando não consegue', () => {
  assert.match(service, /\.from\('monthly_guidance_requests'\)\.update/)
  assert.match(service, /Falha ao atualizar orientação mensal/)
  assert.match(service, /Nenhuma orientação mensal aberta foi encontrada/)
  assert.match(service, /Falha ao refletir orientação mensal/)
})
