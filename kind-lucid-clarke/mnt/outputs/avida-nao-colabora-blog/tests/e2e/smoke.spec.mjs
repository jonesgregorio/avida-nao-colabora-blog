import { test, expect } from '@playwright/test'

const protectedRoutes = [
  '/diario',
  '/perfil',
  '/mapa-emocional',
  '/meu-relatorio',
  '/plano-de-autocuidado',
  '/guia-mensal',
]

test.beforeEach(async ({ page }) => {
  await page.route('https://e2e.supabase.co/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    const isRest = pathname.startsWith('/rest/v1/')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: isRest ? '[]' : '{}',
      headers: isRest ? { 'content-range': '0-0/0' } : undefined,
    })
  })
})

test('home pública renderiza sem sessão', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('http://127.0.0.1:4173/')
  await expect(page.locator('body')).toContainText('A Vida Não Colabora')
  await expect(page.locator('body')).not.toContainText('Missing Supabase environment variables')
})

test('rota de login renderiza o formulário de autenticação', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: /Cuidar da mente/i })).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('rotas privadas exigem autenticação', async ({ page }) => {
  for (const route of protectedRoutes) {
    await test.step(route, async () => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })
  }
})

test('rota legada removida é canonicalizada para a home', async ({ page }) => {
  await page.goto('/conquistas')
  await expect(page).toHaveURL('http://127.0.0.1:4173/')
  await expect(page.locator('body')).toContainText('A Vida Não Colabora')
})

test('rota inexistente não reaproveita navegação antiga', async ({ page }) => {
  await page.goto('/rota-inexistente-e2e')
  await expect(page).toHaveURL('http://127.0.0.1:4173/')
  await expect(page.locator('body')).toContainText('A Vida Não Colabora')
})
