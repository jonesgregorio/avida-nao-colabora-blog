import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../src/components/SelfCarePlanPage.tsx', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20260908211000_living_self_care_plan.sql', import.meta.url), 'utf8')

test('Plano de Autocuidado é orientado a escolhas e experiência, não um segundo relatório', () => {
  assert.match(page, /Minhas prioridades/)
  assert.match(page, /Quero experimentar/)
  assert.match(page, /Meu plano desta semana/)
  assert.match(page, /Hoje está difícil\?/)
  assert.match(page, /Me ajudou/)
  assert.match(page, /Sem porcentagem, sequência ou meta/)
})

test('ações escolhidas ficam explícitas e lideram a experiência de retorno', () => {
  assert.match(page, /escolhidas/)
  assert.match(page, /No meu plano/)
  assert.match(page, /Hoje pode ajudar/)
  assert.match(page, /priorityFor/)
  assert.match(page, /experimentadas/)
  assert.match(page, /ajudando/)
})

test('modo de dia difícil transforma somente ações ativamente escolhidas', () => {
  assert.match(page, /O Plano de Autocuidado pode encolher junto com o seu dia/)
  assert.match(page, /disabled=\{!active\.length\}/)
  assert.match(page, /active\.map/)
  assert.match(page, /Usar esta versão no meu plano/)
  assert.doesNotMatch(page, /active\.length\?active:actions\.slice/)
})

test('histórico, aprendizados e ajustes têm papéis separados', () => {
  assert.match(page, /Histórico do Plano de Autocuidado/)
  assert.match(page, /linha do tempo dos focos/)
  assert.match(page, /Ajustes do Plano de Autocuidado/)
  assert.match(page, /O que você está descobrindo/)
  assert.match(page, /Fechamento do ciclo/)
})

test('atividade insuficiente recebe explicação transparente e gentil', () => {
  assert.match(page, /insufficient_activity/)
  assert.match(page, /Neste ciclo ainda não houve registros suficientes/)
  assert.match(page, /Para o próximo ciclo/)
})

test('estado das ações é privado ao dono e admin permanece somente leitura', () => {
  assert.match(migration, /auth\.uid\(\) = user_id/)
  assert.match(migration, /care_plan_action_state_admin[\s\S]*FOR SELECT/)
  assert.doesNotMatch(migration, /care_plan_action_state_admin[\s\S]{0,120}FOR ALL/)
})
