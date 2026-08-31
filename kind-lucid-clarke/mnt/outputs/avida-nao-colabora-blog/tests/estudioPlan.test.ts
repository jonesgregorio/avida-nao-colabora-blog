import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildWeekPlanRequest, parseWeekPlan, offsetToDate, coberturaResumo } from '../src/lib/estudioPlan.ts'

const ctx = {
  geradoEm: '2026-08-31T00:00:00Z',
  cobertura: [
    { categoria: 'Sono', artigos: 4, views: 1200, ultimoPost: null, diasSemPost: null },
    { categoria: 'Ansiedade', artigos: 9, views: 3400, ultimoPost: '2026-08-25', diasSemPost: 6 },
  ],
}

test('resumo de cobertura lista tema, artigos, views e gap', () => {
  const r = coberturaResumo(ctx)
  assert.match(r, /Sono: 4 artigos, 1200 views, sem post/)
  assert.match(r, /Ansiedade: 9 artigos, 3400 views, 6d sem post/)
})

test('prompt do plano pede JSON com posts e limita dia_offset a 0-6', () => {
  const p = buildWeekPlanRequest(ctx)
  assert.match(p, /"posts": \[/)
  assert.match(p, /dia_offset: inteiro de 0 a 6/)
  assert.match(p, /Sono: 4 artigos/)
  assert.match(p, /SOMENTE um JSON/)
})

test('parseWeekPlan aceita itens válidos, descarta formato inválido e ideia curta, e ordena', () => {
  const items = parseWeekPlan({
    posts: [
      { dia_offset: 3, formato: 'carrossel', tema_categoria: 'Sono', ideia: 'Higiene do sono sem culpa', objetivo: 'salvar' },
      { dia_offset: 1, formato: 'reel-capa', tema_categoria: 'Ansiedade', ideia: 'Três sinais de sobrecarga', objetivo: 'alcance' },
      { dia_offset: 0, formato: 'tiktok', ideia: 'formato que não existe aqui', objetivo: 'x' },
      { dia_offset: 2, formato: 'feed-45', ideia: 'curta', objetivo: 'x' },
      { dia_offset: 99, formato: 'quiz', tema_categoria: 'Sono', ideia: 'Mito ou verdade sobre soneca', objetivo: 'comentar' },
    ],
  })
  assert.equal(items.length, 3)
  assert.deepEqual(items.map(i => i.formato), ['reel-capa', 'carrossel', 'quiz'])
  assert.equal(items[2].diaOffset, 6) // 99 clampado
})

test('offsetToDate marca 19h e avança o número certo de dias', () => {
  const base = new Date('2026-09-01T08:00:00')
  const d = new Date(offsetToDate(2, base))
  assert.equal(d.getDate(), 3)
  assert.equal(d.getHours(), 19)
})

test('blogContext só lê agregados públicos, sem tocar em dados de usuário', () => {
  const src = readFileSync(new URL('../src/lib/estudioBlogContext.ts', import.meta.url), 'utf8')
  assert.match(src, /from\('categories'\)/)
  assert.match(src, /from\('articles'\)/)
  assert.match(src, /event.*article_view/)
  assert.doesNotMatch(src, /diary|journal|mood|emotional_tags|user_id/i)
})
