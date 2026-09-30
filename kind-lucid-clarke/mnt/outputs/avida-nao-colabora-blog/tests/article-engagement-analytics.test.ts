import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const tracker = read('src/lib/articleActiveTime.ts')
const main = read('src/main.tsx')
const readers = read('src/components/admin/AdminArticleReaders.tsx')

test('tempo ativo de artigo é iniciado no app e pausa em aba oculta/inatividade', () => {
  assert.match(main, /initArticleActiveTimeTracking/)
  assert.match(tracker, /article_active_time/)
  assert.match(tracker, /visibilityState !== 'visible'/)
  assert.match(tracker, /IDLE_AFTER_MS = 60000/)
  assert.match(tracker, /active_seconds/)
  assert.match(tracker, /estimated_read_seconds/)
  assert.match(tracker, /avnc_smoke/)
})

test('painel de leitores inclui filtros, tempo, engajamento e funil compacto', () => {
  assert.match(readers, /Engajados sem cadastro/)
  assert.match(readers, /Tempo ativo médio/)
  assert.match(readers, /Funil de leitura → cadastro/)
  assert.match(readers, /Todo engajamento/)
  assert.match(readers, /Qualquer profundidade/)
  assert.match(readers, /Qualquer tempo ativo/)
  assert.match(readers, /Cadastro: todos/)
  assert.match(readers, /PAGE_SIZE_OPTIONS = \[10, 20, 50, 100\]/)
  assert.match(readers, /article_active_time/)
  assert.match(readers, /registration_complete/)
  assert.match(readers, /signup_start/)
})

test('classificação distingue superficial, parcial, engajado e alta intenção', () => {
  for (const label of ['Superficial', 'Parcial', 'Engajado', 'Alta intenção']) assert.match(readers, new RegExp(label))
  assert.match(readers, /activeSeconds \/ estimatedReadSeconds/)
  assert.match(readers, /progress >= 75/)
  assert.match(readers, /progress >= 50/)
})

test('rastreamento não consulta conteúdo sensível', () => {
  for (const forbidden of ['diary_entries', 'checkins', 'questionnaire_responses', 'emotional_entries']) {
    assert.doesNotMatch(tracker, new RegExp(forbidden))
    assert.doesNotMatch(readers, new RegExp(forbidden))
  }
})
