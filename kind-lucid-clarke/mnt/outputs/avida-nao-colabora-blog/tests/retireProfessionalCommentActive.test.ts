import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// PR3 — aposentar "Comentário profissional" como funcionalidade ATIVA:
// não deve mais ser gerado, ofertado, ou aparecer em filas/cards/menus/
// seleção manual do Admin. Dados e rotas históricas continuam legíveis.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('refreshTasksForAllUsers não cria mais tarefas de comentário profissional', () => {
  const src = read('src/lib/personalizationTasks.ts')
  assert.doesNotMatch(src, /key:\s*'professional_comment'/)
  assert.match(src, /aposentado como recurso comercial/i)
})

test('AIContentAssistant não oferece mais gerar rascunho de comentário profissional', () => {
  const src = read('src/components/admin/AIContentAssistant.tsx')
  assert.doesNotMatch(src, /'professional_comment'/)
  assert.doesNotMatch(src, /Gerar rascunho de comentário/)
})

test('aiContent.ts não expõe mais gerador de rascunho de comentário profissional (função sem chamadores)', () => {
  const src = read('src/lib/aiContent.ts')
  assert.doesNotMatch(src, /generateProfessionalCommentDraft/)
})

test('Admin: card de fila e contagem de comentários pendentes removidos do Overview', () => {
  const src = read('src/components/admin/AdminOverview.tsx')
  assert.doesNotMatch(src, /pendingComments/)
  assert.doesNotMatch(src, /Comentários profissionais pendentes/)
})

test('Admin: notificação manual não pode mais apontar para a tela de comentário profissional', () => {
  const src = read('src/components/admin/AdminNotifications.tsx')
  assert.doesNotMatch(src, /option value="professional-comments"/)
})

test('Relatório mensal não oferece mais "Comentário do profissional" como seção ativa', () => {
  const src = read('src/components/MyReportPageContent.tsx')
  assert.doesNotMatch(src, /function ProfessionalComment\b/)
  assert.doesNotMatch(src, /<ProfessionalComment\b/)
  assert.doesNotMatch(src, /title="Comentário do profissional"/)
  assert.match(src, /aposentado como recurso ativo do Plus/i)
})

test('rota antiga /comentarios-profissional vira aviso de recurso descontinuado, com histórico preservado', () => {
  const nav = read('src/lib/navigation.ts')
  assert.match(nav, /'\/comentarios-profissional':\s+'professional-comments'/)

  const section = read('src/components/ProfessionalCommentsSection.tsx')
  assert.match(section, /descontinuado/i)
  assert.match(section, /professional_comments/) // continua lendo o histórico
  assert.doesNotMatch(section, /onNavigatePricing/) // não oferece mais como upsell comercial

  const app = read('src/App.tsx')
  assert.match(app, /onNavigateGuidance=\{\(\) => navigate\('monthly-guidance'\)\}/)
})

test('export-user-data continua exportando o histórico de professional_comments (compatibilidade)', () => {
  const fn = read('supabase/functions/export-user-data/index.ts')
  assert.match(fn, /professional_comments/)
})
