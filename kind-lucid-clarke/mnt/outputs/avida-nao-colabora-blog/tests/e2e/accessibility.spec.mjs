import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/faq',
  '/contato',
  '/sobre',
  '/privacidade',
  '/termos',
]

const BLOCKING_IMPACTS = new Set(['serious', 'critical'])

function formatViolations(violations) {
  return violations
    .map(violation => {
      const nodes = violation.nodes
        .slice(0, 5)
        .map(node => `  - ${node.target.join(' ')}: ${node.failureSummary ?? 'sem detalhe'}`)
        .join('\n')
      return `${violation.id} [${violation.impact ?? 'sem impacto'}] — ${violation.help}\n${nodes}`
    })
    .join('\n\n')
}

test.beforeEach(async ({ page }) => {
  await page.route('https://e2e.supabase.co/**', async route => {
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

test.describe('acessibilidade WCAG 2.1 A/AA nas páginas públicas', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} não tem violações sérias ou críticas detectáveis automaticamente`, async ({ page }) => {
      await page.goto(route)
      await expect(page.locator('body')).toBeVisible()

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const blocking = results.violations.filter(violation =>
        violation.impact && BLOCKING_IMPACTS.has(violation.impact),
      )

      expect(blocking, formatViolations(blocking)).toEqual([])
    })
  }
})

test('home mantém foco visível e alcançável por teclado', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')

  const focused = page.locator(':focus')
  await expect(focused).toBeVisible()

  const tagName = await focused.evaluate(element => element.tagName.toLowerCase())
  expect(['a', 'button', 'input', 'select', 'textarea']).toContain(tagName)
})
