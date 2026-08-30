import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const USER_ID = '00000000-0000-4000-8000-000000000088'
const PROFILE_ID = '00000000-0000-4000-8000-000000000099'

function localDay(offset = 0) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function mockProfile(plan = 'plus') {
  return {
    id: PROFILE_ID,
    user_id: USER_ID,
    plan,
    role: 'user',
    full_name: 'Pessoa E2E',
    display_name: 'Pessoa E2E',
    preferred_name: 'Pessoa',
    status_phrase: null,
    notification_frequency: 'weekly',
    avatar_url: null,
    created_at: `${localDay(-70)}T12:00:00.000Z`,
    unlimited_access: false,
    unlimited_access_until: null,
    must_change_password: false,
  }
}

function structuredEntries() {
  return [
    {
      id: '00000000-0000-4000-8000-000000000201',
      user_id: USER_ID,
      date: localDay(0),
      created_at: `${localDay(0)}T14:00:00.000Z`,
      entry_type: 'checkin',
      diary_kind: null,
      mood: 'tranquilidade',
      mood_score: 4,
      energy: 4,
      anxiety_level: 2,
      sleep_quality: 4,
      stress_level: 2,
      self_esteem: 4,
      overload: 2,
      emotional_tags: ['Tranquilidade'],
      context_tags: ['Rotina'],
      need_tags: ['Descanso'],
      care_action_tags: ['Pausa'],
      trigger_tags: [],
    },
    {
      id: '00000000-0000-4000-8000-000000000202',
      user_id: USER_ID,
      date: localDay(-4),
      created_at: `${localDay(-4)}T18:00:00.000Z`,
      entry_type: 'diary',
      diary_kind: 'basic',
      mood: 'cansaco',
      mood_score: 2,
      energy: 2,
      anxiety_level: 3,
      sleep_quality: 3,
      stress_level: 3,
      self_esteem: 3,
      overload: 3,
      emotional_tags: ['Cansaço'],
      context_tags: ['Trabalho'],
      need_tags: ['Descanso'],
      care_action_tags: ['Pausa'],
      trigger_tags: ['Cobrança'],
    },
    {
      id: '00000000-0000-4000-8000-000000000203',
      user_id: USER_ID,
      date: localDay(-12),
      created_at: `${localDay(-12)}T10:00:00.000Z`,
      entry_type: 'checkin',
      diary_kind: null,
      mood: 'ansiedade',
      mood_score: 2,
      energy: 3,
      anxiety_level: 4,
      sleep_quality: 2,
      stress_level: 4,
      self_esteem: 3,
      overload: 4,
      emotional_tags: ['Ansiedade'],
      context_tags: ['Trabalho'],
      need_tags: ['Acolhimento'],
      care_action_tags: [],
      trigger_tags: ['Cobrança'],
    },
    {
      id: '00000000-0000-4000-8000-000000000204',
      user_id: USER_ID,
      date: localDay(-25),
      created_at: `${localDay(-25)}T09:00:00.000Z`,
      entry_type: 'diary',
      diary_kind: 'basic',
      mood: 'bem_estar',
      mood_score: 4,
      energy: 4,
      anxiety_level: 2,
      sleep_quality: 4,
      stress_level: 2,
      self_esteem: 4,
      overload: 2,
      emotional_tags: ['Bem-estar'],
      context_tags: ['Casa'],
      need_tags: ['Conexão'],
      care_action_tags: ['Descanso'],
      trigger_tags: [],
    },
  ]
}

function notificationRows() {
  return [{
    id: '00000000-0000-4000-8000-000000000301',
    user_id: USER_ID,
    title: 'Seu relatório semanal está disponível',
    message: 'Abra quando fizer sentido para olhar sua semana com mais distância.',
    type: 'weekly_report',
    is_read: false,
    action_url: '/meu-relatorio',
    action_data: {},
    created_at: new Date().toISOString(),
  }]
}

async function installAuthenticatedMocks(page, plan = 'plus') {
  await page.addInitScript(({ userId }) => {
    const base64url = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const now = Math.floor(Date.now() / 1000)
    const token = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: userId, aud: 'authenticated', role: 'authenticated', email: 'e2e@avidanaocolabora.test', iat: now, exp: now + 3600 })}.e2e`
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
        email: 'e2e@avidanaocolabora.test',
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

  await page.route('https://e2e.supabase.co/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
        },
      })
      return
    }

    if (url.pathname.includes('/rest/v1/profiles')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(mockProfile(plan)) })
      return
    }

    if (url.pathname.includes('/rest/v1/notifications')) {
      if (method === 'HEAD') {
        await route.fulfill({ status: 200, headers: { ...headers, 'Content-Range': '0-0/1' }, body: '' })
      } else if (method === 'PATCH') {
        await route.fulfill({ status: 200, headers, body: JSON.stringify(notificationRows()) })
      } else {
        await route.fulfill({ status: 200, headers: { ...headers, 'Content-Range': '0-0/1' }, body: JSON.stringify(notificationRows()) })
      }
      return
    }

    if (url.pathname.includes('/rest/v1/diary_entries')) {
      const rows = structuredEntries()
      if (method === 'HEAD') {
        await route.fulfill({ status: 200, headers: { ...headers, 'Content-Range': `0-${rows.length - 1}/${rows.length}` }, body: '' })
      } else if (method === 'POST') {
        const submitted = request.postDataJSON() || {}
        const payload = Array.isArray(submitted) ? submitted[0] : submitted
        await route.fulfill({ status: 201, headers, body: JSON.stringify({ ...payload, id: '00000000-0000-4000-8000-000000000399', created_at: new Date().toISOString() }) })
      } else {
        await route.fulfill({ status: 200, headers: { ...headers, 'Content-Range': `0-${rows.length - 1}/${rows.length}` }, body: JSON.stringify(rows) })
      }
      return
    }

    if (url.pathname.includes('/rest/v1/user_privacy_preferences')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ history_personalization_enabled: true }) })
      return
    }

    if (url.pathname.includes('/rest/v1/user_discovery_feedback')) {
      if (method === 'POST') {
        const submitted = request.postDataJSON() || {}
        await route.fulfill({ status: 201, headers, body: JSON.stringify(Array.isArray(submitted) ? submitted : [submitted]) })
      } else {
        await route.fulfill({ status: 200, headers, body: JSON.stringify([]) })
      }
      return
    }

    if (url.pathname.includes('/rest/v1/analytics_settings')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ config: { anonymize: true } }) })
      return
    }

    if (url.pathname.includes('/rest/v1/diary_plan_configs')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({}) })
      return
    }

    if (url.pathname.includes('/rest/v1/reports')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify([]) })
      return
    }

    if (url.pathname.startsWith('/rest/v1/')) {
      await route.fulfill({ status: 200, headers: { ...headers, 'Content-Range': '*/0' }, body: JSON.stringify([]) })
      return
    }

    if (url.pathname.includes('/rpc/')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify([]) })
      return
    }

    if (url.pathname.startsWith('/functions/v1/')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true }) })
      return
    }

    await route.fulfill({ status: 200, headers, body: JSON.stringify({}) })
  })
}

async function openLoggedRoute(page, route, viewport) {
  await page.setViewportSize(viewport)
  await page.goto(route)
  await expect(page.locator('main').first()).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await page.waitForTimeout(80)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, `${route} ultrapassou a largura em ${viewport.width}px`).toBeLessThanOrEqual(1)
}

function blockingAxe(violations) {
  return violations.filter(v => ['serious', 'critical'].includes(v.impact || ''))
}

const CORE_ROUTES = [
  '/',
  '/diario',
  '/descobertas',
  '/mapa-emocional',
  '/meu-relatorio',
  '/minha-historia',
  '/cuidar',
  '/mais',
  '/plano-de-autocuidado',
  '/conteudos',
  '/questionarios',
  '/guia-mensal',
  '/meu-plano',
  '/perfil',
  '/suporte',
  '/notificacoes',
]

test.beforeEach(async ({ page }) => {
  await installAuthenticatedMocks(page)
})

test('jornada autenticada principal abre no desktop sem erro de renderização ou overflow', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  for (const route of CORE_ROUTES) {
    pageErrors.length = 0
    await openLoggedRoute(page, route, { width: 1440, height: 900 })
    expect(pageErrors, `Erro de página em ${route}`).toEqual([])
  }

  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Área do usuário' })).toBeVisible()
  await page.screenshot({ path: 'test-results/idea1-qa/home-desktop.png', fullPage: true })
})

test('rotas mais densas continuam responsivas em mobile e em 320px', async ({ page }) => {
  for (const route of ['/', '/diario', '/descobertas', '/mapa-emocional', '/meu-relatorio', '/minha-historia', '/cuidar', '/mais', '/perfil', '/notificacoes']) {
    await openLoggedRoute(page, route, { width: 390, height: 844 })
  }

  for (const route of ['/', '/meu-relatorio', '/minha-historia', '/perfil', '/notificacoes']) {
    await openLoggedRoute(page, route, { width: 320, height: 760 })
  }

  await page.goto('/notificacoes')
  await expect(page.getByRole('button', { name: 'Marcar todas como lidas' })).toBeVisible()
  await page.screenshot({ path: 'test-results/idea1-qa/notifications-narrow.png', fullPage: true })
})

test('Perfil usa continuidade recente em vez de sequência obrigatória', async ({ page }) => {
  await openLoggedRoute(page, '/perfil', { width: 390, height: 844 })
  await expect(page.getByText(/dias? com registro nos últimos 30 dias/i)).toBeVisible()
  await expect(page.getByText(/dias? seguidos?/i)).toHaveCount(0)
  await page.screenshot({ path: 'test-results/idea1-qa/profile-mobile.png', fullPage: true })
})

test('menu Mais mobile recebe foco, fecha com Escape e navega para Minha História', async ({ page }) => {
  await openLoggedRoute(page, '/', { width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Hoje', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Diário', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Descobertas', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mapa', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Mais', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Mais recursos' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toBeFocused()
  await page.screenshot({ path: 'test-results/idea1-qa/mobile-more-dialog.png', fullPage: true })

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Mais', exact: true }).click()
  await page.getByRole('dialog', { name: 'Mais recursos' }).getByRole('button', { name: 'Minha História', exact: true }).click()
  await expect(page).toHaveURL(/\/minha-historia$/)
  await expect(page.getByRole('dialog', { name: 'Mais recursos' })).toHaveCount(0)
})

test('áreas autenticadas centrais não têm violações sérias ou críticas de acessibilidade', async ({ page }) => {
  for (const route of ['/', '/descobertas', '/mapa-emocional', '/minha-historia', '/perfil', '/notificacoes']) {
    await openLoggedRoute(page, route, { width: 390, height: 844 })
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = blockingAxe(results.violations)
    expect(blocking, `${route}\n${blocking.map(v => `${v.id}: ${v.help}`).join('\n')}`).toEqual([])
  }
})
