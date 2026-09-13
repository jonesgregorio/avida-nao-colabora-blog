import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260913200000_consolidated_security_performance_hardening.sql', import.meta.url), 'utf8')

test('hardening não toca Diário nem Jardim', () => {
  assert.doesNotMatch(migration, /ALTER TABLE public\.diary_entries|CREATE POLICY .*diary_entries|garden_/i)
})

test('helpers internos do Admin não são executáveis por clientes autenticados', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_communication_targets\(text, text, uuid, uuid\) FROM PUBLIC, anon, authenticated/i)
  assert.match(migration, /admin_engagement_base\(\).*authenticated/i)
  assert.match(migration, /admin_segment_match\(jsonb\).*authenticated/i)
})

test('search_path e índices operacionais são endurecidos', () => {
  assert.match(migration, /admin_logs_block_mutation\(\).*SET search_path = public, pg_temp/i)
  assert.match(migration, /touch_updated_at\(\).*SET search_path = public, pg_temp/i)
  assert.match(migration, /idx_personalization_tasks_queue/)
  assert.match(migration, /idx_ticket_messages_ticket/)
  assert.match(migration, /idx_personalized_deliveries_user/)
})

test('índices duplicados conhecidos são removidos sem apagar constraints canônicas', () => {
  assert.match(migration, /DROP INDEX IF EXISTS public\.idx_articles_plan_required/)
  assert.match(migration, /DROP INDEX IF EXISTS public\.idx_mgr_user_month/)
  assert.match(migration, /DROP INDEX IF EXISTS public\.monthly_guidance_requests_unique_month/)
  assert.match(migration, /DROP INDEX IF EXISTS public\.idx_saved_user/)
  assert.doesNotMatch(migration, /DROP INDEX.*monthly_guidance_requests_user_id_month_key_key/i)
})

test('RLS usa auth uid como initplan nas superfícies quentes', () => {
  const occurrences = migration.match(/\(SELECT auth\.uid\(\)\)/g) ?? []
  assert.ok(occurrences.length >= 10)
  assert.match(migration, /care_plan_action_state_own/)
  assert.match(migration, /guided_progress_own/)
  assert.match(migration, /notifications_own_read/)
  assert.match(migration, /users_view_own_tasks/)
  assert.match(migration, /users_select_own_ticket_messages/)
})

test('políticas Admin redundantes são consolidadas', () => {
  assert.match(migration, /DROP POLICY IF EXISTS "admin_all_notifications"/)
  assert.match(migration, /DROP POLICY IF EXISTS "notifications_admin"/)
  assert.match(migration, /DROP POLICY IF EXISTS "admin_all_tickets"/)
  assert.match(migration, /DROP POLICY IF EXISTS "admin_all_messages"/)
})
