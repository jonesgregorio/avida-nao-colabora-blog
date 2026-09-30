import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (path: string) => fs.readFileSync(new URL(path, root), 'utf8')
const migration = read('supabase/migrations/20260930234000_unified_human_action_center.sql')
const component = read('src/components/admin/AdminHumanActionCenter.tsx')
const dashboard = read('src/components/admin/AdminOperationalDashboard.tsx')
const operational = read('src/lib/adminOperationalStatus.ts')
const cancellations = read('src/components/admin/AdminCancellations.tsx')
const scheduleCancellation = read('supabase/functions/admin-schedule-cancellation/index.ts')

test('central unificada inclui todas as frentes que realmente dependem de ação humana', () => {
  for (const area of ['support','guidance','care','deliveries','reports','cancellations','incidents','editorial']) {
    assert.match(migration, new RegExp(`'${area}'`))
  }
  assert.match(migration, /requested_at \+ interval '24 hours'/)
  assert.match(migration, /status='review'/)
  assert.match(migration, /scheduled_at - interval '24 hours'/)
})

test('cancelamento continua pendente após e-mail e só conclui após decisão real', () => {
  assert.match(cancellations, /function needsDecision/)
  assert.match(cancellations, /Resposta enviada por e-mail\. O pedido continua pendente/)
  assert.doesNotMatch(cancellations, /admin_reply: reply\.trim\(\), admin_replied_at: now, admin_handled_at: now/)
  assert.match(scheduleCancellation, /admin_handled_at: now/)
  assert.match(scheduleCancellation, /admin_id: user\.id/)
  assert.match(migration, /status='pending_approval' or f\.stripe_sync_status='failed'/)
  assert.match(cancellations, /processar o pedido em até <strong>24 horas<\/strong>/)
})

test('rascunhos sem prazo não inflam mais a fila operacional', () => {
  assert.match(migration, /'notifications_draft',0/)
  assert.doesNotMatch(operational, /ACTION_QUEUE_KEYS[\s\S]{0,400}'notifications_draft'/)
  assert.match(component, /Rascunhos sem prazo e processos já automáticos ficam fora desta lista/)
})

test('incidentes transitórios têm grace period antes de virarem trabalho humano', () => {
  assert.match(migration, /interval '15 minutes'/)
  assert.match(migration, /interval '4 hours'/)
  assert.match(migration, /interval '24 hours'/)
  assert.match(migration, /campaigns_failed/)
  assert.match(migration, /Plano de Autocuidado com falha/)
})

test('fila tem filtros, ordenação operacional e paginação de 20 itens', () => {
  assert.match(component, /const PAGE_SIZE = 20/)
  for (const label of ['Atrasadas','Vencem hoje','Próximos 3 dias','Todas as áreas','Incidentes','Editorial']) {
    assert.match(component, new RegExp(label))
  }
  assert.match(component, /20 por página/)
  assert.match(migration, /when 'overdue' then 0 when 'today' then 1 when 'due_3d' then 2/)
  assert.match(migration, /when 'critical' then 0 when 'high' then 1 else 2/)
  assert.match(migration, /America\/Sao_Paulo/)
})

test('dashboard expõe vencimentos de hoje e novas áreas', () => {
  assert.match(dashboard, /due_today/)
  for (const label of ['Cancelamentos','Incidentes','Editorial']) assert.match(dashboard, new RegExp(label))
  assert.match(dashboard, /<AdminHumanActionCenter onNavigate=\{onNavigate\} \/>/)
})
