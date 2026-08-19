import { test, expect } from '@playwright/test'

test('rascunhos sensíveis são migrados e mantidos apenas na sessão da aba', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('contact_draft', 'rascunho legado de contato')
    localStorage.setItem('avnc-support-draft-ticket-e2e', 'rascunho legado de suporte')
  })

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

  await page.goto('/')

  const migrated = await page.evaluate(() => ({
    contactCompatRead: localStorage.getItem('contact_draft'),
    contactSession: sessionStorage.getItem('contact_draft'),
    supportCompatRead: localStorage.getItem('avnc-support-draft-ticket-e2e'),
    supportSession: sessionStorage.getItem('avnc-support-draft-ticket-e2e'),
    localKeys: Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)),
  }))

  expect(migrated.contactCompatRead).toBe('rascunho legado de contato')
  expect(migrated.contactSession).toBe('rascunho legado de contato')
  expect(migrated.supportCompatRead).toBe('rascunho legado de suporte')
  expect(migrated.supportSession).toBe('rascunho legado de suporte')
  expect(migrated.localKeys).not.toContain('contact_draft')
  expect(migrated.localKeys).not.toContain('avnc-support-draft-ticket-e2e')

  const redirectedWrite = await page.evaluate(() => {
    localStorage.setItem('avnc-guidance-draft-request-e2e', 'orientação temporária')
    return {
      compatRead: localStorage.getItem('avnc-guidance-draft-request-e2e'),
      session: sessionStorage.getItem('avnc-guidance-draft-request-e2e'),
      localKeys: Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)),
    }
  })

  expect(redirectedWrite.compatRead).toBe('orientação temporária')
  expect(redirectedWrite.session).toBe('orientação temporária')
  expect(redirectedWrite.localKeys).not.toContain('avnc-guidance-draft-request-e2e')
})
