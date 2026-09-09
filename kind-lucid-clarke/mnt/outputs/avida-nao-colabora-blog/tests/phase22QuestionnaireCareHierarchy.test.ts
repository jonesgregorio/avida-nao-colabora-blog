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

test('Plano de Autocuidado usa somente a experiência mensal viva na navegação do usuário', () => {
  assert.match(care, /Plano vivo de autocuidado/i)
  assert.match(care, /Seu foco atual/)
  assert.match(care, /Para experimentar/)
  assert.match(care, /Outras possibilidades para este mês/)
  assert.match(care, /Seu plano neste ciclo/)
  assert.match(care, /Hoje está difícil\?/)
  assert.match(care, /Como foi o plano anterior/)
  assert.match(care, /Seu plano precisa mudar\?/)
  assert.match(care, /Histórico do cuidado/)
  assert.match(care, /CarePlanActionFeedback/)
  assert.doesNotMatch(care, /SelfCarePlanPageLegacy/)
  assert.doesNotMatch(care, /showLegacy/)
  assert.match(careLegacy, /Seus roteiros de cuidado/)
})

test('histórico mensal abre em modal visível e permite reabrir qualquer mês', () => {
  assert.match(care, /role="dialog" aria-modal="true" aria-labelledby="care-history-title"/)
  assert.match(care, /Histórico do cuidado/)
  assert.match(care, /const openPlan=\(id:string\)/)
  assert.match(care, /setSelectedId\(id\)/)
  assert.match(care, /scrollTo\(\{top:0,behavior:'smooth'\}\)/)
  assert.match(care, /Ver planos anteriores/)
  assert.match(care, /Histórico completo/)
})

test('Entender melhor permanece na experiência nova do Plano de Autocuidado', () => {
  assert.match(care, /setDetailsOpen\(true\)/)
  assert.match(care, /Entenda melhor este foco/)
  assert.match(care, /Por que este foco apareceu/)
  assert.match(care, /Este detalhamento faz parte da experiência atual do Plano de Autocuidado/)
})

test('Ajustes de apresentação ficam separados do ajuste do conteúdo do plano', () => {
  assert.match(care, /setSettingsOpen\(true\)/)
  assert.match(care, /Ajustes de apresentação/)
  assert.match(care, /Ajustes do Plano de Autocuidado/)
  assert.match(care, /Como você prefere explorar o plano\?/)
  assert.match(care, /Mostrar lembretes gentis/)
  assert.match(care, /Explicar como os dados entram no plano/)
  assert.match(care, /Ajustar meu plano/)
  assert.match(care, /care-plan-preferences:/)
})

test('feedback do plano vivo não usa mecânicas de performance', () => {
  assert.match(care, /Fiz e me ajudou/)
  assert.match(care, /Fiz, mas não mudou muito/)
  assert.match(care, /Ainda não tentei/)
  assert.match(care, /Hoje não consegui/)
  assert.match(care, /Quero adaptar/)
  assert.match(care, /Não combina comigo/)
  assert.match(care, /Sem meta ou sequência/)
  assert.doesNotMatch(care, /\bstreak\b|\bscore\b|<progress\b|role=["']progressbar["']|aria-valuenow/i)
})

test('detalhes da experiência nova continuam sem criar persistência paralela de planos', () => {
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
