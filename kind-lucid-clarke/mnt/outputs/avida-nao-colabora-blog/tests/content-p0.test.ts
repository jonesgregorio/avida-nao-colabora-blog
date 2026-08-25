import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260819220500_content_p0_hardening.sql', import.meta.url),
  'utf8',
)

test('conteúdo automático ativo respeita Gratuito, Essencial e Plus no RLS', () => {
  assert.match(migration, /CREATE POLICY "automated_contents_free"/)
  assert.match(migration, /CREATE POLICY "automated_contents_essential"/)
  assert.match(migration, /CREATE POLICY "automated_contents_plus"/)
  assert.match(migration, /public\.current_user_has_plan\('essential'\)/)
  assert.match(migration, /public\.current_user_has_plan\('plus'\)/)
  assert.match(migration, /DROP POLICY IF EXISTS "Public can read active contents"/)
  assert.match(migration, /DROP POLICY IF EXISTS "Usuários leem conteúdos automáticos ativos"/)
})

test('guided_meditations legado deixa de ser público', () => {
  assert.match(migration, /DROP POLICY IF EXISTS "Meditations are public"/)
  assert.match(migration, /CREATE POLICY "guided_meditations_admin"/)
  assert.match(migration, /public\.is_admin\(\)/)
})
