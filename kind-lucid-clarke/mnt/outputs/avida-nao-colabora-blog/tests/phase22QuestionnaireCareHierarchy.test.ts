import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const questionnaires = readFileSync(new URL('../src/components/QuestionnairesPage.tsx', import.meta.url), 'utf8')
const questionnaireLegacy = readFileSync(new URL('../src/components/QuestionnairesPageLegacy.tsx', import.meta.url), 'utf8')
const care = readFileSync(new URL('../src/components/SelfCarePlanPage.tsx', import.meta.url), 'utf8')

test('Fase 22.8 mostra resumo antes do catálogo completo de questionários', () => {
  assert.match(questionnaires, /Um retrato do seu momento/)
  assert.match(questionnaires, /Pode fazer sentido agora/)
  assert.match(questionnaires, /Explorar questionários/)
  assert.match(questionnaires, /<QuestionnairesPageLegacy/)
  assert.match(questionnaireLegacy, /Ordenar questionários/)
  assert.match(questionnaireLegacy, /Suas avaliações/)
})

test('Plano de Autocuidado usa a experiência mensal atual com jornada adaptativa', () => {
  assert.match(care, /Plano de Autocuidado/)
  assert.match(care, /Seu momento · foco deste ciclo/)
  assert.match(care, /Minhas prioridades/)
  assert.match(care, /Meu plano desta semana/)
  assert.match(care, /Hoje pode ajudar/)
  assert.match(care, /O que você está descobrindo/)
  assert.match(care, /Fechamento do ciclo/)
  assert.match(care, /Hoje está difícil\?/)
  assert.match(care, /Como foi o Plano de Autocuidado anterior/)
  assert.match(care, /Histórico do Plano de Autocuidado/)
  assert.match(care, /CarePlanActionFeedback/)
  assert.doesNotMatch(care, /SelfCarePlanPageLegacy|showLegacy/)
})

test('histórico mensal abre em modal e permite reabrir qualquer mês', () => {
  assert.match(care, /role="dialog" aria-modal="true" aria-labelledby="care-history-title"/)
  assert.match(care, /Histórico do Plano de Autocuidado/)
  assert.match(care, /const openPlan=\(id:string\)/)
  assert.match(care, /setSelectedId\(id\)/)
  assert.match(care, /scrollTo\(\{top:0,behavior:'smooth'\}\)/)
  assert.match(care, /Ver Planos de Autocuidado anteriores/)
})

test('explicação do foco permanece disponível', () => {
  assert.match(care, /setDetailsOpen\(true\)/)
  assert.match(care, /Por que este foco\?/)
  assert.match(care, /Por que este foco apareceu/)
})

test('ajustes de apresentação permanecem locais e separados dos dados do plano', () => {
  assert.match(care, /setSettingsOpen\(true\)/)
  assert.match(care, /Ajustes do Plano de Autocuidado/)
  assert.match(care, /setPreferences/)
  assert.match(care, /presentation:'balanced'/)
  assert.match(care, /showReminders:true/)
  assert.match(care, /showDataExplanation:true/)
  assert.match(care, /care-plan-preferences:/)
})

test('feedback do Plano de Autocuidado não usa mecânicas de performance', () => {
  assert.match(care, /Me ajudou/)
  assert.match(care, /Pouco efeito/)
  assert.match(care, /Ainda não tentei/)
  assert.match(care, /Foi difícil hoje/)
  assert.match(care, /Quero adaptar/)
  assert.match(care, /Não combina comigo/)
  assert.match(care, /Sem porcentagem, sequência ou meta/)
  assert.doesNotMatch(care, /\bstreak\b|\bscore\b|<progress\b|role=["']progressbar["']|aria-valuenow/i)
})

test('detalhes continuam sem criar persistência paralela de planos', () => {
  assert.doesNotMatch(questionnaires, /\.insert\(|\.upsert\(/)
  assert.doesNotMatch(care, /\.insert\(|\.upsert\(/)
  assert.match(questionnaires, /rpc\('get_questionnaire_catalog'\)/)
  assert.match(care, /\.from\('monthly_care_plans'\)/)
})

test('resumos não usam mecânicas de pressão', () => {
  assert.doesNotMatch(questionnaires, /\bXP\b|ranking|streak|\d+%|faltam\s+\d+/i)
  assert.doesNotMatch(questionnaires, /<progress\b|role=["']progressbar["']|aria-valuenow/i)
  assert.doesNotMatch(care, /\bXP\b|ranking|streak|faltam\s+\d+/i)
  assert.doesNotMatch(care, /<progress\b|role=["']progressbar["']|aria-valuenow/i)
  assert.match(questionnaires, /Não existe objetivo de completar todos/)
  assert.match(care, /Sem porcentagem, sequência ou meta/)
})
