import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fix = readFileSync(new URL('../supabase/migrations/20260913100000_fix_guided_catalog_function_signature.sql', import.meta.url), 'utf8')

// A migration anterior (20260913000000) falhou de verdade em produção: Postgres recusa
// `CREATE OR REPLACE FUNCTION` quando a lista de colunas de retorno muda (erro 42P13),
// exigindo um DROP FUNCTION explícito antes. Como a chamada da API roda o arquivo inteiro
// numa transação, a falha reverteu TUDO daquele arquivo (colunas e tabelas novas inclusive).
// Esta migration de correção repete o conteúdo inteiro (idempotente) e resolve o único ponto
// que não era idempotente.

test('corrige o erro real de produção: DROP FUNCTION antes de recriar com a assinatura nova', () => {
  assert.match(fix, /DROP FUNCTION IF EXISTS public\.get_guided_catalog\(\);/)
  assert.match(fix, /DROP FUNCTION IF EXISTS public\.get_guided_catalog\(\);\s*\n\s*\nCREATE FUNCTION public\.get_guided_catalog\(\)/)
})

test('repete o restante do conteúdo original de forma idempotente (seguro reaplicar mesmo se parte já existir)', () => {
  assert.match(fix, /ALTER TABLE public\.articles ADD COLUMN IF NOT EXISTS objective TEXT/)
  assert.match(fix, /CREATE TABLE IF NOT EXISTS public\.guided_content_steps/)
  assert.match(fix, /CREATE TABLE IF NOT EXISTS public\.guided_content_progress/)
  assert.doesNotMatch(fix, /DROP TABLE|ALTER TABLE public\.articles (DROP COLUMN|ALTER COLUMN)/)
})

test('a função corrigida mantém objective/intensity/has_steps e não expõe o corpo das etapas', () => {
  assert.match(fix, /objective TEXT, intensity TEXT, has_steps BOOLEAN/)
  assert.doesNotMatch(fix, /guided_content_steps\.instruction/)
  assert.match(fix, /GRANT EXECUTE ON FUNCTION public\.get_guided_catalog\(\) TO anon, authenticated/)
})
