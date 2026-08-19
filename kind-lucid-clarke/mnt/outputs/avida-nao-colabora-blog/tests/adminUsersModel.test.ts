import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAdminUsersCsv,
  filterAdminUsers,
  resolveTabFilter,
  timeSince,
  type UserRow,
} from '../src/components/admin/adminUsersModel.ts'

function user(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'profile-1',
    user_id: 'user-1',
    full_name: 'Maria Silva',
    email: 'maria@example.com',
    plan: 'free',
    role: null,
    created_at: '2026-01-01T12:00:00.000Z',
    account_status: null,
    unlimited_access: false,
    unlimited_access_until: null,
    unlimited_access_reason: null,
    discount_percent: 0,
    discount_fixed: 0,
    admin_tags: [],
    open_tickets: 0,
    unread_notifs: 0,
    last_activity: null,
    ...overrides,
  }
}

test('filtro preserva busca por nome, e-mail e ID sem diferenciar maiúsculas', () => {
  const users = [user(), user({ id: 'profile-2', user_id: 'ABC-99', full_name: 'João Souza', email: 'joao@teste.com' })]

  assert.deepEqual(filterAdminUsers(users, { search: 'MARIA', plan: 'all', status: 'all', access: 'all' }).map(u => u.user_id), ['user-1'])
  assert.deepEqual(filterAdminUsers(users, { search: 'TESTE.COM', plan: 'all', status: 'all', access: 'all' }).map(u => u.user_id), ['ABC-99'])
  assert.deepEqual(filterAdminUsers(users, { search: 'abc-99', plan: 'all', status: 'all', access: 'all' }).map(u => u.user_id), ['ABC-99'])
})

test('filtro de Plus mantém compatibilidade com planos terapêuticos legados', () => {
  const users = [
    user({ id: '1', user_id: '1', plan: 'plus' }),
    user({ id: '2', user_id: '2', plan: 'therapeutic' }),
    user({ id: '3', user_id: '3', plan: 'therapeutic-plus' }),
    user({ id: '4', user_id: '4', plan: 'essential' }),
  ]

  assert.deepEqual(
    filterAdminUsers(users, { search: '', plan: 'plus', status: 'all', access: 'all' }).map(u => u.user_id),
    ['1', '2', '3'],
  )
})

test('filtros de status e acesso mantêm as regras existentes', () => {
  const users = [
    user({ id: 'active', user_id: 'active' }),
    user({ id: 'blocked', user_id: 'blocked', account_status: 'blocked' }),
    user({ id: 'discount', user_id: 'discount', discount_percent: 10 }),
    user({ id: 'unlimited', user_id: 'unlimited', unlimited_access: true }),
    user({ id: 'tickets', user_id: 'tickets', open_tickets: 2 }),
    user({ id: 'admin', user_id: 'admin', role: 'admin' }),
  ]

  assert.ok(filterAdminUsers(users, { search: '', plan: 'all', status: 'active', access: 'all' }).some(u => u.user_id === 'active'))
  assert.deepEqual(filterAdminUsers(users, { search: '', plan: 'all', status: 'blocked', access: 'all' }).map(u => u.user_id), ['blocked'])
  assert.deepEqual(filterAdminUsers(users, { search: '', plan: 'all', status: 'all', access: 'discount' }).map(u => u.user_id), ['discount'])
  assert.deepEqual(filterAdminUsers(users, { search: '', plan: 'all', status: 'all', access: 'unlimited' }).map(u => u.user_id), ['unlimited'])
  assert.deepEqual(filterAdminUsers(users, { search: '', plan: 'all', status: 'all', access: 'tickets' }).map(u => u.user_id), ['tickets'])
  assert.deepEqual(filterAdminUsers(users, { search: '', plan: 'all', status: 'all', access: 'admin' }).map(u => u.user_id), ['admin'])
})

test('abas rápidas continuam resolvendo para os mesmos filtros', () => {
  assert.deepEqual(resolveTabFilter('all'), { activeTab: 'all', filterPlan: 'all', filterStatus: 'all' })
  assert.deepEqual(resolveTabFilter('cancelled'), { activeTab: 'cancelled', filterPlan: 'all', filterStatus: 'cancelled' })
  assert.deepEqual(resolveTabFilter('essential'), { activeTab: 'essential', filterPlan: 'essential', filterStatus: 'all' })
})

test('timeSince pode ser validado deterministicamente', () => {
  const now = new Date('2026-08-19T12:00:00.000Z').getTime()
  assert.equal(timeSince('2026-08-18T12:00:00.000Z', now), 'há 1 dia')
  assert.equal(timeSince('2026-07-20T12:00:00.000Z', now), 'há 1 mês')
})

test('CSV mantém BOM e escapa vírgulas e aspas', () => {
  const csv = buildAdminUsersCsv([
    user({ full_name: 'Maria, "M"', email: 'maria@example.com', admin_tags: ['VIP', 'Beta tester'] }),
  ])

  assert.equal(csv.charCodeAt(0), 0xFEFF)
  assert.match(csv, /"Maria, ""M"""/)
  assert.match(csv, /"VIP; Beta tester"/)
})
