import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260829183000_weekly_focus_reflection_notification.sql', import.meta.url), 'utf8')
const notificationPage = readFileSync(new URL('../src/components/NotificationsPage.tsx', import.meta.url), 'utf8')

test('reflexão do foco só nasce de relatório semanal fechado e foco ainda aberto', () => {
  assert.match(migration, /NEW\.report_type IS DISTINCT FROM 'weekly'/)
  assert.match(migration, /NEW\.status IS DISTINCT FROM 'generated'/)
  assert.match(migration, /OLD\.status = 'generated'/)
  assert.match(migration, /focus\.status = 'active'/)
  assert.match(migration, /AFTER INSERT OR UPDATE OF status ON public\.reports/)
})

test('semana do foco é domingo-sábado mesmo quando o primeiro relatório foi cortado pela ativação', () => {
  assert.match(migration, /v_week_start := NEW\.period_end::date - 6/)
  assert.match(migration, /focus\.week_start = v_week_start/)
  assert.doesNotMatch(migration, /focus\.week_start = NEW\.period_start/)
})

test('convite reutiliza reminder, é único, discreto e leva de volta para Hoje', () => {
  assert.match(migration, /weekly-focus-reflection:%s:%s/)
  assert.match(migration, /notification\.type = 'reminder'/)
  assert.match(migration, /'kind', 'weekly_focus_reflection'/)
  assert.match(migration, /'key', v_dedupe_key/)
  assert.match(migration, /'home',[\s\n\r]*'home',[\s\n\r]*'low'/)
  assert.match(migration, /reflexão opcional, não uma avaliação/i)
})

test('notificação não fecha foco, não relê Diário e não cria canal de e-mail', () => {
  assert.doesNotMatch(migration, /UPDATE\s+public\.user_weekly_focus/i)
  assert.doesNotMatch(migration, /diary_entries/i)
  assert.doesNotMatch(migration, /send-transactional-email|send_email|automated_emails|user_notification_preferences/i)
})

test('novo trigger não substitui nem remove o aviso de relatório já existente', () => {
  assert.doesNotMatch(migration, /DROP\s+TRIGGER\s+reports_notify_after_persist/i)
  assert.doesNotMatch(migration, /DROP\s+FUNCTION\s+.*notify_report_after_persist/i)
  assert.match(migration, /trg_weekly_focus_reflection_notification/)
})

test('central distingue o lembrete do foco pelo kind estruturado', () => {
  assert.match(notificationPage, /action_data\?: Record<string, unknown>/)
  assert.match(notificationPage, /reminder:\s+\{ Icon: NotebookPen/)
  assert.match(notificationPage, /n\.type === 'reminder' && n\.action_data\?\.kind === 'weekly_focus_reflection'/)
  assert.match(notificationPage, /WEEKLY_FOCUS_META/)
  assert.match(notificationPage, /weekly_report:\s+\{ Icon: BarChart3/)
})

test('central apresenta retomada como utilidade e não como cobrança de presença', () => {
  assert.match(notificationPage, /convites úteis para retomar sua experiência/i)
  assert.doesNotMatch(notificationPage, /mantenha sua sequência|perdeu sua sequência|volte para não perder|ranking|recompensa|sementes/i)
})
