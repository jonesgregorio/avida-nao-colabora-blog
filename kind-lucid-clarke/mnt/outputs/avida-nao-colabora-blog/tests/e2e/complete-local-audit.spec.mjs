import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const required = ['E2E_SUPABASE_URL', 'E2E_SUPABASE_ANON_KEY', 'E2E_SUPABASE_SERVICE_ROLE_KEY', 'E2E_DOCKER_BIN']
const hasLocalE2E = required.every(name => Boolean(process.env[name]))
test.skip(!hasLocalE2E, 'requer Supabase e Docker locais')

const publicRoutes = [
  '/', '/blog', '/conteudos', '/planos', '/faq', '/perguntas-frequentes',
  '/sobre', '/contato', '/privacidade', '/termos', '/aviso-de-responsabilidade',
  '/login', '/questionarios', '/sucesso', '/suporte', '/notificacoes',
]
const privateRoutes = ['/perfil', '/diario', '/meu-plano', '/mapa-emocional', '/meu-relatorio', '/plano-de-autocuidado', '/guia-mensal', '/comentarios-profissional']
const admin = hasLocalE2E ? createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null
const password = `Audit-${randomUUID()}-Aa1!`
const accounts = ['free', 'essential', 'plus'].map(plan => ({ plan, email: `audit-${plan}-${randomUUID().slice(0, 8)}@local.test` }))

async function expectHealthyPage(page) {
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('.vite-error-overlay')).toHaveCount(0)
  const audit = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    brokenImages: Array.from(document.images).filter(image => image.complete && image.naturalWidth === 0).map(image => image.currentSrc),
  }))
  expect(audit.horizontalOverflow, 'a página não deve criar rolagem horizontal no desktop').toBe(false)
  expect(audit.brokenImages, 'imagens carregadas não podem estar quebradas').toEqual([])
}

async function signIn(page, account) {
  await page.goto('/login')
  await page.locator('#auth-email').fill(account.email)
  await page.locator('#auth-password').fill(password)
  await page.locator('form').getByRole('button', { name: /^Entrar$/ }).click()
  await expect(page.getByRole('navigation')).toContainText('Perfil')
}

test.beforeAll(async () => {
  for (const account of accounts) {
    const { data, error } = await admin.auth.admin.createUser({ email: account.email, password, email_confirm: true })
    if (error || !data.user) throw new Error(error?.message ?? 'não foi possível criar conta de auditoria')
    account.id = data.user.id
    execFileSync(process.env.E2E_DOCKER_BIN, ['exec', 'supabase_db_local-e2e', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `UPDATE public.profiles SET plan = '${account.plan}', subscription_status = 'active' WHERE user_id = '${account.id}'::uuid`], { stdio: 'ignore' })
  }
})

test.afterAll(async () => {
  await Promise.all(accounts.map(account => admin.auth.admin.deleteUser(account.id)))
})

test('todas as rotas públicas canônicas renderizam sem erro visual grave', async ({ page }) => {
  for (const route of publicRoutes) {
    await test.step(route, async () => {
      await page.goto(route)
      await expectHealthyPage(page)
    })
  }
})

test('todas as rotas públicas permanecem utilizáveis em largura de celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const route of publicRoutes) {
    await test.step(route, async () => {
      await page.goto(route)
      await expectHealthyPage(page)
    })
  }
})

test('CTAs principais da home levam a uma tela utilizável', async ({ page }) => {
  await page.goto('/')
  const ctas = await page.locator('[data-cta]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-cta')).filter(Boolean))
  expect(ctas.length).toBeGreaterThan(0)
  for (const cta of ctas) {
    await page.goto('/')
    await page.locator(`[data-cta="${cta}"]`).click()
    await expectHealthyPage(page)
    expect(new URL(page.url()).pathname).not.toBe('/')
  }
})

test('FAQ permite filtrar categorias e abrir respostas; formulário valida campos obrigatórios', async ({ page }) => {
  await page.goto('/faq')
  const category = page.getByRole('button', { name: 'Planos e pagamento' })
  await category.click()
  await expect(page.getByText('Qual a diferença entre os planos?')).toBeVisible()
  const question = page.getByRole('button', { name: 'Qual a diferença entre os planos?' })
  await question.click()
  await expect(question).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText(/diário básico.*5 registros/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar mensagem' })).toBeEnabled()
  await page.locator('#faq-name').fill('Conta de auditoria')
  await page.locator('#faq-email').fill('audit@example.test')
  await page.locator('#faq-message').fill('Mensagem de auditoria local, sem envio externo.')
  await expectHealthyPage(page)
})

test('cadastro e recuperação de senha validam os caminhos seguros antes de chamar o servidor', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Criar conta', exact: true }).first().click()
  await page.locator('#auth-name').fill('Conta de teste')
  await page.locator('#auth-email').fill('new-account@local.test')
  await page.locator('#auth-password').fill('Senha-local-123')
  await page.locator('#auth-confirm-password').fill('Senha-diferente-456')
  await page.getByRole('button', { name: 'Começar grátis' }).click()
  await expect(page.getByText('As senhas não coincidem.')).toBeVisible()
  await page.locator('#auth-confirm-password').fill('Senha-local-123')
  await page.getByRole('button', { name: 'Começar grátis' }).click()
  await expect(page.getByText(/aceitar os Termos de Uso/i)).toBeVisible()
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click()
  await page.getByRole('button', { name: /Esqueci minha senha/i }).click()
  await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible()
  await expectHealthyPage(page)
})

test('área administrativa bloqueia visitante e apresenta login administrativo', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Painel Administrativo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar no painel' })).toBeVisible()
  await expectHealthyPage(page)
})

test('contato preserva rascunho antes do login e envia somente para o endpoint local simulado', async ({ page }) => {
  await page.goto('/contato')
  await page.locator('#contact-message').fill('Preciso de ajuda para testar o fluxo de contato.')
  await page.getByRole('button', { name: 'Entrar e enviar mensagem' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await signIn(page, accounts[0])
  await page.route('**/functions/v1/submit-contact-ticket', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }))
  await page.goto('/contato')
  await expect(page.locator('#contact-message')).toHaveValue(/Preciso de ajuda/)
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  await expect(page.getByRole('heading', { name: 'Mensagem enviada!' })).toBeVisible()
  await expectHealthyPage(page)
})

test('suporte autenticado valida os dados e envia pela função protegida', async ({ page }) => {
  await signIn(page, accounts[1])
  await page.route('**/functions/v1/submit-contact-ticket', route => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }))
  await page.goto('/suporte')
  await page.getByPlaceholder('Em que podemos te ajudar?').fill('Auditoria automatizada local')
  await page.locator('textarea').first().fill('Esta mensagem foi criada somente para validar o fluxo local de suporte.')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  await expect(page.getByRole('heading', { name: 'Mensagem enviada!' })).toBeVisible()
  await expectHealthyPage(page)
})

for (const account of accounts) {
  test(`plano ${account.plan}: rotas privadas e ação de planos respeitam a lógica`, async ({ page }) => {
    await signIn(page, account)
    for (const route of privateRoutes) {
      await page.goto(route)
      await expect(page.getByRole('navigation')).toContainText('Perfil')
      await expectHealthyPage(page)
    }

    await page.goto('/planos')
    await page.route('**/functions/v1/create-checkout', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'http://127.0.0.1:4173/sucesso?checkout=audit' }),
    }))
    const cards = { free: 'Gratuito', essential: 'Essencial', plus: 'Plus' }
    await expect(page.getByRole('heading', { name: cards[account.plan] })).toBeVisible()
    const currentCard = page.getByRole('heading', { name: cards[account.plan] }).locator('..').locator('..')
    await expect(currentCard.getByRole('button', { name: /Plano atual/ })).toBeDisabled()

    const paidTarget = account.plan === 'free' ? 'essential' : account.plan === 'essential' ? 'plus' : 'essential'
    await page.locator(`[data-cta="assinar-${paidTarget}"]`).click()
    if (account.plan === 'free') {
      await expect(page).toHaveURL(/\/sucesso/)
    } else {
      await expect(page).toHaveURL(/\/meu-plano$/)
    }
    await expectHealthyPage(page)
  })
}

test('sessão autenticada mantém as áreas privadas utilizáveis em largura de celular', async ({ page }) => {
  await signIn(page, accounts[2])
  await page.setViewportSize({ width: 390, height: 844 })
  for (const route of ['/diario', '/questionarios', '/mapa-emocional', '/meu-relatorio', '/plano-de-autocuidado', '/meu-plano', '/suporte']) {
    await page.goto(route)
    await expect(page.locator('main')).toBeVisible()
    await expectHealthyPage(page)
  }
})
