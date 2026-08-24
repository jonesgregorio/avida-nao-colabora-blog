import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const USER_ID = '00000000-0000-4000-8000-000000000088'

function mockProfile(plan) {
  return {
    id: '00000000-0000-4000-8000-000000000099',
    user_id: USER_ID,
    plan,
    role: 'user',
    full_name: 'Pessoa E2E',
    display_name: 'Pessoa E2E',
    unlimited_access: false,
    unlimited_access_until: null,
    must_change_password: false,
  }
}

async function installSession(page, plan) {
  await page.addInitScript(({ userId }) => {
    const base64url = (value) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
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
      if (method === 'HEAD') {
        await route.fulfill({ status: 200, headers: { ...headers, 'Content-Range': '*/0' }, body: '' })
      } else {
        await route.fulfill({ status: 200, headers: { ...headers, 'Content-Range': '0-0/0' }, body: JSON.stringify([]) })
      }
      return
    }

    if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/rpc/')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify([]) })
      return
    }

    await route.fulfill({ status: 200, headers, body: JSON.stringify({}) })
  })
}

async function openDiary(page, plan, viewport) {
  await page.setViewportSize(viewport)
  await installSession(page, plan)
  await page.goto('/diario')
  await expect(page.getByRole('heading', { name: /Como você chegou até aqui hoje/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Só quero escrever' })).toBeVisible()
}

async function installVoiceMocks(page, { permissionState = 'granted', denyMicrophone = false } = {}) {
  await page.addInitScript(({ state, deny }) => {
    window.__e2eMicRequests = 0
    window.__e2eMicTrackStops = 0
    window.__e2eSpeechStarts = 0

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: async ({ name }) => {
          if (name === 'microphone') return { state }
          return { state: 'prompt' }
        },
      },
    })

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          window.__e2eMicRequests += 1
          if (deny) throw new DOMException('Microfone bloqueado no teste', 'NotAllowedError')
          return {
            getTracks: () => [{ stop: () => { window.__e2eMicTrackStops += 1 } }],
          }
        },
      },
    })

    class FakeSpeechRecognition {
      constructor() {
        this.lang = ''
        this.continuous = false
        this.interimResults = false
        this.onresult = null
        this.onend = null
        this.onerror = null
      }
      start() { window.__e2eSpeechStarts += 1 }
      stop() { this.onend?.() }
    }

    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, writable: true, value: FakeSpeechRecognition })
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, writable: true, value: FakeSpeechRecognition })
  }, { state: permissionState, deny: denyMicrophone })
}

test('Gratuito mantém escrita simples, limite visível e histórico sem PDF', async ({ page }) => {
  await openDiary(page, 'free', { width: 1440, height: 900 })
  await expect(page.getByText('Plano Gratuito')).toBeVisible()
  await expect(page.getByText('0 de 5 registros de diário usados')).toBeVisible()
  await expect(page.getByText('Detalhes avançados Plus')).toHaveCount(0)

  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(page.getByRole('heading', { name: /Sua história deste mês/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Exportar PDF/i })).toHaveCount(0)
})

test('Essencial respeita opt-out integral e preserva o texto original', async ({ page }) => {
  await openDiary(page, 'essential', { width: 1440, height: 900 })
  await page.getByRole('button', { name: /Bem-estar/i }).click()
  const editor = page.getByRole('textbox', { name: 'Texto do diário' })
  const original = 'Hoje foi um dia cheio, mas consegui terminar uma tarefa importante e quero registrar isso.'
  await editor.fill(original)
  await expect(page.getByRole('button', { name: /Organizar minha escrita/i })).toBeVisible()

  await page.getByLabel('Salvar este registro sem análise de IA').check()
  await expect(page.getByRole('button', { name: /Organizar minha escrita/i })).toHaveCount(0)
  await expect(editor).toHaveValue(original)
  await expect(page.getByText(/Privacidade ativada: o registro será salvo normalmente/i)).toBeVisible()
})

test('Plus mostra aprofundamento progressivo sem transformar a tela em formulário inicial', async ({ page }) => {
  await openDiary(page, 'plus', { width: 1440, height: 900 })
  await expect(page.getByText('Detalhes avançados Plus')).toHaveCount(0)
  await page.getByRole('button', { name: /Quero detalhar um pouco/i }).click()
  await expect(page.getByText('Detalhes avançados Plus')).toBeVisible()
  await page.getByRole('button', { name: /Detalhes avançados Plus/i }).click()
  await expect(page.getByText('Gatilhos que você reconhece')).toBeVisible()

  await page.screenshot({ path: 'test-results/diary-visual/plus-desktop.png', fullPage: true })
})

test('microfone já concedido inicia SpeechRecognition sem reabrir getUserMedia', async ({ page }) => {
  await installVoiceMocks(page, { permissionState: 'granted' })
  await openDiary(page, 'plus', { width: 1440, height: 900 })

  await page.getByRole('button', { name: 'Prefiro falar' }).click()
  await expect.poll(() => page.evaluate(() => window.__e2eSpeechStarts)).toBe(1)
  await expect.poll(() => page.evaluate(() => window.__e2eMicRequests)).toBe(0)
  await expect.poll(() => page.evaluate(() => window.__e2eMicTrackStops)).toBe(0)
  await expect(page.getByRole('button', { name: 'Parar ditado' })).toBeVisible()
})

test('permissão em perguntar abre getUserMedia e depois inicia reconhecimento', async ({ page }) => {
  await installVoiceMocks(page, { permissionState: 'prompt' })
  await openDiary(page, 'plus', { width: 1440, height: 900 })

  await page.getByRole('button', { name: 'Prefiro falar' }).click()
  await expect.poll(() => page.evaluate(() => window.__e2eMicRequests)).toBe(1)
  await expect.poll(() => page.evaluate(() => window.__e2eMicTrackStops)).toBe(1)
  await expect.poll(() => page.evaluate(() => window.__e2eSpeechStarts)).toBe(1)
  await expect(page.getByRole('button', { name: 'Parar ditado' })).toBeVisible()
})

test('microfone bloqueado interrompe o reconhecimento e mostra orientação imediata', async ({ page }) => {
  await installVoiceMocks(page, { permissionState: 'denied', denyMicrophone: true })
  await openDiary(page, 'plus', { width: 1440, height: 900 })

  await page.getByRole('button', { name: 'Prefiro falar' }).click()
  await expect.poll(() => page.evaluate(() => window.__e2eMicRequests)).toBe(0)
  await expect.poll(() => page.evaluate(() => window.__e2eSpeechStarts)).toBe(0)
  await expect(page.getByRole('dialog', { name: 'Permita o microfone para continuar' })).toBeVisible()
  await expect(page.getByText(/Microfone → Permitir/)).toBeVisible()
})

test('Diário autenticado funciona em viewport mobile, modo foco e sem violações críticas de axe', async ({ page }) => {
  await openDiary(page, 'plus', { width: 390, height: 844 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  await page.getByRole('button', { name: 'Ativar modo foco' }).click()
  await expect(page.getByRole('button', { name: 'Sair do modo foco' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Texto do diário' })).toBeVisible()

  const results = await new AxeBuilder({ page }).analyze()
  const seriousOrCritical = results.violations.filter(v => ['serious', 'critical'].includes(v.impact || ''))
  expect(seriousOrCritical, seriousOrCritical.map(v => `${v.id}: ${v.help}`).join('\n')).toEqual([])

  await page.screenshot({ path: 'test-results/diary-visual/plus-mobile-focus.png', fullPage: true })
})
