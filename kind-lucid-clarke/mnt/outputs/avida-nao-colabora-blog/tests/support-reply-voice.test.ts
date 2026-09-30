import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260930185500_humanizar_respostas_suporte.sql', import.meta.url), 'utf8')

test('respostas prontas adotam tom humano, leve e não culpabilizante', () => {
  assert.match(migration, /Pode explicar do seu jeito/)
  assert.match(migration, /não precisa usar tudo/i)
  assert.match(migration, /sem pressão/i)
  assert.doesNotMatch(migration, /você deveria|você precisa usar todos os dias|falhou em manter|perdeu sua sequência/i)
})

test('templates técnicos explicam próximos passos e protegem dados sensíveis', () => {
  for (const title of [
    'Precisamos de mais informações',
    'Problema técnico em análise',
    'Não consegui reproduzir o erro',
    'Problema resolvido',
    'Não consigo entrar na minha conta',
    'Plano pago ainda não apareceu',
    'Cobrança duplicada ou desconhecida',
  ]) assert.ok(migration.includes(title), `modelo ausente: ${title}`)

  assert.match(migration, /não envie sua senha/i)
  assert.match(migration, /número completo do cartão/i)
  assert.match(migration, /código de segurança/i)
})

test('modelos de planos usam apenas Gratuito, Essencial e Plus e evitam preço hardcoded', () => {
  assert.match(migration, /Gratuito, Essencial e Plus/)
  assert.match(migration, /WHERE title IN \('Plano Terapêutico', 'Plano Terapêutico Plus'/)
  assert.doesNotMatch(migration, /R\$\s*19,90|R\$\s*39,90|R\$\s*79,90/)
  assert.match(migration, /preço e condições atuais/i)
})

test('recursos sensíveis são explicados sem diagnóstico ou promessa clínica', () => {
  assert.match(migration, /não diagnostica/)
  assert.match(migration, /não é uma prescrição/)
  assert.match(migration, /não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência/i)
  assert.doesNotMatch(migration, /garante melhora|cura|diagnóstico automático|tratamento personalizado/i)
})

test('lacunas operacionais recebem respostas completas', () => {
  for (const title of [
    'Como funciona o limite do Diário no Gratuito',
    'Relatório ainda não apareceu',
    'Plano de Autocuidado ainda não está disponível',
    'Orientação Mensal ainda não está disponível',
    'Excluir minha conta',
    'Exportar meus dados',
    'Envio de anexo no suporte',
    'Sugestão recebida',
    'Não substitui atendimento de emergência',
  ]) assert.ok(migration.includes(title), `modelo novo ausente: ${title}`)
})

test('migration mexe apenas na biblioteca de respostas prontas', () => {
  assert.doesNotMatch(migration, /UPDATE\s+(diary_entries|daily_life_collaboration|questionnaire_responses|monthly_reports)/i)
  assert.doesNotMatch(migration, /INSERT INTO\s+(diary_entries|daily_life_collaboration|questionnaire_responses)/i)
  assert.match(migration, /support_reply_templates/)
})
