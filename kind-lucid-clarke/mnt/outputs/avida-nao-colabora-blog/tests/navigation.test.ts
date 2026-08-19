import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalPathForLocation,
  normalizeLegacyView,
  parseNavLocation,
  restoreNavFrom,
  urlForView,
} from '../src/lib/navigation.ts'

test('resolve deep links dinâmicos de artigo e suporte', () => {
  assert.deepEqual(parseNavLocation('/blog/ciclos-emocionais'), {
    view: 'article', articleSlug: 'ciclos-emocionais', ticketId: null,
  })
  assert.deepEqual(parseNavLocation('/suporte/ticket-123'), {
    view: 'support-ticket', articleSlug: null, ticketId: 'ticket-123',
  })
})

test('mantém aliases e rotas legadas compatíveis com URLs canônicas', () => {
  assert.equal(parseNavLocation('/orientacao')?.view, 'monthly-guidance')
  assert.equal(canonicalPathForLocation('/orientacao'), '/guia-mensal')

  assert.equal(parseNavLocation('/conquistas')?.view, 'home')
  assert.equal(canonicalPathForLocation('/conquistas'), '/')

  assert.equal(parseNavLocation('/minha-evolucao')?.view, 'my-evolution')
  assert.equal(canonicalPathForLocation('/minha-evolucao'), '/mapa-emocional')
})

test('normaliza views legadas usadas por navigate()', () => {
  assert.equal(normalizeLegacyView('trails'), 'articles')
  assert.equal(normalizeLegacyView('therapeutic-q'), 'questionarios')
  assert.equal(normalizeLegacyView('diary'), 'diary')
})

test('gera URLs canônicas para views simples e dinâmicas', () => {
  assert.equal(urlForView('diary'), '/diario')
  assert.equal(urlForView('article', 'meu-artigo'), '/blog/meu-artigo')
  assert.equal(urlForView('support-ticket', null, 'abc'), '/suporte/abc')
  assert.equal(urlForView('view-inexistente'), '/')
})

test('preserva compatibilidade de ?view e rejeita caminhos desconhecidos', () => {
  assert.equal(parseNavLocation('/qualquer', '?view=diary')?.view, 'diary')
  assert.equal(parseNavLocation('/rota-inexistente'), null)
  assert.equal(canonicalPathForLocation('/rota-inexistente'), '/')
  assert.equal(canonicalPathForLocation('/diario'), null)
})

test('não restaura navegação persistida quando o path específico é inválido', () => {
  const storage = { getItem: () => JSON.stringify({ view: 'diary', articleSlug: null, ticketId: null }) }
  assert.equal(restoreNavFrom('/rota-inexistente', '', storage), null)
})
