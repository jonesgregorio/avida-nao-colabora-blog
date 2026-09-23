import { mkdirSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const adminId = '11111111-1111-4111-8111-111111111111'
const adminProfile = {
  user_id: adminId,
  role: 'admin',
  admin_role: 'super_admin',
  plan: 'plus',
  full_name: 'Administrador E2E',
  display_name: 'Administrador E2E',
  preferred_name: 'Admin',
  email: 'admin-e2e@example.test',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const sections = [
  ['Dashboard', 'dashboard'],
  ['Usuários', 'usuarios'],
  ['Assinaturas', 'assinaturas'],
  ['Conteúdo', 'conteudo'],
  ['SEO & Performance', 'seo'],
  ['Marketing', 'marketing'],
  ['Comunicação', 'comunicacao'],
  ['Atendimentos & Entregas', 'atendimentos'],
  ['Suporte', 'suporte'],
  ['Jardins', 'jardins'],
  ['Analytics', 'analytics'],
  ['Sistema', 'sistema'],
]

function mockJwt() {
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    aud: 'authenticated',
    exp: now + 60 * 60,
    iat: now - 30,
    iss: 'https://e2e.supabase.co/auth/v1',
    sub: adminId,
    email: 'admin-e2e@example.test',
    role: 'authenticated',
    aal: 'aal2',
    session_id: '22222222-2222-4222-8222-222222222222',
  })}.e2e-signature`
}

async function installAdminSession(page) {
  const token = mockJwt()
  const nowIso = new Date().toISOString()
  const session = {
    access_token: token,
    refresh_token: 'e2e-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: adminId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin-e2e@example.test',
      email_confirmed_at: nowIso,
      phone: '',
      confirmed_at: nowIso,
      last_sign_in_at: nowIso,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: nowIso,
      updated_at: nowIso,
      is_anonymous: false,
    },
  }

  await page.addInitScript(value => {
    localStorage.setItem('sb-e2e-auth-token', JSON.stringify(value))
  }, session)

  await page.route('https://e2e.supabase.co/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const accept = request.headers().accept ?? ''

    if (path.startsWith('/auth/v1/')) {
      if (path.includes('/factors')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ all: [], totp: [], phone: [] }) })
        return
      }
      if (path.endsWith('/user')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      return
    }

    if (path.includes('/rest/v1/rpc/admin_my_permissions')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['*']) })
      return
    }
    if (path.includes('/rest/v1/rpc/admin_action_center_snapshot')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ generated_at: nowIso, total: 0, overdue: 0, due_3d: 0, areas: {} }),
      })
      return
    }
    if (path.includes('/rest/v1/rpc/admin_queues_overview')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ generated_at: nowIso, queues: {}, failures_active: {}, failures_24h: {} }),
      })
      return
    }
    if (path.includes('/rest/v1/rpc/admin_activity_events_unread_count')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '0' })
      return
    }

    if (path.startsWith('/rest/v1/profiles') && accept.includes('application/vnd.pgrst.object+json')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(adminProfile),
        headers: { 'content-range': '0-0/1' },
      })
      return
    }

    const body = path.startsWith('/rest/v1/profiles') ? JSON.stringify([adminProfile]) : '[]'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body,
      headers: { 'content-range': path.startsWith('/rest/v1/profiles') ? '0-0/1' : '*/0' },
    })
  })
}

async function expectHealthyAdmin(page, label) {
  await expect(page.locator('.admin-shell')).toBeVisible()
  await expect(page.locator('.vite-error-overlay')).toHaveCount(0)
  const audit = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    brokenImages: Array.from(document.images)
      .filter(image => image.complete && image.naturalWidth === 0)
      .map(image => image.currentSrc),
  }))
  expect(audit.horizontalOverflow, `${label}: sem overflow horizontal na raiz`).toBe(false)
  expect(audit.brokenImages, `${label}: sem imagens quebradas`).toEqual([])
}

async function openSection(page, label, mobile) {
  if (mobile) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
  }
  const button = page.getByRole('button', { name: label, exact: true }).first()
  await expect(button).toBeVisible()
  await button.click()
  await page.waitForTimeout(100)
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
]) {
  test(`Admin autenticado: auditoria visual completa em ${viewport.name}`, async ({ page }) => {
    mkdirSync('test-results/admin-visual', { recursive: true })
    const runtimeErrors = []
    page.on('pageerror', error => runtimeErrors.push(error.message))

    await installAdminSession(page)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/admin')
    await page.waitForTimeout(1200)
    const debug = await page.evaluate(() => ({
      href: location.href,
      title: document.title,
      body: document.body.innerText.slice(0, 1200),
      keys: Object.keys(localStorage),
    }))
    console.log('[admin-e2e-debug]', JSON.stringify(debug))
    await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 10_000 })

    for (const [label, slug] of sections) {
      await test.step(label, async () => {
        await openSection(page, label, viewport.mobile)
        await expectHealthyAdmin(page, `${viewport.name}/${label}`)
        await page.screenshot({
          path: `test-results/admin-visual/${viewport.name}-${slug}.png`,
          fullPage: true,
        })
      })
    }

    expect(runtimeErrors, `erros de runtime no Admin ${viewport.name}: ${runtimeErrors.join(' | ')}`).toHaveLength(0)
  })
}
