import { test, expect } from '@playwright/test'

const userEmail = process.env.PRODUCTION_SMOKE_USER_EMAIL
const userPassword = process.env.PRODUCTION_SMOKE_USER_PASSWORD
const adminEmail = process.env.PRODUCTION_SMOKE_ADMIN_EMAIL
const adminPassword = process.env.PRODUCTION_SMOKE_ADMIN_PASSWORD

async function loginBlog(page, email, password) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click()
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 20_000 })
}

test('domínios oficiais entregam Home, login e asset essencial', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('body')).toContainText('A Vida Não Colabora')
  const hero = page.locator('img[src="/images/home/hero-mockup-person.webp"]')
  await expect(hero).toBeVisible()
  await expect.poll(() => hero.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)

  const heroResponse = await request.get('/images/home/hero-mockup-person.webp')
  expect(heroResponse.status()).toBe(200)
  expect(heroResponse.headers()['content-type'] ?? '').toMatch(/^image\//)
  expect((await heroResponse.body()).byteLength).toBeGreaterThan(1_000)

  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()

  const canonical = await request.get('https://www.avidanaocolabora.com/', { maxRedirects: 5 })
  expect(canonical.ok()).toBe(true)
})

test('usuário temporário acessa uma página autenticada em produção', async ({ page }) => {
  expect(userEmail, 'PRODUCTION_SMOKE_USER_EMAIL ausente').toBeTruthy()
  expect(userPassword, 'PRODUCTION_SMOKE_USER_PASSWORD ausente').toBeTruthy()
  await loginBlog(page, userEmail, userPassword)
  await page.goto('/diario')
  await expect(page).toHaveURL(/\/diario$/)
  await expect(page.locator('body')).not.toContainText('Missing Supabase environment variables')
  await expect(page.locator('body')).not.toContainText('Cuidar da mente começa por se escutar')
})

test('conta admin temporária chega ao gate MFA obrigatório', async ({ page }) => {
  expect(adminEmail, 'PRODUCTION_SMOKE_ADMIN_EMAIL ausente').toBeTruthy()
  expect(adminPassword, 'PRODUCTION_SMOKE_ADMIN_PASSWORD ausente').toBeTruthy()
  await page.goto('/admin')
  await page.locator('input[type="email"]').fill(adminEmail)
  await page.locator('input[type="password"]').fill(adminPassword)
  await page.getByRole('button', { name: 'Entrar no painel' }).click()
  await expect(page.getByRole('heading', { name: 'Verificação em duas etapas' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/exige senha \+ código TOTP/i)).toBeVisible()
})
