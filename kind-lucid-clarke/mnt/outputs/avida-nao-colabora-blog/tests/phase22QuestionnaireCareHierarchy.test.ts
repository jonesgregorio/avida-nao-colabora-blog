import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const questionnaires = readFileSync(new URL('../src/components/QuestionnairesPage.tsx', import.meta.url), 'utf8')
const questionnaireLegacy = readFileSync(new URL('../src/components/QuestionnairesPageLegacy.tsx', import.meta.url), 'utf8')
const care = readFileSync(new URL('../src/components/SelfCarePlanPage.tsx', import.meta.url), 'utf8')
const careLegacy = readFileSync(new URL('../src/components/SelfCarePlanPageLegacy.tsx', import.meta.url), 'utf8')

test('Fase 22.8 mostra resumo antes do catálogo completo de questionários', () => {
  assert.match(questionnaires, /Um retrato do seu momento/)
  assert.match(questionnaires, /Pode fazer sentido agora/)
  assert.match(questionnaires, /Explorar questionários/)
  assert.match(questionnaires, /<QuestionnairesPageLegacy/)
  assert.match(questionnaireLegacy, /Ordenar questionários/)
  assert.match(questionnaireLegacy, /Suas avaliações/)
})

test('Plano de Autocuidado mostra foco, ações e histórico mensal antes dos detalhes legados', () => {
  assert.match(care, /Seu foco atual/)
  assert.match(care, /Para experimentar/)
  assert.match(care, /Uma possibilidade/)
  assert.match(care, /Histórico de planos/)
  assert.match(care, /Como foi o plano anterior/)
  assert.match(care, /<SelfCarePlanPageLegacy/)
  assert.match(careLegacy, /Seus roteiros de cuidado/)
  assert.match(care, /CarePlanActionFeedback/)
})

test('detalhes antigos continuam preservados sem criar persistência paralela', () => {
  assert.doesNotMatch(questionnaires, /\.insert\(|\.upsert\(/)
  assert.doesNotMatch(care, /\.insert\(|\.upsert\(/)
  assert.match(questionnaires, /rpc\('get_questionnaire_catalog'\)/)
  assert.match(care, /\.from\('monthly_care_plans'\)/)
})

test('resumos da 22.8 não usam mecânicas de pressão', () => {
  assert.doesNotMatch(questionnaires, /\bXP\b|ranking|streak|\d+%|faltam\s+\d+/i)
  assert.doesNotMatch(questionnaires, /<progress\b|role=["']progressbar["']|aria-valuenow/i)
  assert.doesNotMatch(care, /\bXP\b|ranking|streak|faltam\s+\d+/i)
  assert.doesNotMatch(care, /<progress\b|role=["']progressbar["']|aria-valuenow/i)
  assert.match(questionnaires, /Não existe objetivo de completar todos/)
  assert.match(care, /Sem meta ou sequência/)
})
