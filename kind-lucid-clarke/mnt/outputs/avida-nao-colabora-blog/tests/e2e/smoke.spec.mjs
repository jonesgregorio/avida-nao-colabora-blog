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

test('foto principal do hero carrega bytes válidos', async ({ page, request }) => {
  await page.goto('/')
  const hero = page.getByTestId('home-hero-image')
  await expect(hero).toBeVisible()
  await expect(hero).toHaveAttribute('src', '/images/home/hero-person-approved.webp')
  await expect.poll(
    () => hero.evaluate((img) => img.complete && img.naturalWidth > 0),
    { message: 'a imagem do hero deve terminar o carregamento com largura natural válida' },
  ).toBe(true)

  const src = await hero.getAttribute('src')
  expect(src).toBeTruthy()
  const response = await request.get(new URL(src, page.url()).toString())
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type'] ?? '').toMatch(/^image\//)
  expect((await response.body()).byteLength).toBeGreaterThan(50_000)
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
