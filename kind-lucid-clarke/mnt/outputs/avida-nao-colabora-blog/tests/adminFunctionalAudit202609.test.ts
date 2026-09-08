import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin shell has functional global search and operational alerts', () => {
  const src = read('src/components/admin/AdminLayout.tsx')
  assert.match(src, /const SEARCH_ITEMS:/)
  assert.match(src, /searchQuery/)
  assert.match(src, /loadAlerts\(/)
  assert.match(src, /toggleAlerts/)
  assert.match(src, /admin_queues_overview/)
  assert.doesNotMatch(src, /<input className="admin-search" placeholder="Buscar no admin\.\.\."/)
})

test('dashboard uses active failures and real health checks', () => {
  const src = read('src/components/admin/AdminOverview.tsx')
  // Fonte única de status operacional (adminOperationalStatus) em vez de
  // reimplementar a regra de "pendência" no componente.
  assert.match(src, /fetchOperationalSnapshot|adminOperationalStatus/)
  assert.match(src, /failuresActive/)
  const shared = read('src/lib/adminOperationalStatus.ts')
  assert.match(shared, /failures_active/)
  assert.match(src, /checkSupabaseConnection\(\)/)
  assert.match(src, /checkTransactionalEmail\(\)/)
  assert.match(src, /checkPayments\(\)/)
  assert.match(src, /checkAI\(\)/)
  assert.match(src, /checkStorage\(\)/)
  assert.match(src, /admin-sistema-tab', 'filas'/)
  assert.doesNotMatch(src, /setDbOk\(true\)/)
})

test('storage health check is non-destructive', () => {
  const src = read('src/lib/adminHealthExtras.ts')
  assert.match(src, /storage\.from\('media'\)\.list/)
  assert.doesNotMatch(src, /\.upload\(/)
  assert.doesNotMatch(src, /\.remove\(/)
})

test('system health exposes storage and transactional email', () => {
  const src = read('src/components/admin/AdminSystemHealthFriendly.tsx')
  assert.match(src, /checkStorage\(\)/)
  assert.match(src, /checkTransactionalEmail\(\)/)
  assert.match(src, /storage_media/)
  assert.match(src, /email_fn/)
})

test('queue overview distinguishes active incidents from historical failures', () => {
  const migration = read('supabase/migrations/20260908173000_admin_active_failures.sql')
  assert.match(migration, /'failures_active'/)
  assert.match(migration, /latest_ai/)
  assert.match(migration, /latest_email/)
  assert.match(migration, /order by coalesce\(content_type, 'generic'\), created_at desc/)

  const ui = read('src/components/admin/AdminQueuesFailures.tsx')
  assert.match(ui, /failures_active/)
  assert.match(ui, /Falhas ativas/)
})

test('manual notification destinations remain compatible with user navigation', () => {
  const admin = read('src/components/admin/AdminNotifications.tsx')
  const notifications = read('src/lib/notifications.ts')
  const page = read('src/components/NotificationsPage.tsx')
  const app = read('src/App.tsx')

  assert.match(admin, /destination_path: actionView/)
  assert.match(page, /resolveNotifDestination/)
  for (const token of ['diary', 'questionarios', 'articles', 'my-report', 'self-care', 'monthly-guidance', 'my-plan', 'support', 'notifications']) {
    assert.ok(app.includes(`'${token}'`), `App navigation should support ${token}`)
  }
  assert.match(notifications, /self_care_review: 'self-care'/)
  assert.match(notifications, /monthly_report:\s+'my-report'/)
})
