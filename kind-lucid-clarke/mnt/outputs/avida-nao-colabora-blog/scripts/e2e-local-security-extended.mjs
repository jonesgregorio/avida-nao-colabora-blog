// Auditoria de RLS (isolamento entre usuários) para tabelas sensíveis que o
// e2e-local-security.mjs original não cobre: notifications, user_subscriptions,
// saved_items, monthly_reports, monthly_care_plans, monthly_guidance_requests
// e self_care_plan_reviews. Mesmo padrão: dois usuários (A e B), A só acessa
// o que é dele, B nunca acessa nem forja dados de A.
//
// monthly_care_plans, monthly_guidance_requests e self_care_plan_reviews só
// liberam leitura própria para plano Plus ativo — por isso o usuário A é
// promovido a plus/active antes dos testes dessas tabelas.

import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const required = ['E2E_SUPABASE_URL', 'E2E_SUPABASE_ANON_KEY', 'E2E_SUPABASE_SERVICE_ROLE_KEY', 'E2E_DOCKER_BIN']
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`)

const admin = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const password = `SecurityExt-${randomUUID()}-Aa1!`
const accounts = ['a', 'b'].map((label) => ({ label, email: `security-ext-${label}-${randomUUID().slice(0, 8)}@local.test` }))

const seededIds = { notifications: null, user_subscriptions: null, monthly_reports: null, monthly_care_plans: null, monthly_guidance_requests: null, self_care_plan_reviews: null }

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function psql(sql) {
  // "-t -A" ainda deixa passar a tag de conclusão ("INSERT 0 1") numa linha
  // extra em alguns builds do psql quando o comando usa RETURNING; pegar só
  // a primeira linha isola o valor retornado.
  return execFileSync(process.env.E2E_DOCKER_BIN, [
    'exec', 'supabase_db_local-e2e', 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-v', 'ON_ERROR_STOP=1',
    '-c', sql,
  ], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
}

try {
  for (const account of accounts) {
    const { data, error } = await admin.auth.admin.createUser({ email: account.email, password, email_confirm: true })
    if (error || !data.user) throw new Error(error?.message ?? `Could not create ${account.label}`)
    account.id = data.user.id
    const { data: session, error: signInError } = await admin.auth.signInWithPassword({ email: account.email, password })
    if (signInError || !session.session) throw new Error(signInError?.message ?? `Could not sign in ${account.label}`)
    account.client = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  const [a, b] = accounts

  // Promove A a plus/active: exigido pelas policies de leitura própria de
  // monthly_care_plans, monthly_guidance_requests e self_care_plan_reviews.
  psql(`UPDATE public.profiles SET plan = 'plus', subscription_status = 'active' WHERE user_id = '${a.id}'::uuid`)

  // ---- notifications ----------------------------------------------------
  seededIds.notifications = psql(`INSERT INTO public.notifications (user_id, title, body) VALUES ('${a.id}'::uuid, 'Notificação temporária', 'Auditoria local.') RETURNING id`)
  const ownNotif = await a.client.from('notifications').select('id,user_id').eq('id', seededIds.notifications).maybeSingle()
  assert(!ownNotif.error && ownNotif.data?.user_id === a.id, `owner must read own notification: ${ownNotif.error?.message ?? 'no row'}`)
  const foreignNotifRead = await b.client.from('notifications').select('id').eq('id', seededIds.notifications)
  assert(!foreignNotifRead.error && foreignNotifRead.data?.length === 0, 'another notification must not be readable')
  const ownNotifUpdate = await a.client.from('notifications').update({ is_read: true }).eq('id', seededIds.notifications).select('is_read').single()
  assert(!ownNotifUpdate.error && ownNotifUpdate.data?.is_read === true, 'owner must mark own notification as read')
  const foreignNotifUpdate = await b.client.from('notifications').update({ is_read: true }).eq('id', seededIds.notifications)
  assert(Boolean(foreignNotifUpdate.error) || foreignNotifUpdate.data === null, 'another user must not update a notification')
  const directNotifInsert = await a.client.from('notifications').insert({ user_id: a.id, title: 'Forjada', body: 'x' })
  assert(Boolean(directNotifInsert.error), 'notifications must not be created directly through the Data API')
  console.log('PASS notifications: own read/update allowed; foreign read/update and direct insert denied.')

  // ---- user_subscriptions -------------------------------------------------
  seededIds.user_subscriptions = psql(`INSERT INTO public.user_subscriptions (user_id, plan_key, status) VALUES ('${a.id}'::uuid, 'essential', 'active') RETURNING id`)
  const ownSub = await a.client.from('user_subscriptions').select('id,user_id').eq('id', seededIds.user_subscriptions).maybeSingle()
  assert(!ownSub.error && ownSub.data?.user_id === a.id, `owner must read own subscription: ${ownSub.error?.message ?? 'no row'}`)
  const foreignSubRead = await b.client.from('user_subscriptions').select('id').eq('id', seededIds.user_subscriptions)
  assert(!foreignSubRead.error && foreignSubRead.data?.length === 0, 'another subscription must not be readable')
  const directSubUpdate = await a.client.from('user_subscriptions').update({ plan_key: 'plus' }).eq('id', seededIds.user_subscriptions)
  assert(Boolean(directSubUpdate.error) || directSubUpdate.data === null, 'a user must not change their own subscription directly (only the Stripe webhook may)')
  console.log('PASS user_subscriptions: own read allowed; foreign read and direct write denied.')

  // ---- saved_items (única das sete com escrita própria pela Data API) ----
  const ownSavedItem = await a.client.from('saved_items').insert({ user_id: a.id, item_type: 'article', item_id: randomUUID(), title: 'Item temporário' }).select('id,user_id').single()
  assert(!ownSavedItem.error && ownSavedItem.data?.user_id === a.id, `owner must create own saved item: ${ownSavedItem.error?.message ?? 'no row'}`)
  const foreignSavedRead = await b.client.from('saved_items').select('id').eq('id', ownSavedItem.data.id)
  assert(!foreignSavedRead.error && foreignSavedRead.data?.length === 0, 'another saved item must not be readable')
  const forgedSavedItem = await b.client.from('saved_items').insert({ user_id: a.id, item_type: 'article', item_id: randomUUID() })
  assert(Boolean(forgedSavedItem.error), 'another user must not create saved items for someone else')
  const ownSavedDelete = await a.client.from('saved_items').delete().eq('id', ownSavedItem.data.id).select('id')
  assert(!ownSavedDelete.error && ownSavedDelete.data?.length === 1, 'owner must delete own saved item')
  console.log('PASS saved_items: own create/read/delete allowed; foreign read and forged insert denied.')

  // ---- monthly_reports ----------------------------------------------------
  seededIds.monthly_reports = psql(`INSERT INTO public.monthly_reports (user_id, month_key, title) VALUES ('${a.id}'::uuid, to_char(now(), 'YYYY-MM'), 'Relatório temporário') RETURNING id`)
  const ownReport = await a.client.from('monthly_reports').select('id,user_id').eq('id', seededIds.monthly_reports).maybeSingle()
  assert(!ownReport.error && ownReport.data?.user_id === a.id, `owner must read own monthly report: ${ownReport.error?.message ?? 'no row'}`)
  const foreignReportRead = await b.client.from('monthly_reports').select('id').eq('id', seededIds.monthly_reports)
  assert(!foreignReportRead.error && foreignReportRead.data?.length === 0, 'another monthly report must not be readable')
  const forgedReport = await b.client.from('monthly_reports').insert({ user_id: a.id, month_key: '2000-01', title: 'Forjado' })
  assert(Boolean(forgedReport.error), 'another user must not create a monthly report for someone else')
  console.log('PASS monthly_reports: own read allowed; foreign read and forged insert denied.')

  // ---- monthly_care_plans (exige plus/active; status='sent' pra liberar leitura própria) ---
  seededIds.monthly_care_plans = psql(`INSERT INTO public.monthly_care_plans (user_id, month_reference, period_start, period_end, available_at, status) VALUES ('${a.id}'::uuid, date_trunc('month', now())::date, date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date, date_trunc('month', now())::date, 'sent') RETURNING id`)
  const ownCarePlan = await a.client.from('monthly_care_plans').select('id,user_id').eq('id', seededIds.monthly_care_plans).maybeSingle()
  assert(!ownCarePlan.error && ownCarePlan.data?.user_id === a.id, `plus owner must read own sent care plan: ${ownCarePlan.error?.message ?? 'no row'}`)
  const foreignCarePlanRead = await b.client.from('monthly_care_plans').select('id').eq('id', seededIds.monthly_care_plans)
  assert(!foreignCarePlanRead.error && foreignCarePlanRead.data?.length === 0, 'another monthly care plan must not be readable')
  console.log('PASS monthly_care_plans: own read allowed for plus/active (status=sent); foreign read denied.')

  // ---- monthly_guidance_requests (exige plus/active; janela de criação real
  // depende do dia do mês, então só auditamos isolamento, seedando via psql) ---
  seededIds.monthly_guidance_requests = psql(`INSERT INTO public.monthly_guidance_requests (user_id, month_key, message, status) VALUES ('${a.id}'::uuid, to_char(now(), 'YYYY-MM'), 'Mensagem temporária', 'open') RETURNING id`)
  const ownGuidance = await a.client.from('monthly_guidance_requests').select('id,user_id').eq('id', seededIds.monthly_guidance_requests).maybeSingle()
  assert(!ownGuidance.error && ownGuidance.data?.user_id === a.id, `plus owner must read own guidance request: ${ownGuidance.error?.message ?? 'no row'}`)
  const foreignGuidanceRead = await b.client.from('monthly_guidance_requests').select('id').eq('id', seededIds.monthly_guidance_requests)
  assert(!foreignGuidanceRead.error && foreignGuidanceRead.data?.length === 0, 'another guidance request must not be readable')
  const forgedGuidance = await a.client.from('monthly_guidance_requests').insert({ user_id: b.id, month_key: to_char_now(), message: 'Forjada' })
  assert(Boolean(forgedGuidance.error), 'a user must not create a guidance request in someone else\'s name')
  console.log('PASS monthly_guidance_requests: own read allowed for plus/active; foreign read and impersonated insert denied.')

  // ---- self_care_plan_reviews (exige plano plus) --------------------------
  seededIds.self_care_plan_reviews = psql(`INSERT INTO public.self_care_plan_reviews (user_id, review_month, summary) VALUES ('${a.id}'::uuid, to_char(now(), 'YYYY-MM'), 'Resumo temporário') RETURNING id`)
  const ownReview = await a.client.from('self_care_plan_reviews').select('id,user_id').eq('id', seededIds.self_care_plan_reviews).maybeSingle()
  assert(!ownReview.error && ownReview.data?.user_id === a.id, `plus owner must read own self-care review: ${ownReview.error?.message ?? 'no row'}`)
  const foreignReviewRead = await b.client.from('self_care_plan_reviews').select('id').eq('id', seededIds.self_care_plan_reviews)
  assert(!foreignReviewRead.error && foreignReviewRead.data?.length === 0, 'another self-care review must not be readable')
  console.log('PASS self_care_plan_reviews: own read allowed for plus; foreign read denied.')

  console.log('\nOK: RLS estendido passou — notifications, user_subscriptions, saved_items, monthly_reports, monthly_care_plans, monthly_guidance_requests, self_care_plan_reviews.')
} finally {
  if (seededIds.notifications) psql(`DELETE FROM public.notifications WHERE id = '${seededIds.notifications}'::uuid`)
  if (seededIds.user_subscriptions) psql(`DELETE FROM public.user_subscriptions WHERE id = '${seededIds.user_subscriptions}'::uuid`)
  if (seededIds.monthly_reports) psql(`DELETE FROM public.monthly_reports WHERE id = '${seededIds.monthly_reports}'::uuid`)
  if (seededIds.monthly_care_plans) psql(`DELETE FROM public.monthly_care_plans WHERE id = '${seededIds.monthly_care_plans}'::uuid`)
  if (seededIds.monthly_guidance_requests) psql(`DELETE FROM public.monthly_guidance_requests WHERE id = '${seededIds.monthly_guidance_requests}'::uuid`)
  if (seededIds.self_care_plan_reviews) psql(`DELETE FROM public.self_care_plan_reviews WHERE id = '${seededIds.self_care_plan_reviews}'::uuid`)
  await Promise.all(accounts.filter((account) => account.id).map((account) => admin.auth.admin.deleteUser(account.id)))
}

function to_char_now() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
