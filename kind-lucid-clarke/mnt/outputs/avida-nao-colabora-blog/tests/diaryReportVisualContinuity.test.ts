import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const report = readFileSync(new URL('../src/components/MyReportPage.tsx', import.meta.url), 'utf8')
const diaryDetails = readFileSync(new URL('../src/components/DiaryDetailsDrawer.tsx', import.meta.url), 'utf8')

test('detalhes do relatório continuam dentro da mesma linguagem visual da retrospectiva', () => {
  assert.match(report, /Detalhes da sua retrospectiva/); assert.match(report, /Leitura aprofundada/); assert.match(report, /Gráficos e sinais/); assert.match(report, /Padrões e comparações/); assert.match(report, /Histórico/); assert.match(report, /PDF e exportação/); assert.match(report, /data-report-details-surface/); assert.match(report, /Voltar ao resumo/); assert.match(report, /onBack=\{\(\) => setShowDetails\(false\)\}/)
})

test('detalhes do diário permanecem em modal central e agora seguem a hierarquia curta do mockup', () => {
  assert.match(diaryDetails, /Informações do registro/)
  assert.match(diaryDetails, /Preencha apenas se fizer sentido/)
  assert.match(diaryDetails, /energyOpen/)
  assert.match(diaryDetails, /feelingsOpen/)
  assert.match(diaryDetails, /contextOpen/)
  assert.match(diaryDetails, /needsOpen/)
  assert.match(diaryDetails, /careOpen/)
  assert.match(diaryDetails, /Salvar detalhes/)
  assert.doesNotMatch(diaryDetails, /md:right-0/)
  assert.doesNotMatch(diaryDetails, /md:rounded-l-\[2rem\]/)
})