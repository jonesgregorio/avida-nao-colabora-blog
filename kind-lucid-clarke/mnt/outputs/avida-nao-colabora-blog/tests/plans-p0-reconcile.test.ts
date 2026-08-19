import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260819210600_plans_p0_reconcile.sql', import.meta.url),
  'utf8',
)
const officialPlans = readFileSync(new URL('../src/lib/officialPlans.ts', import.meta.url), 'utf8')

test('P0 mantém somente os três planos comerciais oficiais', () => {
  assert.match(officialPlans, /export type PlanKey = 'free' \| 'essential' \| 'plus'/)
  assert.match(migration, /'free',\s+'Gratuito',\s+'R\$ 0'/)
  assert.match(migration, /'essential',\s+'Essencial',\s+'R\$ 19,90'/)
  assert.match(migration, /'plus',\s+'Plus',\s+'R\$ 39,90'/)
  assert.match(migration, /plan_key IN \('therapeutic', 'therapeutic-plus', 'therapeutic_plus'\)/)
})

test('P0 repara as colunas de herança esperadas pelo AdminPlans', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS inherit_previous_plan/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS inherits_from_plan_key/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS show_inherited_as_single_item/)
  assert.match(migration, /inherits_from_plan_key='free'/)
  assert.match(migration, /inherits_from_plan_key='essential'/)
})

test('P0 elimina concessões antigas dos planos atuais e reconstrói matriz 4-9-13', () => {
  assert.match(migration, /DELETE FROM public\.plan_feature_access/)
  assert.match(migration, /plan_key IN \('free', 'essential', 'plus'\)/)
  assert.match(migration, /Matriz exata: Gratuito=4, Essencial=9 .* Plus=13/)
  assert.match(migration, /expected|esperado 39 linhas de acesso/i)
  assert.match(migration, /monthly_message_guidance/)
  assert.doesNotMatch(officialPlans, /monthly_psychoanalyst_session_30min.*name:/)
})

test('Essencial permanece recomendado nas duas colunas legadas de configuração', () => {
  assert.match(migration, /'essential', 'Essencial', 'R\$ 19,90',[\s\S]*?true,\s+true,\s+true/)
  assert.match(migration, /recommended=true AND is_recommended=true/)
})
