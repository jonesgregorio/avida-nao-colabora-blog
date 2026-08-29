import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const base = read('src/components/report/ReportReadingBase.tsx')
const retrospective = read('src/components/report/WeeklyRetrospective.tsx')
const reports = read('src/lib/reportGeneration.ts')
const focusStore = read('src/lib/weeklyFocusStore.ts')

test('relatório semanal fechado ganha retrospectiva depois da base de evidências', () => {
  assert.match(base, /import WeeklyRetrospective/)
  assert.match(base, /content\.kind === 'weekly'/)
  assert.match(base, /<WeeklyRetrospective content=\{content as WeeklyContent\} \/>/)
  const readingBase = base.indexOf('Base desta leitura')
  const retrospectiveMount = base.indexOf('<WeeklyRetrospective')
  assert.ok(readingBase >= 0 && retrospectiveMount > readingBase)
})

test('retrospectiva usa período carregado apenas em memória e não muda persistência do relatório', () => {
  assert.match(reports, /__view_period\?: \{ start: string; end: string \}/)
  assert.match(reports, /__view_period: \{ start: report\.period_start, end: report\.period_end \}/)
  const loadHistory = reports.slice(reports.indexOf('export async function loadReportHistory'))
  assert.doesNotMatch(loadHistory, /\.insert\(|\.update\(|\.upsert\(/)
  assert.match(reports, /nunca é persistido/i)
})

test('foco exibido pertence exatamente à semana do relatório e é somente leitura', () => {
  assert.match(retrospective, /loadWeeklyFocusForWeek\(userId, period\.start\)/)
  assert.match(focusStore, /export async function loadWeeklyFocusForWeek/)
  const lookupStart = focusStore.indexOf('export async function loadWeeklyFocusForWeek')
  const lookupEnd = focusStore.indexOf('export async function loadWeeklyFocusState')
  const lookup = focusStore.slice(lookupStart, lookupEnd)
  assert.match(lookup, /from\('user_weekly_focus'\)/)
  assert.match(lookup, /\.eq\('week_start', weekStart\)/)
  assert.doesNotMatch(lookup, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/)
})

test('retrospectiva não relê texto livre nem cria uma segunda geração de relatório', () => {
  assert.doesNotMatch(retrospective, /diary_entries|free_note|diary_text|\.select\('text|invoke\(|generate/i)
  assert.doesNotMatch(focusStore.slice(0, focusStore.indexOf('export async function loadWeeklyFocusState')), /diary_entries|free_note|diary_text/)
  assert.doesNotMatch(retrospective, /inteligência artificial|\bIA\b|prompt|provider/i)
})

test('linguagem da retrospectiva evita causa, diagnóstico e gamificação', () => {
  assert.match(retrospective, /não significam diagnóstico nem demonstram causa/i)
  assert.match(retrospective, /não mede desempenho, progresso ou cumprimento de meta/i)
  assert.match(retrospective, /Não precisa virar tarefa, sequência ou obrigação/i)
  assert.doesNotMatch(retrospective, /\bXP\b|streak|sementes|ranking|pontos ganhos|recompensa/i)
})

test('relatório mensal continua fora da nova retrospectiva semanal', () => {
  assert.match(base, /content\.kind === 'weekly'/)
  assert.doesNotMatch(base, /content\.kind === 'monthly'.*WeeklyRetrospective/s)
})
