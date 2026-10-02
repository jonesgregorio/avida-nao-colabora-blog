import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const root = new URL('../', import.meta.url)
const sender = fs.readFileSync(new URL('supabase/functions/send-transactional-email/index.ts', root), 'utf8')
const migration = fs.readFileSync(new URL('supabase/migrations/20261002154000_plan_email_benefits.sql', root), 'utf8')

test('benefícios dos e-mails acompanham a oferta oficial atual', () => {
  assert.match(sender, /free:[\s\S]*Check-in diário — 1 por dia[\s\S]*Diário emocional — até 5 dias por mês[\s\S]*Minha História — visão inicial/)
  assert.match(sender, /essential:[\s\S]*Diário emocional — sem limite mensal[\s\S]*Mapa Emocional — completo[\s\S]*Descobertas[\s\S]*Relatório Semanal[\s\S]*Meu Jardim/)
  assert.match(sender, /plus:[\s\S]*Tudo o que está disponível no Essencial[\s\S]*Aprofundamentos do Diário — até 3 por dia[\s\S]*Relatório Mensal Aprofundado[\s\S]*Plano de Autocuidado Mensal[\s\S]*Orientação Mensal/)
})

test('ativação, upgrade, downgrade e retorno ao gratuito resolvem benefícios pelo plano de destino', () => {
  assert.match(sender, /templateKey === 'plan_returned_to_free'\) plan = 'free'/)
  assert.match(sender, /templateKey === 'plan_activated'\) plan = canonicalEmailPlan\(vars\.plano\)/)
  assert.match(sender, /templateKey === 'plan_upgraded' \|\| templateKey === 'plan_downgrade_scheduled'/)
  assert.match(sender, /plan = canonicalEmailPlan\(vars\.plano_novo\)/)
  assert.match(sender, /effectiveVariables\.beneficios_do_plano = planBenefits/)
})

test('templates mostram benefícios e deixam claro que há mais detalhes no plano', () => {
  for (const key of ['plan_activated', 'plan_upgraded', 'plan_downgrade_scheduled', 'plan_returned_to_free']) {
    assert.match(migration, new RegExp(`template_key = '${key}'`))
  }
  assert.ok((migration.match(/\{\{beneficios_do_plano\}\}/g) ?? []).length >= 4)
  assert.ok((migration.match(/E muito mais/g) ?? []).length >= 3)
  assert.match(migration, /Seus dados e registros continuam preservados/)
})
