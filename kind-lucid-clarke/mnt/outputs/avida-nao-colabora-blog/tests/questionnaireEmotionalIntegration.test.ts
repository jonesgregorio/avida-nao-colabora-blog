import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const runner = readFileSync(join(root, 'supabase/functions/run-emotional-automations/runner.ts'), 'utf8')
const map = readFileSync(join(root, 'src/components/MyEvolutionPage.tsx'), 'utf8')

test('automação emocional usa apenas sinais estruturados dos questionários', () => {
  assert.match(runner, /from\('questionnaire_responses'\)/)
  assert.match(runner, /select\('questionnaire_id,total_score,generated_tags,result_id,completed_at'\)/)
  const loader = runner.slice(runner.indexOf('async function loadQuestionnaireSignals'), runner.indexOf('async function log'))
  assert.doesNotMatch(loader, /\.select\([^)]*answers[^)]*\)/s)
  assert.match(runner, /questionnaire_signals: questionnaireSummaryOf\(questionnaireSignals\)/)
  assert.match(runner, /Nenhuma resposta aberta de questionário é fornecida/)
  assert.match(runner, /não pode ser comparada entre questionários diferentes/)
  assert.match(runner, /nunca trate um único resultado ou tag de questionário como recorrência, padrão, diagnóstico, causa ou prova/)
})

test('relatórios e plano de autocuidado recebem os sinais do período sem alterar as métricas do diário', () => {
  assert.match(runner, /loadQuestionnaireSignals\(admin, profile\.user_id, job\.start, job\.end\)/)
  assert.match(runner, /loadQuestionnaireSignals\(admin, profile\.user_id, careStart, careEnd\)/)
  assert.match(runner, /summaryOf\(\(rows \|\| \[\]\).*questionnaireSignals\)/s)
  assert.match(runner, /questionnaire_signals: s\.questionnaire_signals/)
  assert.match(runner, /total_entries: rows\.length/)
  assert.match(runner, /active_days: days\.size/)
})

test('Mapa Emocional mostra questionários como contexto separado e não lê respostas abertas', () => {
  assert.match(map, /Questionários que complementam este mês/)
  assert.match(map, /Suas respostas abertas não são lidas nesta análise/)
  assert.match(map, /Esses sinais não alteram suas médias de humor, energia ou ansiedade/)
  assert.match(map, /select\('questionnaire_id,total_score,generated_tags,result_id,completed_at'\)/)
  const hook = map.slice(map.indexOf('function useQuestionnaireSignals'), map.indexOf('function QuestionnaireSignalsCard'))
  assert.doesNotMatch(hook, /\.select\([^)]*answers[^)]*\)/s)
})
