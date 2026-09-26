import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (file: string) => readFileSync(resolve(root, file), 'utf8')

test('Search Console coleta dimensões avançadas e tipos adicionais sem perder o web principal', () => {
  const fn = read('supabase/functions/google-search-console/index.ts')
  for (const dimension of ["'device'", "'country'", "'searchAppearance'"]) assert.match(fn, new RegExp(dimension))
  for (const type of ["'image'", "'video'", "'news'", "'discover'", "'googleNews'"]) assert.match(fn, new RegExp(type))
  for (const stored of ["'device'", "'country'", "'search_appearance'", "'search_type'"]) assert.match(fn, new RegExp(stored))
  assert.match(fn, /type: SearchType = 'web'/)
})

test('sincronização mantém histórico anual de totais e pagina resultados do Search Analytics', () => {
  const fn = read('supabase/functions/google-search-console/index.ts')
  assert.match(fn, /historyStart = isoDay\(-365\)/)
  assert.match(fn, /startRow/)
  assert.match(fn, /Math\.min\(25000/)
  assert.match(fn, /history:\s*\{/)
})

test('inspeções de URL rodam em paralelo para reduzir duração do cron', () => {
  const fn = read('supabase/functions/google-search-console/index.ts')
  assert.match(fn, /Promise\.all\(candidates\.map/)
  assert.doesNotMatch(fn, /for \(const candidate of candidates\)[\s\S]{0,200}await inspectUrl/)
})

test('constraint aceita todas as novas dimensões persistidas', () => {
  const migration = read('supabase/migrations/20260926213000_expand_search_console_dimensions.sql')
  for (const dimension of ['total','query','page','query_page','device','country','search_appearance','search_type']) assert.match(migration, new RegExp(`'${dimension}'`))
})
