import { test, expect } from '@playwright/test'

const SENTRY_CDN_PATTERN = /https:\/\/js\.sentry-cdn\.com\//

test('monitoramento externo permanece desativado sem configuração do Sentry', async ({ page }) => {
  const sentryRequests = []
  page.on('request', (request) => {
    if (SENTRY_CDN_PATTERN.test(request.url()) || request.url().includes('.ingest.sentry.io')) {
      sentryRequests.push(request.url())
    }
  })

  await page.route('https://e2e.supabase.co/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: pathname.startsWith('/rest/v1/') ? '[]' : '{}',
    })
  })

  await page.goto('/')
  await expect(page.locator('body')).toContainText('A Vida Não Colabora')
  expect(sentryRequests).toEqual([])
})
