import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260917150000_relacoes_limites_first_content_package.sql', import.meta.url), 'utf8')
const guides = readFileSync(new URL('../src/lib/seoGuides.ts', import.meta.url), 'utf8')
const executableSql = migration.replace(/^\s*--.*$/gm, '')

const pillarSlug = 'como-conversar-sobre-os-seus-limites-sem-transformar-tudo-em'
const sayingNoSlug = 'como-dizer-nao-sem-culpa-e-preservar-sua-energia'

test('pacote reaproveita o rascunho existente em vez de criar artigo redundante', () => {
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+public\.articles/i)
  assert.match(migration, new RegExp(sayingNoSlug))
  assert.match(migration, /status = 'published'/)
  assert.match(migration, /plan_required = 'free'/)
})

test('artigo de dizer não é reescrito sem promessas clínicas ou causalidade forte', () => {
  assert.match(migration, /Dizer “não” pode ser desconfortável/i)
  assert.doesNotMatch(migration, /ajuda o cérebro|restaurador|cura|trata ansiedade|elimina culpa/i)
  assert.match(migration, /ameaça, violência, coerção ou medo/i)
})

test('pilar usa o slug real que existe no banco', () => {
  assert.match(guides, new RegExp(`slug:'${pillarSlug}'`))
  assert.doesNotMatch(guides, /slug:'como-conversar-sobre-seus-limites-sem-transformar-tudo-em-conflito'/)
})

test('guia encadeia pilar e artigo de dizer não', () => {
  const relationsLine = guides.split('\n').find(line => line.includes("title:'Relações e limites'")) ?? ''
  assert.match(relationsLine, new RegExp(sayingNoSlug))
  assert.match(relationsLine, /Como colocar limites e dizer não sem culpa/)
})

test('pacote não altera superfícies sensíveis', () => {
  assert.doesNotMatch(executableSql, /CREATE POLICY|ALTER POLICY|DROP POLICY/i)
  assert.doesNotMatch(executableSql, /stripe|price_id|subscription_status/i)
  assert.doesNotMatch(executableSql, /UPDATE\s+public\.(diary|checkin|profiles|subscriptions)/i)
})
