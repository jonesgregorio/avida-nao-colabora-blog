import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const url = process.env.E2E_SUPABASE_URL
const anonKey = process.env.E2E_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
const dockerBin = process.env.E2E_DOCKER_BIN
const databaseContainer = process.env.E2E_DATABASE_CONTAINER ?? 'supabase_db_local-e2e'

if (!url || !anonKey || !serviceRoleKey || !dockerBin) {
  throw new Error('Local E2E Supabase credentials are required.')
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const suffix = randomUUID().slice(0, 8)
const password = `LocalE2E-${randomUUID()}-Aa1!`
const cases = [
  { label: 'free', plan: 'free' },
  { label: 'essential', plan: 'essential' },
  { label: 'plus', plan: 'plus' },
]
const createdUserIds = []

try {
  for (const current of cases) {
    const email = `e2e-${current.label}-${suffix}@local.test`
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError) throw new Error(`Could not create ${current.label}: ${createError.message}`)
    const userId = created.user?.id
    if (!userId) throw new Error(`No user ID returned for ${current.label}`)
    createdUserIds.push(userId)

    // O app não concede escrita administrativa direta nessa tabela via API.
    // Para este teste local, o seed é executado no Postgres isolado do Docker.
    execFileSync(dockerBin, [
      'exec', databaseContainer, 'psql', '-U', 'postgres', '-d', 'postgres',
      '-v', 'ON_ERROR_STOP=1', '-c',
      `UPDATE public.profiles SET plan = '${current.plan}', subscription_status = 'active' WHERE user_id = '${userId}'::uuid`,
    ], { stdio: 'ignore' })

    const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError || signedIn.user?.id !== userId) {
      throw new Error(`Authentication failed for ${current.label}: ${signInError?.message ?? 'unexpected user'}`)
    }

    const { data: profile, error: readError } = await client
      .from('profiles')
      .select('user_id, plan')
      .eq('user_id', userId)
      .single()
    if (readError || profile?.plan !== current.plan) {
      throw new Error(`Profile access failed for ${current.label}: ${readError?.message ?? 'unexpected plan'}`)
    }
    await client.auth.signOut()
    console.log(`PASS ${current.label}: account creation, sign-in and own-profile access`)
  }
} finally {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) console.warn(`Cleanup failed for ${userId}: ${error.message}`)
  }
}
