import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260825200000_admin_cron_automations_status.sql')
const component = read('src/components/admin/AdminAutomationsHealth.tsx')
const area = read('src/components/admin/AdminAreaSistema.tsx')

// MISSÃO GERAL final (Parte 12): "Auditar TODOS os crons. Criar tabela no
// Admin: Automação / Última execução / Status / Duração / Erro." Existiam
// duas RPCs de healthcheck (editorial/emocional) que nenhuma tela chamava e
// cobriam só 2 dos 8 jobs.

test('RPC de status de automações exige admin e nunca expõe segredo', () => {
  assert.match(migration, /IF NOT public\.is_admin\(\) THEN\s*\n\s*RAISE EXCEPTION 'admin access required'/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_cron_automations_status\(\) FROM PUBLIC, anon/)
  // Só o motivo técnico de falha entra; nada de prompt/diário/token.
  assert.match(migration, /CASE WHEN d\.status = 'failed' THEN d\.return_message ELSE NULL END/)
})

test('RPC lista todos os cron jobs genericamente (um cron novo aparece sozinho)', () => {
  assert.match(migration, /FROM cron\.job j/)
  // Sem lista fixa de jobnames no WHERE — só ORDER BY.
  assert.doesNotMatch(migration, /WHERE j\.jobname (=|IN)/)
})

test('Admin tem aba Automações mostrando status/duração/erro reais + controle e histórico', () => {
  assert.match(area, /id: 'automacoes', label: 'Automações', Component: AdminAutomationsHealth/)
  assert.match(component, /get_cron_automations_status/)
  // Todos os campos continuam visíveis (layout de lista, não mais tabela).
  assert.match(component, /humanSchedule/)             // agendamento legível
  assert.match(component, /statusBadge/)               // status
  assert.match(component, /last_started_at/)           // última execução
  assert.match(component, /duration_seconds/)          // duração (no histórico)
  assert.match(component, /last_error|summary_30\.last_error/) // erro
  // Etapa 4: controle e histórico.
  assert.match(component, /admin_set_cron_active/)
  assert.match(component, /admin_cron_run_history/)
  assert.match(component, /logAdminAction\('config', next \? 'automation_resume' : 'automation_pause'/)
  assert.match(component, /window\.confirm\(/)
})
