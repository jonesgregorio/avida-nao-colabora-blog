import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260916233000_diario_emocional_first_content_package.sql', import.meta.url), 'utf8')
const guides = readFileSync(new URL('../src/lib/seoGuides.ts', import.meta.url), 'utf8')
const executableSql = migration.replace(/^\s*--.*$/gm, '')

const exampleSlug = 'diario-emocional-exemplo-preenchido-passo-a-passo'
const formatSlug = 'diario-emocional-no-celular-ou-no-papel'
const pillarSlug = 'como-comecar-um-diario-emocional-sem-saber-o-que-escrever'

test('pacote cria somente as duas lacunas editoriais aprovadas', () => {
  assert.match(migration, new RegExp(exampleSlug))
  assert.match(migration, new RegExp(formatSlug))
  assert.doesNotMatch(migration, /diario-emocional-para-ansiedade/)
  assert.doesNotMatch(migration, /30-perguntas/)
})

test('novos artigos permanecem públicos e educativos', () => {
  const freeOccurrences = migration.match(/'published', true, now\(\), 'free'/g) ?? []
  assert.equal(freeOccurrences.length, 2)
  assert.match(migration, /não substitui|não clínicos|não clínica|não clinicos|não clinico/i)
})

test('artigo-pilar recebe intenção explícita de como começar', () => {
  assert.match(migration, /keyword = 'como começar um diário emocional'/)
  assert.match(migration, new RegExp(`WHERE slug = '${pillarSlug}'`))
})

test('guia Diário emocional inclui as duas novas páginas na jornada', () => {
  assert.match(guides, new RegExp(exampleSlug))
  assert.match(guides, new RegExp(formatSlug))
  assert.match(guides, /exemplo de diário emocional/)
})

test('pacote não altera superfícies sensíveis', () => {
  assert.doesNotMatch(executableSql, /CREATE POLICY|ALTER POLICY|DROP POLICY/i)
  assert.doesNotMatch(executableSql, /stripe|price_id|subscription_status/i)
  assert.doesNotMatch(executableSql, /UPDATE\s+public\.(diary|checkin|profiles|subscriptions)/i)
})
