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
      } else if (method === 'POST') {
        const submitted = request.postDataJSON() || {}
        const payload = Array.isArray(submitted) ? submitted[0] : submitted
        await route.fulfill({
          status: 201,
          headers,
          body: JSON.stringify({
            ...payload,
            id: '00000000-0000-4000-8000-000000000123',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        })
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
  await expect(page.getByRole('button', { name: 'Salvar check-in' })).toBeVisible()
}

async function openWritingMode(page) {
  await page.getByRole('button', { name: 'Meu diário' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do diário' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Preciso de ajuda para começar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adicionar detalhes opcionais' })).toBeVisible()
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

test('Check-in rápido abre primeiro e oferece sinais complementares sem duplicar emoções', async ({ page }) => {
  await openDiary(page, 'plus', { width: 1440, height: 900 })

  await expect(page.getByRole('textbox', { name: 'Texto do diário' })).toHaveCount(0)
  const checkinBox = await page.getByRole('button', { name: 'Check-in rápido' }).boundingBox()
  const diaryBox = await page.getByRole('button', { name: 'Meu diário' }).boundingBox()
  expect(checkinBox?.x ?? Infinity).toBeLessThan(diaryBox?.x ?? -Infinity)

  await page.getByRole('button', { name: /Bem-estar/i }).click()
  await expect(page.getByLabel('Energia')).toBeVisible()
  await expect(page.getByLabel('Tensão/estresse')).toBeVisible()
  await expect(page.getByLabel('Intensidade da ansiedade')).toHaveCount(0)

  await page.getByRole('button', { name: /Ansiedade/i }).click()
  await expect(page.getByLabel('Intensidade da ansiedade')).toBeVisible()

  await page.getByRole('button', { name: 'Quero contar um pouco mais' }).click()
  await expect(page.getByText('O que mais está influenciando você agora?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Trabalho' })).toBeVisible()
})

test('Check-in salvo oferece concluir ou continuar no diário', async ({ page }) => {
  await openDiary(page, 'plus', { width: 1440, height: 900 })
  await page.getByRole('button', { name: /Tranquilidade/i }).click()
  await page.getByRole('textbox', { name: 'Nota rápida do check-in' }).fill('Uma pausa no fim da tarde me ajudou.')
  await page.getByRole('button', { name: 'Salvar check-in' }).click()

  await expect(page.getByRole('heading', { name: 'Check-in registrado' })).toBeVisible()
  await expect(page.getByText('Você registrou como está agora. Quer deixar assim ou escrever um pouco mais?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Concluir' })).toBeVisible()
  await page.getByRole('button', { name: 'Quero escrever sobre isso' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do diário' })).toBeVisible()
})

test('Gratuito mantém check-in simples, limite visível no diário e histórico sem PDF', async ({ page }) => {
  await openDiary(page, 'free', { width: 1440, height: 900 })
  await expect(page.getByLabel('Energia')).toHaveCount(0)
  await expect(page.getByText('Quero refletir mais sobre este registro')).toHaveCount(0)

  await openWritingMode(page)
  await expect(page.getByText('Plano Gratuito')).toBeVisible()
  await expect(page.getByText('0 de 5 registros de diário usados')).toBeVisible()

  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(page.getByRole('heading', { name: /Sua história deste mês/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Exportar PDF/i })).toHaveCount(0)
})

test('Diário completo abre minimalista e revela ajuda somente sob demanda', async ({ page }) => {
  await openDiary(page, 'plus', { width: 1440, height: 900 })
  await openWritingMode(page)

  await expect(page.getByRole('button', { name: 'Sugira uma pergunta' })).toHaveCount(0)
  await expect(page.getByText('Quais sentimentos apareceram?')).toHaveCount(0)
  await expect(page.getByText('Quero refletir mais sobre este registro')).toHaveCount(0)
  await expect(page.getByText('Só quero escrever')).toHaveCount(0)
  await expect(page.getByText('Me ajude a começar')).toHaveCount(0)
  await expect(page.getByText('Não sei o que escrever')).toHaveCount(0)

  await page.screenshot({ path: 'test-results/diary-visual/plus-desktop-minimal.png', fullPage: true })

  await page.getByRole('button', { name: 'Preciso de ajuda para começar' }).click()
  await expect(page.getByRole('button', { name: 'Sugira uma pergunta' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Minha cabeça está cheia' })).toBeVisible()
})

test('Essencial respeita opt-out integral, preserva o original e mantém organização recolhida', async ({ page }) => {
  await openDiary(page, 'essential', { width: 1440, height: 900 })
  await openWritingMode(page)
  await page.getByRole('button', { name: /Bem-estar/i }).click()
  const editor = page.getByRole('textbox', { name: 'Texto do diário' })
  const original = 'Hoje foi um dia cheio, mas consegui terminar uma tarefa importante e quero registrar isso.'
  await editor.fill(original)
  await expect(page.getByRole('button', { name: /Organizar o que já escrevi/i })).toHaveCount(0)

  await page.getByRole('button', { name: 'Preciso de ajuda para começar' }).click()
  await expect(page.getByRole('button', { name: /Organizar o que já escrevi/i })).toBeVisible()

  await page.getByLabel('Salvar sem leitura complementar').check()
  await expect(page.getByRole('button', { name: /Organizar o que já escrevi/i })).toHaveCount(0)
  await expect(editor).toHaveValue(original)
  await expect(page.getByText(/Leitura complementar desativada: seu registro será salvo normalmente/i)).toBeVisible()
})

test('Plus mantém detalhes e reflexão avançada em dois níveis progressivos', async ({ page }) => {
  await openDiary(page, 'plus', { width: 1440, height: 900 })
  await openWritingMode(page)
  await expect(page.getByText('Quero refletir mais sobre este registro')).toHaveCount(0)

  await page.getByRole('button', { name: /Adicionar detalhes opcionais/i }).click()
  await expect(page.getByText('Quais sentimentos apareceram?')).toBeVisible()
  await expect(page.getByRole('button', { name: /Quero refletir mais sobre este registro/i })).toBeVisible()
  await expect(page.getByText('Gatilhos que você reconhece')).toHaveCount(0)

  await page.getByRole('button', { name: /Quero refletir mais sobre este registro/i }).click()
  await expect(page.getByText('Gatilhos que você reconhece')).toBeVisible()
})

test('microfone já concedido inicia SpeechRecognition sem reabrir getUserMedia', async ({ page }) => {
  await installVoiceMocks(page, { permissionState: 'granted' })
  await openDiary(page, 'plus', { width: 1440, height: 900 })
  await openWritingMode(page)

  await page.getByRole('button', { name: 'Prefiro falar' }).click()
  await expect.poll(() => page.evaluate(() => window.__e2eSpeechStarts)).toBe(1)
  await expect.poll(() => page.evaluate(() => window.__e2eMicRequests)).toBe(0)
  await expect.poll(() => page.evaluate(() => window.__e2eMicTrackStops)).toBe(0)
  await expect(page.getByRole('button', { name: 'Parar ditado' })).toBeVisible()
})

test('permissão em perguntar abre getUserMedia e depois inicia reconhecimento', async ({ page }) => {
  await installVoiceMocks(page, { permissionState: 'prompt' })
  await openDiary(page, 'plus', { width: 1440, height: 900 })
  await openWritingMode(page)

  await page.getByRole('button', { name: 'Prefiro falar' }).click()
  await expect.poll(() => page.evaluate(() => window.__e2eMicRequests)).toBe(1)
  await expect.poll(() => page.evaluate(() => window.__e2eMicTrackStops)).toBe(1)
  await expect.poll(() => page.evaluate(() => window.__e2eSpeechStarts)).toBe(1)
  await expect(page.getByRole('button', { name: 'Parar ditado' })).toBeVisible()
})

test('microfone bloqueado interrompe o reconhecimento e mostra orientação imediata', async ({ page }) => {
  await installVoiceMocks(page, { permissionState: 'denied', denyMicrophone: true })
  await openDiary(page, 'plus', { width: 1440, height: 900 })
  await openWritingMode(page)

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

  await openWritingMode(page)
  await page.getByRole('button', { name: 'Ativar modo foco' }).click()
  await expect(page.getByRole('button', { name: 'Sair do modo foco' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Texto do diário' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Preciso de ajuda para começar' })).toBeVisible()

  const results = await new AxeBuilder({ page }).analyze()
  const seriousOrCritical = results.violations.filter(v => ['serious', 'critical'].includes(v.impact || ''))
  expect(seriousOrCritical, seriousOrCritical.map(v => `${v.id}: ${v.help}`).join('\n')).toEqual([])

  await page.screenshot({ path: 'test-results/diary-visual/plus-mobile-focus.png', fullPage: true })
})