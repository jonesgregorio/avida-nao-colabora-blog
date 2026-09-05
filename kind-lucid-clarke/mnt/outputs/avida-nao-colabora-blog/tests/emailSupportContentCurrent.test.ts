import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const migration = readFileSync(
  resolve(root, 'supabase/migrations/20260905010500_revisar_emails_e_templates_suporte.sql'),
  'utf8',
)

test('templates automáticos aposentam comentário profissional e lembretes legados', () => {
  assert.match(migration, /professional_comment_available[\s\S]*checkin_reminder[\s\S]*reengagement_inactive/)
  assert.match(migration, /UPDATE email_templates SET is_active = false/)
})

test('e-mails usam as regras atuais de Check-in e Diário', () => {
  assert.match(migration, /Check-in é um registro rápido, uma vez por dia/)
  assert.match(migration, /até 5 dias com registros por mês/)
  assert.match(migration, /Check-in diário continua sendo um recurso separado/)
})

test('retorno ao Gratuito lista apenas recursos atuais', () => {
  assert.match(migration, /Diário por voz/)
  assert.match(migration, /visão inicial da Minha História/)
  assert.match(migration, /seleção de Conteúdos Guiados/)
})

test('comunicação do Plus usa recursos atuais sem comentário profissional', () => {
  assert.match(migration, /Aprofundamentos do Diário \(até 3 por dia\)/)
  assert.match(migration, /Relatório Mensal Aprofundado/)
  assert.match(migration, /Plano de Autocuidado Mensal/)
  assert.match(migration, /Orientação Mensal/)
  assert.match(migration, /WHERE title = 'Comentário sobre relatório do mês'/)
})

test('Orientação Mensal informa regras operacionais atuais', () => {
  assert.match(migration, /solicitação pode ser enviada até o dia 23/)
  assert.match(migration, /em até 7 dias corridos/)
  assert.match(migration, /uma vez por mês/i)
})

test('novos modelos cobrem recursos centrais sem resposta pronta anterior', () => {
  for (const title of [
    'Check-in e Diário: qual a diferença?',
    'Aprofundamentos do Diário',
    'Mapa Emocional',
    'Descobertas',
    'Minha História',
    'Meu Jardim',
    'Relatório Semanal e Relatório Mensal',
    'Plano de Autocuidado Mensal',
    'Orientação Mensal: prazos e funcionamento',
    'Confirmação de e-mail',
    'Mudança de plano',
    'Dados preservados após downgrade ou cancelamento',
  ]) assert.match(migration, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})
