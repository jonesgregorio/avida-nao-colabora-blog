import { test, expect } from '@playwright/test'

const USER_ID = '00000000-0000-4000-8000-000000000188'

function mockProfile(plan) {
  return {
    id: '00000000-0000-4000-8000-000000000199',
    user_id: USER_ID,
    plan,
    role: 'user',
    full_name: 'Pessoa E2E Campo Único',
    display_name: 'Pessoa E2E Campo Único',
    unlimited_access: false,
    unlimited_access_until: null,
    must_change_password: false,
  }
}

async function installSession(page, plan) {
  await page.addInitScript(({ userId }) => {
    const base64url = (value) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const now = Math.floor(Date.now() / 1000)
    const token = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: userId, aud: 'authenticated', role: 'authenticated', email: 'single-field@avidanaocolabora.test', iat: now, exp: now + 3600 })}.e2e`
    localStorage.setItem('sb-e2e-auth-token', JSON.stringify({
      access_token: token,
      refresh_token: 'e2e-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      user: {
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'single-field@avidanaocolabora.test',
        email_confirmed_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }))
  }, { userId: USER_ID })

  await page.route('https://e2e.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,HEAD,OPTIONS' } })
      return
    }
    if (url.pathname.includes('/rest/v1/profiles')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(mockProfile(plan)) })
      return
    }
    if (url.pathname.includes('/rest/v1/diary_plan_configs')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({}) })
      return
    }
    if (url.pathname.includes('/rest/v1/diary_entries')) {
      if (method === 'HEAD') await route.fulfill({ status: 200, headers: { ...headers, 'Content-Range': '*/0' }, body: '' })
      else await route.fulfill({ status: 200, headers: { ...headers, 'Content-Range': '0-0/0' }, body: JSON.stringify([]) })
      return
    }
    if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/rpc/')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify([]) })
      return
    }
    await route.fulfill({ status: 200, headers, body: JSON.stringify({}) })
  })
}

async function openDiary(page, viewport) {
  await page.setViewportSize(viewport)
  await installSession(page, 'plus')
  await page.goto('/diario')
  await expect(page.getByRole('heading', { name: /O que você quer colocar para fora hoje/i })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Texto do diário' })).toBeVisible()
}

async function openEveryOptionalLayer(page) {
  await page.getByRole('button', { name: /Quer acrescentar algo sobre este momento/i }).click()
  await expect(page.getByText('Como você está se sentindo?')).toBeVisible()
  await page.getByRole('button', { name: /Bem-estar/i }).click()
  await page.getByRole('textbox', { name: 'Texto do diário' }).fill('Hoje eu quero registrar este momento sem preencher vários formulários.')
  await page.getByRole('button', { name: /Adicionar mais detalhes/i }).click()
  await expect(page.getByLabel('Humor')).toHaveCount(0)
  await expect(page.getByLabel('Energia')).toBeVisible()
  await expect(page.getByLabel('Sono')).toBeVisible()
  await expect(page.getByText('Sentimentos principais')).toBeVisible()
  await page.getByRole('button', { name: /Contexto do dia/i }).click()
  await expect(page.getByText('Onde isso apareceu?')).toBeVisible()
  await page.getByRole('button', { name: /O que você precisa agora/i }).click()
  await expect(page.getByText('O que faria sentido agora?')).toBeVisible()
  await page.getByRole('button', { name: /O que pode ajudar um pouco/i }).click()
  await expect(page.getByText('Possibilidades para este momento')).toBeVisible()
  await expect(page.getByText('Aprofundar sinais')).toHaveCount(0)
  await expect(page.getByText('Gatilhos que você reconhece')).toHaveCount(0)
}

test('Diário Plus mantém somente um campo aberto de escrita mesmo com todos os detalhes abertos', async ({ page }) => {
  await openDiary(page, { width: 1440, height: 1000 })
  await openEveryOptionalLayer(page)

  const visibleOpenTextFields = page.locator('textarea:visible, input[type="text"]:visible')
  await expect(visibleOpenTextFields).toHaveCount(1)
  await expect(page.getByRole('textbox', { name: 'Texto do diário' })).toBeVisible()

  await expect(page.getByLabel('Algo pelo qual sinto gratidão')).toBeHidden()
  await expect(page.getByLabel('Uma pequena coisa que consegui')).toBeHidden()
  await expect(page.getByLabel('O que parece ter disparado isso?')).toBeHidden()
  await expect(page.getByLabel('Pensamentos que voltaram mais de uma vez')).toBeHidden()
  await expect(page.getByLabel('O que você sente que precisa emocionalmente')).toBeHidden()
  await expect(page.getByLabel('Algo sobre seus relacionamentos')).toBeHidden()
  await expect(page.getByLabel('Algo sobre seus hábitos')).toBeHidden()

  await page.screenshot({ path: 'test-results/diary-visual/single-writing-field-desktop.png', fullPage: true })
})

test('Campo único permanece sem overflow no mobile com tags e mapas abertos', async ({ page }) => {
  await openDiary(page, { width: 390, height: 844 })
  await openEveryOptionalLayer(page)

  await expect(page.locator('textarea:visible, input[type="text"]:visible')).toHaveCount(1)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await page.screenshot({ path: 'test-results/diary-visual/single-writing-field-mobile.png', fullPage: true })
})
