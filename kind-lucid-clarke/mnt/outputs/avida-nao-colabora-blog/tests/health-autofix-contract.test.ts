import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const migration = readFileSync(
  join(here, '..', 'supabase', 'migrations', '20260822194942_harden_health_autofix_contract.sql'),
  'utf8',
)

test('auto-reparo de Saúde do Sistema não executa DDL nem recria policies', () => {
  assert.doesNotMatch(migration, /\b(?:CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+POLICY|DROP\s+POLICY)\b/i)
})

test('auto-reparo trata Suporte, Orientação e Notificações como não reparáveis automaticamente', () => {
  for (const key of ['db_support', 'db_guidance', 'db_notifications']) {
    assert.match(migration, new RegExp(`'${key}'`))
  }
  assert.doesNotMatch(migration, /tickets_own|users_own_guidance|notifications_own/i)
})

test('módulos legados não voltam pelo auto-reparo', () => {
  for (const key of ['db_trails', 'db_sessions', 'db_saved', 'db_reports']) {
    assert.match(migration, new RegExp(`'${key}'`))
  }
  assert.match(migration, /'fixed_count', 0/)
})
