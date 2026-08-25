import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const lib = read('src/lib/personalizationTasks.ts')
const admin = read('src/components/admin/AdminPersonalization.tsx')
const runner = read('supabase/functions/run-automations/index.ts')

// §11 da MISSÃO GERAL: "nenhuma tarefa deve falhar em silêncio". A migration
// 20260824220000_personalization_task_failure_visibility.sql adicionou
// last_error/attempts/last_attempt_at e run-automations já as grava, mas nem
// o tipo TS nem a UI do Admin sabiam que essas colunas existiam.

test('PersonalizationTask declara last_error/attempts/last_attempt_at (o tipo não pode ignorar colunas reais)', () => {
  assert.match(lib, /last_error: string \| null/)
  assert.match(lib, /attempts: number/)
  assert.match(lib, /last_attempt_at: string \| null/)
})

test('run-automations continua gravando essas colunas a cada tentativa de personalização', () => {
  assert.match(runner, /attempts, last_error, last_attempt_at: new Date\(\)\.toISOString\(\)/)
})

test('Admin de Personalização mostra o motivo real da falha, não só "cancelada" sem explicação', () => {
  assert.match(admin, /task\.last_error/)
  assert.match(admin, /Falhas de IA/)
})
