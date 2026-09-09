import { test, expect } from '@playwright/test'

// O CI E2E roda sem sessão real (Supabase mockado). O painel admin autenticado
// e o Alert Center dependem de sessão admin + MFA/AAL2, que este ambiente não
// consegue emitir. Cobrimos aqui o que é verificável sem auth: /admin exige
// login e o bundle do painel (que agora inclui AdminActivityAlerts) carrega sem
// erro de runtime.

test.beforeEach(async ({ page }) => {
  await page.route('https://e2e.supabase.co/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    const isRest = pathname.startsWith('/rest/v1/') || pathname.startsWith('/rpc/')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: isRest ? '[]' : '{}',
      headers: isRest ? { 'content-range': '0-0/0' } : undefined,
    })
  })
})

test('/admin exige autenticação e o painel carrega sem erro de runtime', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/admin')

  await expect(page.getByRole('heading', { name: /Bem-vindo de volta/i })).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()

  expect(errors, `erros de runtime no bundle admin: ${errors.join(' | ')}`).toHaveLength(0)
})
