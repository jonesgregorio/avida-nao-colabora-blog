import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../src/components/SelfCarePlanPage.tsx', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20260908211000_living_self_care_plan.sql', import.meta.url), 'utf8')

test('living self-care plan is action-oriented rather than a second report', () => {
  assert.match(page, /Para experimentar/)
  assert.match(page, /Frente \{pi\+1\}/)
  assert.match(page, /Meu plano ativo/)
  assert.match(page, /Hoje está difícil\?/)
  assert.match(page, /Ajustar meu plano/)
  assert.match(page, /Fiz e me ajudou/)
  assert.match(page, /Sem meta ou sequência/)
})

test('insufficient activity has a gentle transparent explanation', () => {
  assert.match(page, /insufficient_activity/)
  assert.match(page, /Preferimos não preencher seu espaço com sugestões genéricas/)
  assert.match(page, /Para o próximo ciclo/)
  assert.match(page, /Não há falha ou atraso da sua parte/)
})

test('action state is private to its owner and admin is read-only', () => {
  assert.match(migration, /auth\.uid\(\) = user_id/)
  assert.match(migration, /care_plan_action_state_admin[\s\S]*FOR SELECT/)
  assert.doesNotMatch(migration, /care_plan_action_state_admin[\s\S]{0,120}FOR ALL/)
})
