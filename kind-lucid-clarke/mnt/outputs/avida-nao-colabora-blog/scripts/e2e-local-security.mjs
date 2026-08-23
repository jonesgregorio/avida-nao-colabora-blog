import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const required = ['E2E_SUPABASE_URL', 'E2E_SUPABASE_ANON_KEY', 'E2E_SUPABASE_SERVICE_ROLE_KEY']
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`)

const admin = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const password = `Security-${randomUUID()}-Aa1!`
const accounts = ['a', 'b'].map(label => ({ label, email: `security-${label}-${randomUUID().slice(0, 8)}@local.test` }))

function assert(condition, message) {
  if (!condition) throw new Error(message)
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

  const [first, second] = accounts
  const ownProfile = await first.client.from('profiles').select('user_id, plan').eq('user_id', first.id).maybeSingle()
  assert(!ownProfile.error && ownProfile.data?.user_id === first.id, 'own profile must be readable')

  const foreignProfile = await second.client.from('profiles').select('user_id').eq('user_id', first.id)
  assert(!foreignProfile.error && foreignProfile.data?.length === 0, 'another profile must not be readable')

  const created = await first.client.from('diary_entries').insert({ user_id: first.id, text: 'Registro temporário da auditoria local.', mood: 'neutro', entry_type: 'diary' }).select('id,user_id').single()
  assert(!created.error && created.data?.user_id === first.id, `owner must create own diary entry: ${created.error?.message ?? 'no row returned'}`)

  const foreignDiary = await second.client.from('diary_entries').select('id').eq('id', created.data.id)
  assert(!foreignDiary.error && foreignDiary.data?.length === 0, 'another diary entry must not be readable')

  const forgedDiary = await second.client.from('diary_entries').insert({ user_id: first.id, text: 'Tentativa bloqueada.', mood: 'neutro', entry_type: 'diary' })
  assert(Boolean(forgedDiary.error), 'another user must not create diary entries for someone else')

  console.log('RLS security audit passed: own profile/diary allowed; cross-account read/write denied.')
} finally {
  await Promise.all(accounts.filter(account => account.id).map(account => admin.auth.admin.deleteUser(account.id)))
}
