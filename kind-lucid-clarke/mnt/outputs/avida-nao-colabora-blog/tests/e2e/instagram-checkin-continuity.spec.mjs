import { test, expect } from '@playwright/test'

test.describe('Instagram → check-in → cadastro', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('mantém a intenção do check-in apenas na sessão e abre cadastro direto', async ({ page }) => {
    await page.goto('/ig?utm_source=instagram&utm_medium=social&utm_campaign=perfil&utm_content=bio')

    await expect(page.getByRole('heading', { name: 'Como você está hoje?' })).toBeVisible()
    await page.getByRole('button', { name: /Fazer meu primeiro check-in grátis/i }).click()
    await expect(page.locator('section[aria-labelledby="ig-checkin-title"]')).toBeFocused()
    await expect(page.locator('[data-cta="ig-checkin-preview-open"] .lucide-arrow-down')).toBeVisible()
    await page.getByRole('button', { name: 'Sobrevivemos' }).click()
    await page.getByRole('button', { name: 'Ansiedade' }).click()
    await page.getByRole('button', { name: /Concluir meu check-in/i }).click()

    await expect(page.getByRole('heading', { name: 'Sua prévia está concluída' })).toBeVisible()
    await expect(page.getByText('Sua prévia não foi salva. Depois de entrar, você poderá registrar o check-in no seu Diário.')).toBeVisible()
    await page.getByRole('button', { name: /Registrar meu primeiro check-in grátis/i }).click()

    await expect(page).toHaveURL(/\/login\?mode=signup/)
    const pending = await page.evaluate(() => sessionStorage.getItem('avida_pending_action'))
    expect(pending).toContain('"view":"diary"')
    expect(pending).toContain('"mood":"ansiedade"')

    await expect(page.getByText('Nome completo')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Criar conta/i })).toBeVisible()
  })
})
