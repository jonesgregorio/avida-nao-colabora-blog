import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const hub = fs.readFileSync(new URL('../src/components/admin/AdminSelfCareHub.tsx', import.meta.url), 'utf8')
const area = fs.readFileSync(new URL('../src/components/admin/AdminAreaCuidado.tsx', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20260908214000_care_plan_readiness_enforcement.sql', import.meta.url), 'utf8')

test('admin care hub exposes usefulness and readiness rather than delivery only', () => {
  assert.match(hub, /admin_care_plan_dashboard/)
  assert.match(hub, /O plano está sendo útil ou só entregue\?/)
  assert.match(hub, /Com contexto suficiente/)
  assert.match(hub, /Sem contexto suficiente/)
  assert.match(hub, /Ações que ajudaram/)
  assert.match(hub, /Pedidos de adaptação/)
  assert.match(area, /AdminSelfCareHub/)
})

test('insufficient new cycles are skipped and generic content is not exposed', () => {
  assert.match(migration, /total_entries >= 12 AND active_days >= 8/)
  assert.match(migration, /NEW\.status := 'skipped'/)
  assert.match(migration, /NEW\.care_plan := '\{\}'::jsonb/)
  assert.match(migration, /insufficient_activity/)
  assert.match(migration, /Preferimos não criar um plano genérico/)
})

test('admin dashboard is protected and aggregated', () => {
  assert.match(migration, /IF NOT public\.is_admin\(\)/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_care_plan_dashboard/)
  assert.match(migration, /count\(\*\) FILTER \(WHERE s\.outcome='helped'\)/)
})
