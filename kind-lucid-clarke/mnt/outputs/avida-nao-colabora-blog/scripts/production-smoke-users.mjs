import { randomUUID } from 'node:crypto'
import { appendFile, readFile, rm, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const action = process.argv[2]
const projectRef = process.env.SUPABASE_PROJECT_REF || 'lejvvhzluggyxlfwfoxl'
const managementToken = process.env.SUPABASE_ACCESS_TOKEN
const statePath = '.production-smoke-users.json'

if (!['create', 'cleanup'].includes(action)) throw new Error('Uso: node scripts/production-smoke-users.mjs create|cleanup')
if (!managementToken) throw new Error('SUPABASE_ACCESS_TOKEN não configurado para o smoke de produção.')

async function serviceRoleKey() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
    headers: { Authorization: `Bearer ${managementToken}` },
  })
  if (!response.ok) throw new Error(`Management API retornou ${response.status} ao consultar chaves do projeto.`)
  const keys = await response.json()
  const row = keys.find((key) => key.name === 'service_role')
  if (!row?.api_key) throw new Error('Chave service_role não encontrada pela Management API.')
  return row.api_key
}

async function getAdminClient() {
  const key = await serviceRoleKey()
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${key}`)
  return createClient(`https://${projectRef}.supabase.co`, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function waitForProfile(client, userId, patch) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await client.from('profiles').update(patch).eq('user_id', userId).select('user_id')
    if (!error && data?.length) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Perfil ${userId} não ficou disponível para configuração.`)
}

async function create() {
  const client = await getAdminClient()
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const password = `Smoke-${randomUUID()}-Aa1!`
  const userEmail = `prod-smoke-user-${suffix}@example.com`
  const adminEmail = `prod-smoke-admin-${suffix}@example.com`
  const created = []

  try {
    for (const [kind, email] of [['user', userEmail], ['admin', adminEmail]]) {
      const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `Production Smoke ${kind}` },
      })
      if (error || !data.user) throw error ?? new Error(`Falha ao criar ${kind}`)
      created.push({ kind, id: data.user.id, email })
      await waitForProfile(client, data.user.id, kind === 'admin' ? { role: 'admin' } : { plan: 'free' })
    }

    await writeFile(statePath, JSON.stringify({ users: created }, null, 2), { mode: 0o600 })
    const envFile = process.env.GITHUB_ENV
    if (!envFile) throw new Error('GITHUB_ENV indisponível.')
    console.log(`::add-mask::${password}`)
    await appendFile(envFile, [
      `PRODUCTION_SMOKE_USER_EMAIL=${userEmail}`,
      `PRODUCTION_SMOKE_USER_PASSWORD=${password}`,
      `PRODUCTION_SMOKE_ADMIN_EMAIL=${adminEmail}`,
      `PRODUCTION_SMOKE_ADMIN_PASSWORD=${password}`,
      '',
    ].join('\n'))
    console.log('Usuários temporários do smoke de produção criados.')
  } catch (error) {
    for (const row of created) await client.auth.admin.deleteUser(row.id).catch(() => {})
    throw error
  }
}

async function cleanup() {
  let state
  try {
    state = JSON.parse(await readFile(statePath, 'utf8'))
  } catch {
    console.log('Nenhum estado de usuários temporários encontrado para limpeza.')
    return
  }
  const client = await getAdminClient()
  for (const row of state.users ?? []) {
    const { error } = await client.auth.admin.deleteUser(row.id)
    if (error) console.warn(`Não foi possível remover usuário temporário ${row.id}: ${error.message}`)
  }
  await rm(statePath, { force: true })
  console.log('Usuários temporários do smoke de produção removidos.')
}

if (action === 'create') await create()
else await cleanup()
