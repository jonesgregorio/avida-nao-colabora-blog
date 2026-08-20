import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260820001000_go_live_personalization_consistency.sql', import.meta.url),
  'utf8',
)
const plans = readFileSync(new URL('../src/lib/officialPlans.ts', import.meta.url), 'utf8')

test('filas paralelas dos quatro artefatos oficiais são neutralizadas', () => {
  for (const key of ['self_care_plan','advanced_monthly_report','monthly_plan_review','monthly_guidance']) {
    assert.match(migration, new RegExp(`'${key}'`))
  }
  assert.match(migration, /NEW\.status := 'not_applicable'/)
  assert.match(migration, /status IN \('pending','overdue','draft','generated'\)/)
  assert.match(plans, /Plano de autocuidado mensal/)
  assert.match(plans, /Relatório mensal aprofundado/)
  assert.match(plans, /Orientação mensal por mensagem/)
})

test('delivery profissional enviado ganha reflexo oficial idempotente', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS source_delivery_id uuid/)
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS professional_comments_source_delivery_uidx/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.reflect_sent_professional_comment/)
  assert.match(migration, /NEW\.target_area = 'professional_comments'/)
  assert.match(migration, /NEW\.content_type IN \('professional_comment','report_comment','monthly_report_comment'\)/)
  assert.match(migration, /ON CONFLICT \(source_delivery_id\) DO NOTHING/)
})

test('migration instala triggers para insert e transição para sent', () => {
  assert.match(migration, /professional_comment_delivery_sent_insert/)
  assert.match(migration, /AFTER INSERT ON public\.personalized_content_deliveries/)
  assert.match(migration, /professional_comment_delivery_sent_update/)
  assert.match(migration, /AFTER UPDATE OF status ON public\.personalized_content_deliveries/)
  assert.match(migration, /OLD\.status IS DISTINCT FROM NEW\.status/)
})

test('guardas impedem reabrir duplicatas ou deixar delivery profissional sem reflexo', () => {
  assert.match(migration, /ainda existem % tarefas duplicadas abertas/)
  assert.match(migration, /triggers do comentário profissional incompletos/)
  assert.match(migration, /deliveries profissionais sem reflexo oficial/)
})
