import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Suporte chama textos reutilizáveis de Respostas prontas em toda a interface', () => {
  const manager = read('src/components/admin/AdminReplyTemplates.tsx')
  const support = read('src/components/admin/AdminSupport.tsx')

  assert.match(manager, /Respostas prontas/)
  assert.match(manager, /Nova resposta pronta/)
  assert.match(manager, /Salvar resposta pronta/)
  assert.match(manager, /Nada é enviado automaticamente/)
  assert.doesNotMatch(manager, />Modelos de resposta</)
  assert.doesNotMatch(manager, />Novo modelo</)

  assert.match(support, /> Respostas prontas/)
  assert.match(support, /Selecionar resposta pronta…/)
  assert.match(support, /Buscar resposta pronta…/)
  assert.match(support, /Nenhuma resposta pronta encontrada/)
  assert.doesNotMatch(support, /Modelos de resposta/)
  assert.doesNotMatch(support, /Selecionar modelo…/)
  assert.doesNotMatch(support, /Buscar modelo…/)
})

test('Orientação do usuário mantém os bastidores de IA invisíveis', () => {
  const src = read('src/components/MonthlyGuidancePage.tsx')

  assert.match(src, /Análise cuidadosa antes da resposta/)
  assert.match(src, /Seu pedido está em análise/)
  assert.match(src, /Enviar orientação/)
  assert.match(src, /> Em análise</)
  assert.match(src, /Orientação respondida/)

  assert.doesNotMatch(src, /A IA pode/)
  assert.doesNotMatch(src, /inteligência artificial/i)
  assert.doesNotMatch(src, /rascunho interno/i)
  assert.doesNotMatch(src, /fila de revisão no Admin/i)
  assert.doesNotMatch(src, /Revisão humana antes da resposta/)
  assert.doesNotMatch(src, /Enviar para revisão/)
  assert.doesNotMatch(src, /> Em revisão</)

  // Compatibilidade interna permanece: os dados antigos ainda podem ser lidos,
  // mas esses nomes técnicos nunca são apresentados como texto ao usuário.
  assert.match(src, /ai_draft_json/)
  assert.match(src, /aiDraftJson: req\.ai_draft_json/)
})

test('Admin de Orientação usa quatro blocos e resumo lateral da IA', () => {
  const src = read('src/components/admin/AdminGuidanceRequests.tsx')
  for (const title of ['Solicitação', 'Usuário', 'Rascunho sugerido', 'Resposta revisada']) {
    assert.match(src, new RegExp(`title="${title}"`))
  }
  assert.match(src, /number="1" title="Solicitação"/)
  assert.match(src, /number="2" title="Usuário"/)
  assert.match(src, /number="3" title="Rascunho sugerido"/)
  assert.match(src, /number="4" title="Resposta revisada"/)
  assert.match(src, /Resumo da IA para revisão/)
  assert.match(src, /Rascunho da IA — não enviado/)
  assert.match(src, /Revisão humana obrigatória/)
})

test('rascunho continua separado do envio final', () => {
  const src = read('src/components/admin/AdminGuidanceRequests.tsx')
  assert.match(src, /Gerar outro rascunho/)
  assert.match(src, /Salvar rascunho/)
  assert.match(src, /Enviar resposta/)
  assert.match(src, /status: 'answered'/)
  assert.match(src, /review_badge: 'Orientação revisada'/)
  assert.match(src, /Somente este botão envia/)
})
