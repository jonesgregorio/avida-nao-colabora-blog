import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260829183000_weekly_focus_reflection_notification.sql', import.meta.url), 'utf8')
const notificationLib = readFileSync(new URL('../src/lib/notifications.ts', import.meta.url), 'utf8')
const notificationPage = readFileSync(new URL('../src/components/NotificationsPage.tsx', import.meta.url), 'utf8')

test('reflexão do foco só nasce de relatório semanal fechado e foco ainda aberto', () => {
  assert.match(migration, /NEW\.report_type IS DISTINCT FROM 'weekly'/)
  assert.match(migration, /NEW\.status IS DISTINCT FROM 'generated'/)
  assert.match(migration, /focus\.status = 'active'/)
  assert.match(migration, /AFTER INSERT OR UPDATE OF status ON public\.reports/)
})

test('semana do foco é domingo-sábado mesmo quando o primeiro relatório foi cortado pela ativação', () => {
  assert.match(migration, /v_week_start := NEW\.period_end::date - 6/)
  assert.match(migration, /focus\.week_start = v_week_start/)
  assert.doesNotMatch(migration, /focus\.week_start = NEW\.period_start/)
})

test('convite é único, discreto e leva de volta para Hoje', () => {
  assert.match(migration, /weekly-focus-reflection:%s:%s/)
  assert.match(migration, /notification\.type = 'weekly_focus_reflection'/)
  assert.match(migration, /action_data[\s\S]*v_dedupe_key/)
  assert.match(migration, /'home',[\s\n\r]*'home',[\s\n\r]*'low'/)
  assert.match(migration, /reflexão opcional, não uma avaliação/i)
  assert.match(notificationLib, /weekly_focus_reflection: 'home'/)
})

test('notificação não fecha foco, não relê Diário e não cria canal de e-mail', () => {
  assert.doesNotMatch(migration, /UPDATE\s+public\.user_weekly_focus/i)
  assert.doesNotMatch(migration, /diary_entries/i)
  assert.doesNotMatch(migration, /send-transactional-email|send_email|automated_emails|user_notification_preferences/i)
})

test('central reconhece tipos reais já existentes além do novo convite', () => {
  for (const [type, destination] of [
    ['weekly_report', 'my-report'],
    ['self_care_plan', 'self-care'],
    ['monthly_guidance_ready', 'monthly-guidance'],
    ['new_content', 'articles'],
    ['diary_reminder', 'diary'],
    ['weekly_focus_reflection', 'home'],
  ]) {
    assert.match(notificationLib, new RegExp(`${type}: '${destination}'`))
    assert.match(notificationPage, new RegExp(`${type}:`))
  }
})

test('central apresenta retomada como utilidade e não como cobrança de presença', () => {
  assert.match(notificationPage, /convites úteis para retomar sua experiência/i)
  assert.doesNotMatch(notificationPage, /mantenha sua sequência|perdeu sua sequência|volte para não perder|ranking|recompensa|sementes/i)
})
