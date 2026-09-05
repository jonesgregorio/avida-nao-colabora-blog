import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// README, FAQ, Termos e textos de suporte devem refletir a matriz comercial
// atual e não ofertar mais "Comentário profissional" como recurso do Plus.

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

test('FAQ usa fallback canônico e a matriz atual dos três planos', () => {
  const page = read('src/components/FAQPage.tsx')
  const faq = read('src/lib/faqContent.ts')

  assert.match(page, /FAQ_FALLBACK/)
  assert.match(faq, /Gratuito — começar a se observar/)
  assert.match(faq, /Essencial — entender seus padrões/)
  assert.match(faq, /Plus — transformar entendimento em cuidado/)
  assert.match(faq, /Check-in diário \(1 por dia\)/)
  assert.match(faq, /Diário emocional em até 5 dias por mês/)
  assert.match(faq, /Aprofundamentos do Diário \(até 3 por dia\)/)
  assert.match(faq, /Mapa Emocional/)
  assert.match(faq, /Descobertas/)
  assert.match(faq, /Minha História completa/)
  assert.match(faq, /Meu Jardim/)
  assert.match(faq, /Relatório Mensal Aprofundado/)
  assert.match(faq, /Plano de Autocuidado Mensal/)
  assert.match(faq, /Orientação Mensal/)
  assert.doesNotMatch(faq, /Terapêutico Plus|Plano Terapêutico/i)
  assert.doesNotMatch(faq, /comentário profissional/i)
})

test('FAQ corrige afirmações antigas de conta, reembolso, exportação e privacidade', () => {
  const faq = read('src/lib/faqContent.ts')

  assert.match(faq, /solicite um novo/)
  assert.doesNotMatch(faq, /link expira em 1 hora/i)
  assert.match(faq, /Não há promessa automática de reembolso proporcional por um prazo fixo/)
  assert.doesNotMatch(faq, /oferecemos reembolso proporcional nos primeiros 7 dias/i)
  assert.match(faq, /arquivo ZIP com o JSON completo dos dados, tabelas CSV.*PDF-resumo/s)
  assert.doesNotMatch(faq, /arquivo JSON legível com os dados vinculados/i)
  assert.match(faq, /não são públicos nem ficam disponíveis para leitura livre pela equipe/i)
})

test('FAQ explica corretamente os principais limites e ciclos dos recursos', () => {
  const faq = read('src/lib/faqContent.ts')

  assert.match(faq, /fazer o Check-in não consome um dia do limite mensal do Diário/)
  assert.match(faq, /Um Check-in por dia, em todos os planos/)
  assert.match(faq, /até 5 dias por mês/)
  assert.match(faq, /até 3 aprofundamentos por dia/)
  assert.match(faq, /fecha no sábado e fica disponível no domingo seguinte/)
  assert.match(faq, /fica disponível no primeiro dia do mês seguinte/)
  assert.match(faq, /1 orientação por mês até o dia 23/)
  assert.match(faq, /até 7 dias corridos após o envio/)
})

test('FAQ diferencia Mapa Emocional, Descobertas e Minha História sem linguagem causal', () => {
  const faq = read('src/lib/faqContent.ts')

  assert.match(faq, /como meus registros se distribuíram/i)
  assert.match(faq, /o que está se repetindo/i)
  assert.match(faq, /como minha trajetória foi mudando ao longo do tempo/i)
  assert.match(faq, /não diagnósticos nem conclusões de causa e efeito/i)
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

test('migrations de conteúdo mantêm histórico e versionam o FAQ revisado', () => {
  const retirement = read('supabase/migrations/20260904190000_retire_professional_comment_site_content.sql')
  assert.match(retirement, /update public\.site_pages/)
  assert.match(retirement, /update public\.faq_items/)
  assert.match(retirement, /where slug = 'termos'/)
  assert.match(retirement, /where slug = 'privacidade'/)

  const refreshFaq = read('supabase/migrations/20260905004500_refresh_complete_faq_content.sql')
  assert.match(refreshFaq, /with desired\(category, question, answer, sort_order\)/)
  assert.match(refreshFaq, /Qual a diferença entre Check-in e Diário emocional\?/)
  assert.match(refreshFaq, /O que são Descobertas\?/)
  assert.match(refreshFaq, /Como funciona a Orientação Mensal\?/)
  assert.match(refreshFaq, /where not exists/)

  const seed = read('supabase/migrations/20260903120000_site_content_cms.sql')
  assert.match(seed, /comentário profissional/i, 'a migration histórica original não deve ser editada')
})
