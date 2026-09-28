import { test, expect } from '@playwright/test'

test.describe('Instagram → cadastro em mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('landing /ig mantém UTM, check-in temporário e abre cadastro direto', async ({ page }) => {
    await page.goto('/ig?utm_source=instagram&utm_medium=social&utm_campaign=perfil&utm_content=bio')

    await expect(page.getByRole('heading', { name: 'Como você está hoje?' })).toBeVisible()
    await expect(page.getByText('Sem cartão. Privado. Leva cerca de 2 minutos.')).toBeVisible()

    const mood = page.getByRole('button', { name: 'Difícil' })
    await mood.click()
    await expect(mood).toHaveAttribute('aria-pressed', 'true')

    const pending = await page.evaluate(() => sessionStorage.getItem('avida_pending_action'))
    expect(pending).toContain('"view":"diary"')
    expect(pending).toContain('"mood":"mal"')

    await page.getByRole('button', { name: /Continuar meu check-in grátis/i }).first().click()
    await expect(page).toHaveURL(/\/login\?.*modo=cadastro/)
    await expect(page).toHaveURL(/utm_source=instagram/)
    await expect(page).toHaveURL(/utm_medium=social/)
    await expect(page).toHaveURL(/utm_campaign=perfil/)
    await expect(page).toHaveURL(/utm_content=bio/)

    await expect(page.getByRole('heading', { name: 'Crie sua conta gratuita' })).toBeVisible()
    await expect(page.getByLabel('E-mail')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByText(/Concordo com os/)).toBeVisible()
    await expect(page.getByText('Nome completo')).toHaveCount(0)
  })

  test('cadastro apresenta validação simples e não permite envio duplicado', async ({ page }) => {
    await page.goto('/login?modo=cadastro&origem=instagram')
    await expect(page.getByRole('heading', { name: 'Crie sua conta gratuita' })).toBeVisible()

    await page.getByLabel('E-mail').fill('teste@example.com')
    const password = page.locator('input[type="password"]')
    await password.fill('curta')
    await page.getByRole('button', { name: /Criar conta grátis/i }).click()
    await expect.poll(async () => password.evaluate((el) => el.validity.tooShort)).toBe(true)

    await password.fill('senha-segura-123')
    await page.getByRole('button', { name: /Criar conta grátis/i }).click()
    await expect(page.getByText('É preciso aceitar os Termos de Uso e a Política de Privacidade.')).toBeVisible()
  })
})
