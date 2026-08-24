// Regras de negócio por plano e superfícies administrativas/internas que
// ainda não tinham cobertura local: gating de conteúdo por plano (RLS +
// teaser público), limite mensal do diário no Gratuito, RPCs administrativas
// negadas a não-admin, e autenticação interna dos crons (Edge Functions).

import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const required = ['E2E_SUPABASE_URL', 'E2E_SUPABASE_ANON_KEY', 'E2E_SUPABASE_SERVICE_ROLE_KEY', 'E2E_DOCKER_BIN', 'LOCAL_FUNCTIONS_URL']
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`)

const admin = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const password = `PlanRules-${randomUUID()}-Aa1!`

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function psql(sql) {
  return execFileSync(process.env.E2E_DOCKER_BIN, [
    'exec', 'supabase_db_local-e2e', 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-v', 'ON_ERROR_STOP=1',
    '-c', sql,
  ], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
}

async function makeUser(label, plan) {
  const email = `plan-rules-${label}-${randomUUID().slice(0, 8)}@local.test`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(error?.message ?? `Could not create ${label}`)
  const id = data.user.id
  psql(`UPDATE public.profiles SET plan = '${plan}', subscription_status = 'active' WHERE user_id = '${id}'::uuid`)
  const { data: session, error: signInError } = await admin.auth.signInWithPassword({ email, password })
  if (signInError || !session.session) throw new Error(signInError?.message ?? `Could not sign in ${label}`)
  const client = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { id, email, client, accessToken: session.session.access_token }
}

const users = {}
const articleIds = {}
const diaryIds = []

try {
  users.free = await makeUser('free', 'free')
  users.essential = await makeUser('essential', 'essential')
  users.plus = await makeUser('plus', 'plus')

  // ---- 1. Gating de conteúdo por plano -----------------------------------
  for (const plan of ['free', 'essential', 'plus']) {
    const slug = `e2e-plan-rules-${plan}-${randomUUID().slice(0, 8)}`
    articleIds[plan] = psql(`INSERT INTO public.articles (title, slug, plan_required, status, content) VALUES ('Artigo temporário ${plan}', '${slug}', '${plan}', 'published', 'Conteúdo completo apenas para quem tem acesso.') RETURNING id`)
    articleIds[`${plan}_slug`] = slug
  }

  const freeReadsFree = await users.free.client.from('articles').select('id').eq('id', articleIds.free)
  assert(!freeReadsFree.error && freeReadsFree.data?.length === 1, 'free user must read a free article')
  const freeReadsEssential = await users.free.client.from('articles').select('id').eq('id', articleIds.essential)
  assert(!freeReadsEssential.error && freeReadsEssential.data?.length === 0, 'free user must not read an essential article directly')
  const freeReadsPlus = await users.free.client.from('articles').select('id').eq('id', articleIds.plus)
  assert(!freeReadsPlus.error && freeReadsPlus.data?.length === 0, 'free user must not read a plus article directly')

  const freeTeaser = await users.free.client.rpc('get_article_teaser', { p_slug: articleIds.essential_slug })
  assert(!freeTeaser.error && freeTeaser.data?.[0]?.title === 'Artigo temporário essential', `free user must still see the teaser metadata of a gated article: ${freeTeaser.error?.message}`)
  assert(freeTeaser.data[0].content === undefined, 'teaser must never expose the full article content')

  const essentialReadsEssential = await users.essential.client.from('articles').select('id').eq('id', articleIds.essential)
  assert(!essentialReadsEssential.error && essentialReadsEssential.data?.length === 1, 'essential user must read an essential article')
  const essentialReadsPlus = await users.essential.client.from('articles').select('id').eq('id', articleIds.plus)
  assert(!essentialReadsPlus.error && essentialReadsPlus.data?.length === 0, 'essential user must not read a plus article')

  const plusReadsPlus = await users.plus.client.from('articles').select('id').eq('id', articleIds.plus)
  assert(!plusReadsPlus.error && plusReadsPlus.data?.length === 1, 'plus user must read a plus article')

  console.log('PASS gating de conteúdo: free só lê free (mas vê teaser de tudo); essential lê free+essential; plus lê tudo.')

  // ---- 2. Limite mensal do diário no Gratuito -----------------------------
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  for (let i = 0; i < 5; i++) {
    const date = new Date(monthStart)
    date.setUTCDate(date.getUTCDate() + i)
    const iso = date.toISOString().slice(0, 10)
    const inserted = await users.free.client.from('diary_entries').insert({ user_id: users.free.id, date: iso, text: `Registro ${i + 1}`, entry_type: 'diary' }).select('id').single()
    assert(!inserted.error, `entrada ${i + 1}/5 dentro do limite deveria passar: ${inserted.error?.message}`)
    diaryIds.push(inserted.data.id)
  }
  const sixthDate = new Date(monthStart)
  sixthDate.setUTCDate(sixthDate.getUTCDate() + 5)
  const sixth = await users.free.client.from('diary_entries').insert({ user_id: users.free.id, date: sixthDate.toISOString().slice(0, 10), text: 'Sexto registro', entry_type: 'diary' })
  assert(Boolean(sixth.error), 'BUG: o 6º registro básico do mês deveria ser bloqueado para o plano Gratuito')
  assert(/limite de 5 registros/i.test(sixth.error?.message ?? ''), `mensagem de erro inesperada: ${sixth.error?.message}`)
  console.log('PASS limite do diário: 5 registros básicos passam, o 6º é bloqueado com a mensagem esperada.')

  // ---- 3. RPCs administrativas negadas a não-admin ------------------------
  const freeEngagement = await users.free.client.rpc('get_user_engagement')
  assert(Boolean(freeEngagement.error), 'usuário comum não deveria conseguir chamar get_user_engagement')
  assert(/restrit[oa] a administradores/i.test(freeEngagement.error?.message ?? ''), `mensagem de erro inesperada: ${freeEngagement.error?.message}`)

  const freeEmailStats = await users.free.client.rpc('get_email_stats')
  assert(Boolean(freeEmailStats.error), 'usuário comum não deveria conseguir chamar get_email_stats')

  // profiles.role = 'admin' sozinho não basta: is_admin() também exige aal2
  // (sessão com MFA verificado). Isso reforça a negação mesmo pra quem tem
  // o cargo, sem verificação de dois fatores.
  // Promove users.free a role='admin' só pra provar que role sozinho não
  // basta (is_admin() também exige aal2/MFA verificado). Não reverte depois
  // — um UPDATE de volta pra 'user' esbarraria no trigger
  // prevent_last_admin_removal() se este for o único admin local; o cleanup
  // final apaga o usuário inteiro (DELETE, que não passa por esse trigger de
  // UPDATE). Por isso o teste 4 usa um usuário à parte (users.essential, que
  // nunca foi promovido) para representar "usuário comum".
  psql(`UPDATE public.profiles SET role = 'admin' WHERE user_id = '${users.free.id}'::uuid`)
  const roleOnlyEngagement = await users.free.client.rpc('get_user_engagement')
  assert(Boolean(roleOnlyEngagement.error), 'role=admin sem aal2 (MFA) não deveria bastar para passar por is_admin()')
  console.log('PASS RPCs administrativas: negadas a usuário comum e a role=admin sem MFA verificado (is_admin() exige aal2).')

  // ---- 4. Autenticação interna dos crons ----------------------------------
  const cronFunctions = ['run-automations', 'run-emotional-automations', 'run-lifecycle-emails']
  for (const fn of cronFunctions) {
    const noAuth = await fetch(`${process.env.LOCAL_FUNCTIONS_URL}/${fn}`, { method: 'POST' })
    assert(noAuth.status === 401, `${fn} sem Authorization deveria retornar 401, obteve ${noAuth.status}`)

    const forged = await fetch(`${process.env.LOCAL_FUNCTIONS_URL}/${fn}`, { method: 'POST', headers: { Authorization: 'Bearer token-forjado-nao-existe' } })
    assert(forged.status === 401, `${fn} com token forjado deveria retornar 401, obteve ${forged.status}`)

    const asRegularUser = await fetch(`${process.env.LOCAL_FUNCTIONS_URL}/${fn}`, { method: 'POST', headers: { Authorization: `Bearer ${users.essential.accessToken}` } })
    assert(asRegularUser.status === 401, `${fn} com JWT de usuário comum deveria retornar 401, obteve ${asRegularUser.status}`)
  }
  console.log('PASS autenticação dos crons: run-automations, run-emotional-automations e run-lifecycle-emails rejeitam chamada sem token, com token forjado e com JWT de usuário comum (401).')

  console.log('\nOK: gating de conteúdo, limite do diário, RPCs administrativas e autenticação dos crons passaram.')
} finally {
  for (const id of diaryIds) psql(`DELETE FROM public.diary_entries WHERE id = '${id}'::uuid`)
  for (const plan of ['free', 'essential', 'plus']) if (articleIds[plan]) psql(`DELETE FROM public.articles WHERE id = '${articleIds[plan]}'::uuid`)
  await Promise.all(Object.values(users).map((u) => admin.auth.admin.deleteUser(u.id)))
}
