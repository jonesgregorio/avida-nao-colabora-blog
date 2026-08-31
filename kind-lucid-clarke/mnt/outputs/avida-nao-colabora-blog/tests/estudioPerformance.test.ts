import test from 'node:test'
import assert from 'node:assert/strict'
import { toPerfRows, summarize, buildPerfReadingRequest } from '../src/lib/estudioPerformance.ts'
import type { Publicacao } from '../src/lib/estudioPublications.ts'

function pub(over: Partial<Publicacao>): Publicacao {
  return {
    id: 'x', status: 'publicado', titulo: 't', ideia: null, objetivos: [], estilo: null,
    promptImagem: null, legenda: null, hashtags: null, primeiroComentario: null,
    formatos: ['carrossel'], temaCategoria: null, publishMode: 'agendar', scheduledFor: null,
    postUrl: null, publishedAt: null, alcance: null, salvos: null, compartilhamentos: null,
    cliquesBlog: null, cadastros: null, createdAt: '', updatedAt: '', ...over,
  }
}

test('toPerfRows pega só pronto/publicado e o primeiro formato', () => {
  const rows = toPerfRows([
    pub({ id: 'a', status: 'rascunho' }),
    pub({ id: 'b', status: 'publicado', formatos: ['reel-capa', 'story'] }),
    pub({ id: 'c', status: 'pronto' }),
  ])
  assert.deepEqual(rows.map(r => r.id), ['b', 'c'])
  assert.equal(rows[0].formatoPrincipal, 'reel-capa')
})

test('summarize agrega só os posts com alcance preenchido e calcula taxa de salvamento', () => {
  const rows = toPerfRows([
    pub({ id: 'a', formatos: ['carrossel'], alcance: 1000, salvos: 200, cadastros: 7 }),
    pub({ id: 'b', formatos: ['reel-capa'], alcance: 4000, salvos: 100, cadastros: 3 }),
    pub({ id: 'c', formatos: ['feed-45'], alcance: null, salvos: 999 }),
  ])
  const s = summarize(rows)
  assert.equal(s.medidos, 2)
  assert.equal(s.totalAlcance, 5000)
  assert.equal(s.totalSalvos, 300)
  assert.equal(s.totalCadastros, 10)
  assert.equal(s.taxaSalvamento, 300 / 5000)
  // ordenado por cadastros desc: carrossel (7) antes de reel (3)
  assert.equal(s.porFormato[0].formato, 'carrossel')
})

test('prompt de leitura só usa números da lista e não menciona Diário', () => {
  const rows = toPerfRows([pub({ id: 'a', alcance: 1000, salvos: 200, cadastros: 7 })])
  const p = buildPerfReadingRequest(rows)
  assert.match(p, /alcance 1000, salvos 200/)
  assert.match(p, /Não invente números/)
  assert.doesNotMatch(p, /diário|humor|emotional/i)
})
