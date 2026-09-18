import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260917022000_emocoes_autoconhecimento_first_content_package.sql', import.meta.url), 'utf8')
const guides = readFileSync(new URL('../src/lib/seoGuides.ts', import.meta.url), 'utf8')
const executableSql = migration.replace(/^\s*--.*$/gm, '')

const newSlug = 'emocao-pensamento-ou-necessidade-como-perceber-a-diferenca'
const pillarSlug = 'faca-seu-primeiro-check-in-emocional'
const actualPerceberSlug = 'como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-per'

test('pacote cria apenas a lacuna editorial aprovada', () => {
  assert.match(migration, new RegExp(newSlug))
  assert.doesNotMatch(migration, /burnout|transtorno|diagnosticar/i)
})

test('novo artigo permanece público e educativo', () => {
  assert.match(migration, /'published', true, now\(\), 'free'/)
  assert.match(migration, /não é criar uma regra rígida|não precisa ser tratado como uma descrição completa/i)
})

test('check-in vira pilar de entrada do cluster', () => {
  assert.match(migration, /keyword = 'como fazer check-in emocional'/)
  assert.match(migration, new RegExp(`WHERE slug = '${pillarSlug}'`))
})

test('guia usa o slug real e inclui a nova lacuna', () => {
  assert.match(guides, new RegExp(newSlug))
  assert.match(guides, new RegExp(actualPerceberSlug))
  assert.doesNotMatch(guides, /como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-perfeita/)
})

test('pacote não altera superfícies sensíveis', () => {
  assert.doesNotMatch(executableSql, /CREATE POLICY|ALTER POLICY|DROP POLICY/i)
  assert.doesNotMatch(executableSql, /stripe|price_id|subscription_status/i)
  assert.doesNotMatch(executableSql, /UPDATE\s+public\.(diary|checkin|profiles|subscriptions)/i)
})
