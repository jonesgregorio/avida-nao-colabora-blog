import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('orientação usa mês anterior e janela de 1 a 10', () => {
  const page = read('src/components/MonthlyGuidancePage.tsx')
  assert.match(page, /REQUEST_WINDOW_END_DAY = 10/)
  assert.match(page, /new Date\(y, m - 1, 1\)/)
  assert.match(page, /request_origin: 'user'/)
  assert.match(page, /dias 1 a 10/)
})

test('servidor impõe mês fechado e preserva direito de ativação tardia no mês', () => {
  const migration = read('supabase/migrations/20260922193000_monthly_guidance_closed_month_cycle.sql')
  assert.match(migration, /interval '1 month'/)
  assert.match(migration, /between 1 and 10/)
  assert.match(migration, /coalesce\(p\.plan_activated_at, p\.created_at\)/)
  assert.match(migration, /request_origin = 'user'/)
})

test('admin pode buscar elegíveis e iniciar orientação proativamente', () => {
  const admin = read('src/components/admin/AdminGuidanceRequests.tsx')
  assert.match(admin, /Usuários elegíveis para orientação/)
  assert.match(admin, /startProactiveGuidance/)
  assert.match(admin, /request_origin: 'admin'/)
  assert.match(admin, /Criar orientação/)
})
