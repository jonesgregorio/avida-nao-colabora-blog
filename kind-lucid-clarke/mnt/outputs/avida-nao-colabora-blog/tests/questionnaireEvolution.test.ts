import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  formatCompletionLabels, describeQuestionnaireTrend, describeQuestionnaireSeries,
  type QuestionnaireCompletion,
} from '../src/lib/questionnaireEvolution.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('rótulos de data mostram só o mês quando o ano não muda, e mês+ano quando muda', () => {
  const sameYear: QuestionnaireCompletion[] = [
    { completedAt: '2026-03-05T00:00:00Z', totalScore: 10, resultTitle: null },
    { completedAt: '2026-05-10T00:00:00Z', totalScore: 8, resultTitle: null },
    { completedAt: '2026-08-01T00:00:00Z', totalScore: 6, resultTitle: null },
  ]
  const labels = formatCompletionLabels(sameYear)
  assert.equal(labels.length, 3)
  assert.doesNotMatch(labels[0], /2026/)

  const crossYear: QuestionnaireCompletion[] = [
    { completedAt: '2025-12-01T00:00:00Z', totalScore: 10, resultTitle: null },
    { completedAt: '2026-02-01T00:00:00Z', totalScore: 8, resultTitle: null },
  ]
  const labelsCross = formatCompletionLabels(crossYear)
  assert.match(labelsCross[0], /2025/)
  assert.match(labelsCross[1], /2026/)
})

test('mudança de resultado gera frase de percepção, nunca "melhorou/piorou clinicamente"', () => {
  const prev: QuestionnaireCompletion = { completedAt: '2026-03-01T00:00:00Z', totalScore: 10, resultTitle: 'Sono irregular' }
  const curr: QuestionnaireCompletion = { completedAt: '2026-05-01T00:00:00Z', totalScore: 4, resultTitle: 'Sono estável' }
  const text = describeQuestionnaireTrend(prev, curr)
  assert.match(text, /Sono irregular/)
  assert.match(text, /Sono estável/)
  assert.doesNotMatch(text, /melhorou|piorou|diagnóstic/i)
})

test('variação pequena de pontuação (dentro do limiar) é tratada como estável', () => {
  const prev: QuestionnaireCompletion = { completedAt: '2026-03-01T00:00:00Z', totalScore: 20, resultTitle: 'Mesmo resultado' }
  const curr: QuestionnaireCompletion = { completedAt: '2026-05-01T00:00:00Z', totalScore: 21, resultTitle: 'Mesmo resultado' }
  assert.match(describeQuestionnaireTrend(prev, curr), /estáveis/)
})

test('variação real de pontuação (mesmo resultado) descreve frequência sem termo clínico', () => {
  const prev: QuestionnaireCompletion = { completedAt: '2026-03-01T00:00:00Z', totalScore: 20, resultTitle: 'Mesmo resultado' }
  const currDown: QuestionnaireCompletion = { completedAt: '2026-05-01T00:00:00Z', totalScore: 10, resultTitle: 'Mesmo resultado' }
  const down = describeQuestionnaireTrend(prev, currDown)
  assert.match(down, /menos frequência/)
  assert.doesNotMatch(down, /melhorou|piorou|diagnóstic|cura/i)

  const currUp: QuestionnaireCompletion = { completedAt: '2026-05-01T00:00:00Z', totalScore: 30, resultTitle: 'Mesmo resultado' }
  assert.match(describeQuestionnaireTrend(prev, currUp), /mais frequência/)
})

test('série com menos de 2 preenchimentos não gera resumo (evita "evolução" de um único ponto)', () => {
  const series = { questionnaireId: 'q1', title: 'Sono', category: 'Sono', completions: [{ completedAt: '2026-03-01T00:00:00Z', totalScore: 10, resultTitle: null }] }
  assert.equal(describeQuestionnaireSeries(series), null)
})

test('página de evolução não expõe termos clínicos nem menciona IA', () => {
  const page = read('src/components/QuestionnaireEvolutionPage.tsx')
  assert.doesNotMatch(page, /diagnóstic|melhorou clinicamente|piorou clinicamente/i)
  assert.doesNotMatch(page, /\bIA\b|intelig[eê]ncia artificial/i)
  assert.match(page, /não é uma avaliação clínica/i)
})

test('link "Ver minha evolução" só aparece para quem já concluiu algum questionário', () => {
  const src = read('src/components/QuestionnairesPage.tsx')
  assert.match(src, /onNavigateEvolution && doneCount > 0/)
})
