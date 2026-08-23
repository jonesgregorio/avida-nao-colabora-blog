import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const required = ['E2E_SUPABASE_URL', 'E2E_SUPABASE_ANON_KEY', 'E2E_SUPABASE_SERVICE_ROLE_KEY', 'E2E_DOCKER_BIN']
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`)

const admin = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const password = `LocalBrowser-${randomUUID()}-Aa1!`
const accounts = ['free', 'essential', 'plus'].map(plan => ({ plan, email: `browser-${plan}-${randomUUID().slice(0, 8)}@local.test` }))

test.beforeAll(async () => {
  for (const account of accounts) {
    const { data, error } = await admin.auth.admin.createUser({ email: account.email, password, email_confirm: true })
    if (error || !data.user) throw new Error(error?.message ?? 'Could not create local E2E user')
    account.id = data.user.id
    execFileSync(process.env.E2E_DOCKER_BIN, ['exec', 'supabase_db_local-e2e', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `UPDATE public.profiles SET plan = '${account.plan}', subscription_status = 'active' WHERE user_id = '${account.id}'::uuid`], { stdio: 'ignore' })
  }
})

test.afterAll(async () => {
  await Promise.all(accounts.map(account => admin.auth.admin.deleteUser(account.id)))
})

for (const account of accounts) {
  test(`usuário ${account.plan} entra e abre rotas privadas`, async ({ page }) => {
    await page.goto('/login')
    await page.locator('#auth-email').fill(account.email)
    await page.locator('#auth-password').fill(password)
    await page.locator('form').getByRole('button', { name: /^Entrar$/ }).click()
    await expect(page.getByRole('navigation')).toContainText('Perfil')

    for (const route of ['/perfil', '/diario', '/meu-plano']) {
      await page.goto(route)
      await expect(page.getByRole('navigation')).toContainText('Perfil')
    }
  })
}
