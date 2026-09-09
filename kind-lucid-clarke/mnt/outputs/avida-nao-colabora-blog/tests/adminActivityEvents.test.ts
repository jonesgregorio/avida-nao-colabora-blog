import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const evMig = read('supabase/migrations/20260909160000_admin_activity_events.sql')
const planMig = read('supabase/migrations/20260909170000_admin_activity_plan_changes.sql')
const popup = read('src/components/admin/AdminActivityPopup.tsx')
const usersMig = read('supabase/migrations/20260909160500_admin_users_v2_new_signup_filters.sql')
const segMig = read('supabase/migrations/20260909161000_admin_segment_new_users.sql')
const tmplMig = read('supabase/migrations/20260909161500_admin_activity_email_templates.sql')
const webhook = read('supabase/functions/stripe-webhook/index.ts')

const lib = read('src/lib/adminActivityEvents.ts')
const bell = read('src/components/admin/AdminActivityAlerts.tsx')
const layout = read('src/components/admin/AdminLayout.tsx')
const usersServer = read('src/components/admin/adminUsersServer.ts')
const usersModel = read('src/components/admin/adminUsersModel.ts')
const usersOverview = read('src/components/admin/AdminUsersOverview.tsx')
const usersImpl = read('src/components/admin/AdminUsersImpl.tsx')
const segments = read('src/components/admin/AdminSegments.tsx')

// 1–4 · persistência + geração de eventos ------------------------------------
test('tabela admin_activity_events: campos mínimos, índices e RLS restritiva', () => {
  assert.match(evMig, /create table if not exists public\.admin_activity_events/)
  for (const col of ['event_type', 'user_id', 'title', 'message', 'metadata', 'source', 'source_event_id', 'idempotency_key', 'read_at', 'acknowledged_by']) {
    assert.match(evMig, new RegExp(`\\n\\s+${col}\\s`), `coluna ausente: ${col}`)
  }
  assert.match(evMig, /idempotency_key\s+text unique/)
  assert.match(evMig, /event_type\s+text not null/)
  assert.match(evMig, /idx_admin_activity_created/)
  assert.match(evMig, /idx_admin_activity_type/)
  assert.match(evMig, /idx_admin_activity_user/)
  assert.match(evMig, /idx_admin_activity_unread\s+on public\.admin_activity_events \(read_at\) where read_at is null/)
  assert.match(evMig, /alter table public\.admin_activity_events enable row level security/)
  // SELECT só admin; nenhuma policy de insert/update/delete
  assert.match(evMig, /for select\s*\n\s*to authenticated\s*\n\s*using \(public\.is_admin\(\)\)/)
  assert.doesNotMatch(evMig, /for (insert|update|delete)/i)
})

test('novo profile gera user_signup idempotente (trigger de banco, não frontend)', () => {
  assert.match(evMig, /create trigger trg_admin_activity_on_signup\s*\n\s*after insert on public\.profiles/)
  assert.match(evMig, /'user_signup'/)
  assert.match(evMig, /'user_signup:' \|\| new\.user_id::text/)
  assert.match(evMig, /on conflict \(idempotency_key\) do nothing/)
  // metadata só com dados administrativos
  assert.match(evMig, /'plan', v_plan/)
  assert.match(evMig, /'account_status'/)
})

test('nova assinatura nasce só de checkout_completed (sem duplicar subscription.created)', () => {
  assert.match(evMig, /create trigger trg_admin_activity_on_subscription\s*\n\s*after insert on public\.subscription_events/)
  assert.match(evMig, /if new\.event_type <> 'checkout_completed' then\s*\n\s*return new;/)
  assert.match(evMig, /'subscription_started:' \|\| v_sub_key/)
  assert.match(evMig, /v_sub_key text := coalesce\(nullif\(btrim\(new\.stripe_subscription_id\), ''\), new\.id::text\)/)
  // carimba a primeira ativação paga sem sobrescrever
  assert.match(evMig, /set first_paid_at = coalesce\(first_paid_at,/)
  assert.match(evMig, /add column if not exists first_paid_at timestamptz/, 'coluna first_paid_at ausente')
})

test('webhook alerta o admin por e-mail na nova assinatura (só ADMIN_ALERT_EMAIL)', () => {
  assert.match(webhook, /admin_new_subscription_alert/)
  assert.match(webhook, /Deno\.env\.get\('ADMIN_ALERT_EMAIL'\)/)
  assert.match(webhook, /`admin_new_sub:\$\{stripeSub\.id\}`/)
  assert.match(tmplMig, /'admin_new_subscription_alert'/)
  assert.match(tmplMig, /'admin_new_signup_alert'/)
})

// 5–6 · alert center + tempo real -------------------------------------------
test('RPCs do alert center são admin-only e cobrem contador / lista / marcar lido', () => {
  for (const fn of ['admin_activity_events_unread_count', 'admin_activity_events_list', 'admin_activity_events_mark_read', 'admin_activity_events_mark_all_read', 'admin_new_users_overview']) {
    assert.match(evMig, new RegExp(`create or replace function public\\.${fn}`), `RPC ausente: ${fn}`)
    assert.match(evMig, new RegExp(`grant execute on function public\\.${fn}`))
  }
  assert.match(evMig, /if not public\.is_admin\(\) then\s*\n\s*raise exception 'not authorized'/)
  // lista aceita filtros all | tipo | unread
  assert.match(evMig, /v_filter = 'unread' and e\.read_at is null/)
  assert.match(evMig, /e\.event_type = v_filter/)
})

test('AdminActivityAlerts: sino próprio, badge de não lidos, filtros, marcar lido, ver usuário, realtime', () => {
  assert.match(layout, /<AdminActivityAlerts onOpenUser=\{onOpenUser\} \/>/)
  assert.match(bell, /fetchActivityUnreadCount/)
  assert.match(bell, /subscribeActivityEvents/)
  assert.match(bell, /markAllActivityEventsRead/)
  assert.match(bell, /markActivityEventRead/)
  assert.match(bell, /Ver usuário/)
  assert.match(bell, /Marcar tudo/)
  // filtros: tudo / cadastros / assinaturas / não lidos
  assert.match(bell, /key: 'user_signup'/)
  assert.match(bell, /key: 'subscription_started'/)
  assert.match(bell, /key: 'unread'/)
  // "carregar mais"
  assert.match(bell, /Carregar mais/)
  // nome de canal ÚNICO por assinante — dois assinantes (sino + pop-up) não podem
  // colidir no mesmo tópico realtime (isso lança "cannot add postgres_changes
  // callbacks ... after subscribe()" e derruba o Admin).
  assert.match(lib, /\.channel\(`admin_activity_events:\$\{Math\.random\(\)/)
  assert.match(lib, /event: 'INSERT', schema: 'public', table: 'admin_activity_events'/)
  assert.doesNotMatch(lib, /\.channel\('admin_activity_events_stream'\)/)
})

// 7–8 · filtros e badges em Usuários --------------------------------------------
test('admin_list_users_v2 ganha filtros de cadastro e assinatura recente + campos de badge', () => {
  assert.match(usersMig, /drop function if exists public\.admin_list_users_v2\(integer, integer, text, text, text, text\)/)
  assert.match(usersMig, /p_signup_from timestamptz default null/)
  assert.match(usersMig, /p_signup_to timestamptz default null/)
  assert.match(usersMig, /p_subscribed_since text default null/)
  assert.match(usersMig, /\(p_signup_from is null or p\.created_at >= p_signup_from\)/)
  assert.match(usersMig, /v_sub = 'today' and p\.first_paid_at >= date_trunc\('day', now\(\)\)/)
  assert.match(usersMig, /\(p\.created_at >= now\(\) - interval '7 days'\) as is_new_user/)
  assert.match(usersMig, /is_recent_subscriber/)
  // server-side: nada de filtro client-side novo
  assert.match(usersServer, /p_signup_from: window\.from/)
  assert.match(usersServer, /p_subscribed_since:/)
  assert.match(usersModel, /is_new_user\?: boolean/)
  assert.match(usersModel, /is_recent_subscriber\?: boolean/)
})

test('lista de usuários mostra badges NOVO e NOVA ASSINATURA e selects de filtro', () => {
  assert.match(usersOverview, /u\.is_new_user && \(/)
  assert.match(usersOverview, /u\.is_recent_subscriber && \(/)
  assert.match(usersOverview, />\s*Novo\s*<\/span>|> Novo\b/)
  assert.match(usersOverview, /Nova assinatura/)
  assert.match(usersOverview, /Cadastro: últimos 7 dias/)
  assert.match(usersOverview, /Assinaram nos últimos 7 dias/)
  assert.match(usersImpl, /filterSignup/)
  assert.match(usersImpl, /filterSubscribed/)
  // CSV respeita os novos campos
  assert.match(usersModel, /Primeira assinatura/)
  assert.match(usersModel, /Assinante recente \(7d\)/)
})

// 9 · segmentação -------------------------------------------------------------
test('admin_segment_match filtra novos usuários, conversão e janela de assinatura', () => {
  assert.match(segMig, /recent_signup_days/)
  assert.match(segMig, /recent_subscription_days/)
  assert.match(segMig, /subscribed_from/)
  assert.match(segMig, /f\.j->>'converted' = 'converted'\s+and b\.first_paid_at is not null/)
  assert.match(segMig, /f\.j->>'converted' = 'not_converted' and b\.first_paid_at is null/)
})

test('AdminSegments tem atalhos rápidos que atualizam o filtro real', () => {
  assert.match(segments, /QUICK_SEGMENTS/)
  for (const label of ['Cadastrados hoje', 'Novos nos últimos 7 dias', 'Assinaram nos últimos 7 dias', 'Novos que ainda não assinaram', 'Novos que já converteram']) {
    assert.match(segments, new RegExp(label))
  }
  assert.match(segments, /onClick=\{\(\) => setFilter\(\{ tags_mode: 'any', \.\.\.q\.filter \}\)\}/)
  assert.match(segments, /if \(filter\.recent_signup_days != null\) f\.recent_signup_days/)
})

// 10 · cards + conversão ----------------------------------------------------
test('admin_new_users_overview agrega cards e taxa de conversão em SQL', () => {
  assert.match(evMig, /'new_users_today'/)
  assert.match(evMig, /'new_subs_7d'/)
  assert.match(evMig, /'conversion_30d', jsonb_build_object/)
  assert.match(evMig, /'rate', case when v_signups_30d > 0/)
  assert.match(evMig, /round\(\(v_converted_30d::numeric \/ v_signups_30d\) \* 100, 1\)/)
  assert.match(usersOverview, /Conversão 30d/)
  assert.match(usersOverview, /Assinaturas 7 dias/)
})

// mudanças de plano + pop-up bloqueante ---------------------------------------
test('trigger de subscription_events também emite upgrade / downgrade / cancelamento', () => {
  assert.match(planMig, /create or replace function public\.tg_admin_activity_on_subscription\(\)/)
  assert.match(planMig, /'checkout_completed', 'upgrade_confirmed', 'downgrade_completed', 'cancellation_completed'/)
  assert.match(planMig, /v_type := 'plan_upgraded'/)
  assert.match(planMig, /v_type := 'plan_downgraded'/)
  assert.match(planMig, /v_type := 'subscription_cancelled'/)
  // idempotência por evento do Stripe
  assert.match(planMig, /v_type \|\| ':' \|\| v_evt_key/)
  assert.match(planMig, /'subscription_started:' \|\| v_sub_key/)
  // only checkout carimba first_paid_at
  assert.match(planMig, /if new\.event_type = 'checkout_completed' then\s*\n\s*update public\.profiles\s*\n\s*set first_paid_at/)
})

test('AdminActivityPopup é bloqueante, cobre todos os tipos e só fecha no X ou OK', () => {
  const layout = read('src/components/admin/AdminLayout.tsx')
  assert.match(layout, /<AdminActivityPopup \/>/)
  for (const t of ['user_signup', 'subscription_started', 'plan_upgraded', 'plan_downgraded', 'subscription_cancelled']) {
    assert.match(popup, new RegExp(`'${t}'`), `tipo ausente do pop-up: ${t}`)
  }
  // consome eventos NÃO LIDOS via a mesma RPC admin
  assert.match(popup, /fetchActivityEvents\('unread', 50, 0\)/)
  // não fecha por clique fora: sem onClick no backdrop
  assert.match(popup, /className="fixed inset-0 z-\[100\][^"]*"\s*\n\s*role="dialog"/)
  assert.doesNotMatch(popup, /onClick=\{closeOnly\}[\s\S]{0,40}fixed inset-0/)
  // bloqueia Esc
  assert.match(popup, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\) \}/)
  // OK marca como lido; X (Fechar) só descarta na sessão
  assert.match(popup, /await Promise\.all\(ids\.map\(id => markActivityEventRead\(id\)\)\)/)
  assert.match(popup, /function closeOnly\(\) \{\s*\n\s*queue\.forEach\(ev => dismissedRef\.current\.add\(ev\.id\)\)/)
  // realtime + poll
  assert.match(popup, /subscribeActivityEvents/)
})

// 14 · segurança ----------------------------------------------------------------
test('nenhuma RPC nova exposta a anon; frontend não usa service role', () => {
  for (const fn of ['admin_activity_events_list(text, int, int)', 'admin_new_users_overview()', 'admin_activity_events_mark_all_read()']) {
    assert.match(evMig, new RegExp(`revoke all on function public\\.${fn.replace(/[()]/g, '\\$&').replace(/, /g, ', ')} from public, anon`))
  }
  assert.doesNotMatch(lib, /service_role|SERVICE_ROLE/)
  assert.doesNotMatch(bell, /service_role|SERVICE_ROLE/)
})
