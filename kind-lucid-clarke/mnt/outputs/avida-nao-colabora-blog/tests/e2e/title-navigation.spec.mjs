import { test, expect } from '@playwright/test'

// Regressão da auditoria de cliques (mobile + desktop): document.title deve
// acompanhar a navegação SPA — a URL e o conteúdo já mudavam, o título não.
// Supabase é mockado pelo playwright.e2e.config; usamos só rotas públicas.

test.beforeEach(async ({ page }) => {
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
})

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]

for (const vp of VIEWPORTS) {
  test(`document.title acompanha a navegação SPA por clique — ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto('/')
    await expect(page).toHaveTitle('A Vida Não Colabora — Bem-estar emocional e autoconhecimento')

    // Navega por cliques nos links do rodapé (sem reload).
    for (const [label, expectedTitle] of [
      ['Sobre', 'Sobre — A Vida Não Colabora'],
      ['Contato', 'Contato — A Vida Não Colabora'],
      ['Privacidade', 'Política de Privacidade — A Vida Não Colabora'],
      ['Termos de uso', 'Termos de Uso — A Vida Não Colabora'],
    ]) {
      await page.getByRole('button', { name: label, exact: true }).first().click()
      await expect(page).toHaveTitle(expectedTitle)
    }

    // Voltar/avançar pelo histórico também atualiza o título.
    await page.goBack()
    await expect(page).toHaveTitle('Política de Privacidade — A Vida Não Colabora')
    await page.goForward()
    await expect(page).toHaveTitle('Termos de Uso — A Vida Não Colabora')
  })
}

test('carga direta de uma rota já traz o título correto', async ({ page }) => {
  await page.goto('/perguntas-frequentes')
  await expect(page).toHaveTitle('Perguntas frequentes — A Vida Não Colabora')
})

test('rota de artigo inexistente cai no título seguro de Conteúdos Guiados (não fica preso)', async ({ page }) => {
  await page.goto('/sobre')
  await expect(page).toHaveTitle('Sobre — A Vida Não Colabora')
  await page.goto('/blog/artigo-que-nao-existe-e2e')
  // Supabase mockado → artigo não encontrado; o título não pode continuar "Sobre".
  await expect(page).toHaveTitle('Conteúdos Guiados — A Vida Não Colabora')
})
