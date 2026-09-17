import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260917024500_sono_descanso_energia_first_content_package.sql', import.meta.url), 'utf8')
const guides = readFileSync(new URL('../src/lib/seoGuides.ts', import.meta.url), 'utf8')
const executableSql = migration.replace(/^\s*--.*$/gm, '')

const newSlug = 'como-desacelerar-a-mente-antes-de-dormir-sem-transformar-o-sono-em-cobranca'
const draftScreenSlug = 'como-as-telas-atrapalham-o-sono-e-o-que-mudar-gxmen-y7n'

test('pacote cria apenas uma nova lacuna pública de sono', () => {
  assert.match(migration, new RegExp(newSlug))
  assert.match(migration, /'published', true, now\(\), 'free'/)
  assert.doesNotMatch(migration, /cura|tratar insônia|diagnóstico de insônia/i)
})

test('novo artigo inclui limite editorial de saúde', () => {
  assert.match(migration, /não substitui avaliação profissional/i)
  assert.match(migration, /dificuldades persistentes para dormir/i)
})

test('conteúdos publicados deixam de apontar para slug em draft e 404', () => {
  const updateSection = migration.slice(migration.indexOf('UPDATE public.articles SET'))
  assert.doesNotMatch(updateSection, new RegExp(draftScreenSlug))
})

test('guia inclui a nova lacuna e remove exercício de sobrecarga', () => {
  assert.match(guides, new RegExp(newSlug))
  const sleepLine = guides.split('\n').find(line => line.includes("title:'Sono, descanso e energia'")) ?? ''
  assert.doesNotMatch(sleepLine, /um-exercicio-de-pausa-para-dias-pesados/)
})

test('pacote não altera superfícies sensíveis', () => {
  assert.doesNotMatch(executableSql, /CREATE POLICY|ALTER POLICY|DROP POLICY/i)
  assert.doesNotMatch(executableSql, /stripe|price_id|subscription_status/i)
  assert.doesNotMatch(executableSql, /UPDATE\s+public\.(diary|checkin|profiles|subscriptions)/i)
})
