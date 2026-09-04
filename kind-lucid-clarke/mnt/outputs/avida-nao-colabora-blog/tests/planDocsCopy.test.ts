import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// PR4 — README, FAQ, Termos e textos de suporte refletem a matriz comercial
// atual e não ofertam mais "Comentário profissional" como recurso do Plus.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('README descreve a matriz oficial atual e não promete mais comentário profissional', () => {
  const readme = read('README.md')
  assert.match(readme, /Check-in diário: 1 por dia/)
  assert.match(readme, /Diário emocional: até 5 dias com registros por mês/)
  assert.match(readme, /Descobertas/)
  assert.match(readme, /Meu Jardim/)
  assert.match(readme, /Aprofundamentos do Diário: até 3 por dia/)
  assert.doesNotMatch(readme, /Check-in rápido ilimitado/)
  assert.doesNotMatch(readme, /Diário completo e complementos/)
  assert.match(readme, /descontinuado como recurso ativo do produto/)
})

test('FAQ fallback usa a matriz atual e não atribui comentário profissional ao Plus', () => {
  const faq = read('src/components/FAQPage.tsx')
  assert.match(faq, /Aprofundamentos do Diário, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal/)
  assert.doesNotMatch(faq, /comentário profissional/i)
})

test('Termos fallback não promete mais comentário profissional como parte do Plus', () => {
  const terms = read('src/components/TermsPage.tsx')
  assert.doesNotMatch(terms, /comentário profissional/i)
  assert.match(terms, /sem substituir psicoterapia, avaliação clínica ou acompanhamento profissional continuado/)
})

test('Privacidade fallback não descreve revisão profissional como recurso ativo', () => {
  const privacy = read('src/components/PrivacyPage.tsx')
  assert.doesNotMatch(privacy, /Em funcionalidades do Plus que incluem revisão profissional/)
  assert.match(privacy, /descontinuado como recurso ativo do produto/)
})

test('respostas prontas de Suporte usam a matriz atual e f13 explica a descontinuação', () => {
  const support = read('src/components/admin/AdminSupport.tsx')
  assert.doesNotMatch(support, /comentário profissional sobre o relatório e orientação/i)
  assert.match(support, /f13.*descontinuado/is)
})

test('migration nova corrige o conteúdo do CMS já semeado em produção sem editar a migration histórica', () => {
  const migration = read('supabase/migrations/20260904190000_retire_professional_comment_site_content.sql')
  assert.match(migration, /update public\.site_pages/)
  assert.match(migration, /update public\.faq_items/)
  assert.match(migration, /where slug = 'termos'/)
  assert.match(migration, /where slug = 'privacidade'/)

  const seed = read('supabase/migrations/20260903120000_site_content_cms.sql')
  assert.match(seed, /comentário profissional/i, 'a migration histórica original não deve ser editada')
})
