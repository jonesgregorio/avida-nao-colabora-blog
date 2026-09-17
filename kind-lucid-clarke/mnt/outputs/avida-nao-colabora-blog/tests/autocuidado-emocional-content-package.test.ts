import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260917024500_autocuidado_emocional_first_content_package.sql', import.meta.url), 'utf8')
const guides = readFileSync(new URL('../src/lib/seoGuides.ts', import.meta.url), 'utf8')
const executableSql = migration.replace(/^\s*--.*$/gm, '')

const newSlug = 'rotina-de-autocuidado-emocional-como-criar-uma-versao-possivel'
const pillarSlug = 'o-que-e-autocuidado-emocional-na-vida-real'

test('pacote cria apenas a lacuna editorial de rotina possível', () => {
  assert.match(migration, new RegExp(newSlug))
  assert.doesNotMatch(migration, /burnout|diagnosticar|tratamento|cura/i)
})

test('novo artigo permanece público e sem promessa clínica', () => {
  assert.match(migration, /'published', true, now\(\), 'free'/)
  assert.match(migration, /não substitui avaliação ou acompanhamento profissional/i)
})

test('pilar passa a responder diretamente o que é autocuidado emocional', () => {
  assert.match(migration, /keyword = 'o que é autocuidado emocional'/)
  assert.match(migration, new RegExp(`WHERE slug = '${pillarSlug}'`))
})

test('guia inclui a nova página e mantém Plano de Autocuidado como ferramenta', () => {
  assert.match(guides, new RegExp(newSlug))
  assert.match(guides, /rotina de autocuidado emocional/)
  assert.match(guides, /tool:'self-care'/)
})

test('pacote não altera superfícies sensíveis', () => {
  assert.doesNotMatch(executableSql, /CREATE POLICY|ALTER POLICY|DROP POLICY/i)
  assert.doesNotMatch(executableSql, /stripe|price_id|subscription_status/i)
  assert.doesNotMatch(executableSql, /UPDATE\s+public\.(diary|checkin|profiles|subscriptions)/i)
})
