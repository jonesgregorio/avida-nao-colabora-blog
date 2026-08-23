import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const required = ['E2E_SUPABASE_URL', 'E2E_SUPABASE_ANON_KEY', 'E2E_SUPABASE_SERVICE_ROLE_KEY']
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`)

const admin = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const password = `Security-${randomUUID()}-Aa1!`
const accounts = ['a', 'b'].map(label => ({ label, email: `security-${label}-${randomUUID().slice(0, 8)}@local.test` }))
let questionnaireId
let pendingConfirmationUserId
let supportTicketId

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  const confirmationClient = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const confirmationEmail = `confirmation-${randomUUID().slice(0, 8)}@local.test`
  const signup = await confirmationClient.auth.signUp({ email: confirmationEmail, password })
  assert(!signup.error && signup.data.user?.id, `email confirmation signup must succeed: ${signup.error?.message ?? 'no user returned'}`)
  assert(!signup.data.session, 'email confirmation must not issue a session before the user verifies the email')
  pendingConfirmationUserId = signup.data.user.id
  const prematureLogin = await confirmationClient.auth.signInWithPassword({ email: confirmationEmail, password })
  assert(Boolean(prematureLogin.error) || !prematureLogin.data.session, 'unconfirmed email must not sign in')

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

  const [first, second] = accounts
  const ownProfile = await first.client.from('profiles').select('user_id, plan').eq('user_id', first.id).maybeSingle()
  assert(!ownProfile.error && ownProfile.data?.user_id === first.id, 'own profile must be readable')

  const foreignProfile = await second.client.from('profiles').select('user_id').eq('user_id', first.id)
  assert(!foreignProfile.error && foreignProfile.data?.length === 0, 'another profile must not be readable')

  supportTicketId = execFileSync(process.env.E2E_DOCKER_BIN, [
    'exec', 'supabase_db_local-e2e', 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-v', 'ON_ERROR_STOP=1',
    '-c', `INSERT INTO public.support_tickets (user_id, subject, description) VALUES ('${first.id}'::uuid, 'Ticket temporário', 'Dados temporários da auditoria local.') RETURNING id`,
  ], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
  assert(Boolean(supportTicketId), 'could not create local support ticket')
  const ownTicket = await first.client.from('support_tickets').select('id,user_id').eq('id', supportTicketId).single()
  assert(!ownTicket.error && ownTicket.data?.user_id === first.id, 'owner must read own support ticket')
  const foreignTicket = await second.client.from('support_tickets').select('id').eq('id', supportTicketId)
  assert(!foreignTicket.error && foreignTicket.data?.length === 0, 'another support ticket must not be readable')
  const directTicketInsert = await first.client.from('support_tickets').insert({ user_id: first.id, subject: 'Tentativa direta', description: 'Deve passar somente pela função protegida.' })
  assert(Boolean(directTicketInsert.error), 'support tickets must not be created directly through the Data API')

  const created = await first.client.from('diary_entries').insert({ user_id: first.id, text: 'Registro temporário da auditoria local.', mood: 'neutro', entry_type: 'diary' }).select('id,user_id').single()
  assert(!created.error && created.data?.user_id === first.id, `owner must create own diary entry: ${created.error?.message ?? 'no row returned'}`)

  const foreignDiary = await second.client.from('diary_entries').select('id').eq('id', created.data.id)
  assert(!foreignDiary.error && foreignDiary.data?.length === 0, 'another diary entry must not be readable')

  const ownDiaryUpdate = await first.client.from('diary_entries').update({ text: 'Registro local atualizado.' }).eq('id', created.data.id).select('text').single()
  assert(!ownDiaryUpdate.error && ownDiaryUpdate.data?.text === 'Registro local atualizado.', 'owner must update own diary entry')
  const foreignDiaryUpdate = await second.client.from('diary_entries').update({ text: 'Tentativa bloqueada.' }).eq('id', created.data.id)
  assert(Boolean(foreignDiaryUpdate.error) || foreignDiaryUpdate.data === null, 'another user must not update a diary entry')

  const forgedDiary = await second.client.from('diary_entries').insert({ user_id: first.id, text: 'Tentativa bloqueada.', mood: 'neutro', entry_type: 'diary' })
  assert(Boolean(forgedDiary.error), 'another user must not create diary entries for someone else')

  const planEscalation = await first.client.from('profiles').update({ plan: 'plus' }).eq('user_id', first.id).select('plan')
  assert(Boolean(planEscalation.error) || planEscalation.data?.length === 0, 'a user must not change their commercial plan directly')

  const questionnaireSlug = `e2e-security-${randomUUID().slice(0, 8)}`
  questionnaireId = execFileSync(process.env.E2E_DOCKER_BIN, [
    'exec', 'supabase_db_local-e2e', 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-v', 'ON_ERROR_STOP=1',
    '-c', `INSERT INTO public.questionnaires (title, plan_required, active, status, slug) VALUES ('Questionário temporário', 'free', true, 'published', '${questionnaireSlug}') RETURNING id`,
  ], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
  assert(Boolean(questionnaireId), 'could not create local questionnaire')

  const ownResponse = await first.client.from('questionnaire_responses').insert({
    user_id: first.id,
    questionnaire_id: questionnaireId,
    answers: { answer: 'temporária' },
    score: 0,
  }).select('id,user_id').single()
  assert(!ownResponse.error && ownResponse.data?.user_id === first.id, `owner must create an eligible questionnaire response: ${ownResponse.error?.message ?? 'no row returned'}`)

  const foreignResponse = await second.client.from('questionnaire_responses').select('id').eq('id', ownResponse.data.id)
  assert(!foreignResponse.error && foreignResponse.data?.length === 0, 'another questionnaire response must not be readable')

  const ownResponseUpdate = await first.client.from('questionnaire_responses').update({ answers: { answer: 'atualizada' } }).eq('id', ownResponse.data.id).select('answers').single()
  assert(!ownResponseUpdate.error && ownResponseUpdate.data?.answers?.answer === 'atualizada', 'owner must update own questionnaire response')

  const forgedResponse = await second.client.from('questionnaire_responses').insert({
    user_id: first.id,
    questionnaire_id: questionnaireId,
    answers: {},
    score: 0,
  })
  assert(Boolean(forgedResponse.error), 'another user must not create questionnaire responses for someone else')

  console.log('RLS security audit passed: own profile/diary/questionnaire allowed; direct plan change and cross-account read/write denied.')
} finally {
  if (questionnaireId) execFileSync(process.env.E2E_DOCKER_BIN, ['exec', 'supabase_db_local-e2e', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM public.questionnaires WHERE id = '${questionnaireId}'::uuid`], { stdio: 'ignore' })
  if (pendingConfirmationUserId) await admin.auth.admin.deleteUser(pendingConfirmationUserId)
  await Promise.all(accounts.filter(account => account.id).map(account => admin.auth.admin.deleteUser(account.id)))
}
