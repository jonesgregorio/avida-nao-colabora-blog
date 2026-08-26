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

test('usuário sabe que a orientação passa por revisão humana', () => {
  const src = read('src/components/MonthlyGuidancePage.tsx')
  assert.match(src, /Revisão humana antes da resposta/)
  assert.match(src, /não responde nem envia nada sozinha/)
  assert.match(src, /Enviar para revisão/)
  assert.match(src, /Em revisão/)
  assert.match(src, /Cada orientação passa por revisão humana antes do envio/)
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
