import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const home = readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8')
const card = readFileSync(new URL('../src/components/WeeklyFocusCard.tsx', import.meta.url), 'utf8')
const store = readFileSync(new URL('../src/lib/weeklyFocusStore.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260829174500_user_weekly_focus.sql', import.meta.url), 'utf8')

test('Home Hoje exibe Foco da Semana somente a partir do Essencial', () => {
  assert.match(home, /import WeeklyFocusCard/)
  assert.match(home, /user && weeklyAccess/)
  assert.match(home, /<WeeklyFocusCard userId=\{user\.id\} plan=\{plan\} entries=\{homeEntries\}/)
  assert.match(home, /hasPlanAccess\(plan, 'essential'\)/)
})

test('Foco da Semana reutiliza a consulta estruturada da Home sem texto livre', () => {
  const select = home.match(/\.select\('([^']+)'\)/)?.[1] ?? ''
  const columns = select.split(',').map(column => column.trim()).filter(Boolean)
  for (const column of ['mood', 'energy', 'anxiety_level', 'sleep_quality', 'stress_level', 'overload', 'context_tags', 'trigger_tags', 'emotional_tags', 'need_tags', 'care_action_tags']) {
    assert.ok(columns.includes(column), `esperava coluna estruturada ${column}`)
  }
  assert.equal(columns.includes('text'), false)
  assert.equal(columns.includes('free_note'), false)
  assert.equal(columns.includes('notes'), false)
})

test('persistência mantém uma linha por usuário/semana com RLS e sem gamificação', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.user_weekly_focus/)
  assert.match(migration, /UNIQUE \(user_id, week_start\)/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /auth\.uid\(\) = user_id/)
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE/)
  assert.doesNotMatch(migration, /points|xp|streak|seed|semente|ranking/i)
})

test('reflexão de fechamento é estruturada e não armazena relato livre', () => {
  assert.match(migration, /helped.*somewhat.*not_much.*not_used/s)
  assert.doesNotMatch(migration, /reflection_text|free_text|diary_text/)
  assert.match(card, /Me ajudou/)
  assert.match(card, /Ajudou um pouco/)
  assert.match(card, /Não fez diferença/)
  assert.match(card, /Não usei/)
})

test('foco é lembrado como orientação, não tarefa concluível', () => {
  assert.match(card, /não como uma meta/i)
  assert.match(card, /não vira obrigação nem lista de tarefas/i)
  assert.match(card, /Trocar foco/)
  assert.doesNotMatch(card, /Marcar como feito|pontos|XP|streak|sementes|ranking/i)
})

test('store acessa apenas a tabela própria do foco semanal', () => {
  assert.match(store, /from\('user_weekly_focus'\)/)
  assert.doesNotMatch(store, /diary_entries|\btext\b|free_note|notes/)
})
