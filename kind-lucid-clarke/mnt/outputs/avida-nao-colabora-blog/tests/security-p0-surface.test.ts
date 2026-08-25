import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260819224000_security_p0_surface_hardening.sql', import.meta.url), 'utf8')
const resend = readFileSync(new URL('../supabase/functions/resend-webhook/index.ts', import.meta.url), 'utf8')

test('RPC de atividade do diário deixa de ser pública e preserva service_role', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_diary_activity_since\(timestamptz\) FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_diary_activity_since\(timestamptz\) TO service_role/)
})

test('triggers SECURITY DEFINER fixam search_path', () => {
  assert.match(migration, /FUNCTION public\.handle_new_user\(\)[\s\S]*SET search_path = 'public'/)
  assert.match(migration, /FUNCTION public\.sync_profile_email\(\)[\s\S]*SET search_path = 'public'/)
})

test('Storage aplica limites e tipos de imagem no servidor', () => {
  assert.match(migration, /file_size_limit = 2097152/)
  assert.match(migration, /file_size_limit = 10485760/)
  assert.match(migration, /image\/jpeg/)
  assert.match(migration, /image\/png/)
  assert.match(migration, /image\/webp/)
})

test('resend-webhook falha fechado e limita replay', () => {
  assert.match(resend, /if \(!secret\) return false/)
  assert.doesNotMatch(resend, /if \(!secret\) return true/)
  assert.match(resend, /> 300/)
  assert.match(resend, /invalid signature[\s\S]*status: 401/)
})
