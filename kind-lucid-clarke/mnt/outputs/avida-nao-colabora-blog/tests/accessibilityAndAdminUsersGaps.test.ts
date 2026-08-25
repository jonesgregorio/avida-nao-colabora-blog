import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// §13 da MISSÃO GERAL (Admin Usuários): last_activity já era calculado em
// AdminUsersImpl.tsx (esteve no site OU escreveu no diário, o que for mais
// recente), mas nunca aparecia no resumo do usuário — só o card "Últimos
// acessos" da lista (AdminUsersOverview.tsx) usava esse dado.
test('resumo do usuário no Admin mostra "Último acesso" (last_activity), não só na lista', () => {
  const impl = read('src/components/admin/AdminUsersImpl.tsx')
  assert.match(impl, /\['Último acesso', selectedUser\.last_activity/)
})

// Amostra de acessibilidade: botões de fechar modal que são só ícone (sem
// texto visível ao lado) precisam de aria-label para leitores de tela. Só
// checa os handlers de fechar (onClose/closeDrawer) — botões com texto
// visível ("Limpar seleção", "Remover"...) ficam de fora de propósito.
const CLOSE_HANDLERS = ['onClose', 'closeDrawer']
const CLOSE_BUTTON_FILES = [
  'src/components/MyReportPageContent.tsx',
  'src/components/admin/AIContentAssistant.tsx',
  'src/components/admin/ArticlePreview.tsx',
  'src/components/admin/AdminPersonalization.tsx',
  'src/components/admin/AdminSupport.tsx',
  'src/components/admin/AdminSendUserEmail.tsx',
  'src/components/admin/AdminMonthlyCarePlans.tsx',
  'src/components/admin/AdminUsersImpl.tsx',
]

test('botões de fechar (onClose/closeDrawer) só-ícone têm aria-label="Fechar" para leitores de tela', () => {
  for (const path of CLOSE_BUTTON_FILES) {
    const src = read(path)
    const pattern = new RegExp(`<button[^>]*onClick=\\{(?:${CLOSE_HANDLERS.join('|')})\\}[^>]*>\\s*<X className`, 'g')
    const buttons = src.match(pattern) ?? []
    assert.ok(buttons.length > 0, `${path}: esperava pelo menos 1 botão de fechar (onClose/closeDrawer) só-ícone`)
    for (const tag of buttons) {
      assert.match(tag, /aria-label=/, `${path}: botão de fechar sem aria-label: ${tag}`)
    }
  }
})
