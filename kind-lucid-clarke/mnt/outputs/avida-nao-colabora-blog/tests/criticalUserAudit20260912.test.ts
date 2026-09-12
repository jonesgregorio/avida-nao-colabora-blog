import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('planos deixam explícita a diferença entre os catálogos guiados', () => {
  const official = read('src/lib/officialPlans.ts')
  const pricing = read('src/components/Pricing.tsx')
  const myPlan = read('src/lib/planCatalogPresentation.ts')
  for (const source of [official, pricing, myPlan]) {
    assert.match(source, /Catálogo Essencial/)
    assert.match(source, /exclusivos(?: Plus)?/i)
  }
})

test('orientação mensal identifica profissional, limites e origem automática das demais análises', () => {
  const guidance = read('src/components/MonthlyGuidancePage.tsx')
  const faq = read('src/lib/faqContent.ts')
  for (const source of [guidance, faq]) assert.match(source, /profissional habilitado/i)
  assert.match(guidance, /Mapas, relatórios e planos são organizados automaticamente a partir do seu uso/)
  assert.match(faq, /não é psicoterapia, consulta, diagnóstico ou acompanhamento continuado/i)
})

test('relatórios corrigem data ausente, concatenação e período entre meses', () => {
  const monthly = read('src/components/MonthlyDeepReportMockup.tsx')
  const generation = read('src/lib/reportGeneration.ts')
  const weekly = read('src/components/WeeklyReportMockup.tsx')
  assert.match(monthly, /c\.attention_days\?\?c\.attentionDays/)
  assert.match(monthly, /c\.improvement_signals\?\.length/)
  assert.match(generation, /date \? date\.slice\(-2\)/)
  assert.match(weekly, /formatPeriodLong/)
  assert.match(weekly, /number=\{1\} title="Resumo da semana"/)
})

test('login autenticado não permanece visualmente na rota de login', () => {
  const app = read('src/App.tsx')
  assert.match(app, /if \(isAuthView\) navigate\('home'\)/)
})
