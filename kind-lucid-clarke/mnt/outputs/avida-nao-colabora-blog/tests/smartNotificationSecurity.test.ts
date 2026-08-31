import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const hardening = readFileSync(new URL('../supabase/migrations/20260829184500_lock_weekly_focus_reflection_trigger_function.sql', import.meta.url), 'utf8')

test('função interna de notificação não fica executável por papéis expostos da API', () => {
  assert.match(hardening, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.enqueue_weekly_focus_reflection_notification\(\)/i)
  assert.match(hardening, /FROM\s+PUBLIC,\s*anon,\s*authenticated/i)
  assert.doesNotMatch(hardening, /GRANT\s+EXECUTE[\s\S]*(?:PUBLIC|anon|authenticated)/i)
})

test('hardening não altera trigger, relatório, foco ou conteúdo da notificação', () => {
  assert.doesNotMatch(hardening, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i)
  assert.doesNotMatch(hardening, /DROP\s+TRIGGER|CREATE\s+TRIGGER/i)
  assert.doesNotMatch(hardening, /UPDATE\s+(?:public\.)?(?:reports|user_weekly_focus|notifications)/i)
})
