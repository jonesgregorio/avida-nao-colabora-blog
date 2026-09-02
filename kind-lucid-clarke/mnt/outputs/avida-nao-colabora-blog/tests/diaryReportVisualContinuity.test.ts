import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const report = readFileSync(new URL('../src/components/MyReportPage.tsx', import.meta.url), 'utf8')
const diaryDetails = readFileSync(new URL('../src/components/DiaryDetailsDrawer.tsx', import.meta.url), 'utf8')

test('detalhes do relatório continuam dentro da mesma linguagem visual da retrospectiva', () => {
  assert.match(report, /Detalhes da sua retrospectiva/)
  assert.match(report, /Leitura aprofundada/)
  assert.match(report, /Gráficos e sinais/)
  assert.match(report, /Padrões e comparações/)
  assert.match(report, /Histórico/)
  assert.match(report, /PDF e exportação/)
  assert.match(report, /data-report-details-surface/)
  assert.match(report, /Voltar ao resumo/)
  assert.match(report, /onBack=\{\(\) => setShowDetails\(false\)\}/)
})

test('detalhes do diário não voltam para um drawer lateral cheio de tags', () => {
  assert.match(diaryDetails, /Informações do registro/)
  assert.match(diaryDetails, /Seu texto continua sendo a parte principal/)
  assert.match(diaryDetails, /signalsOpen/)
  assert.match(diaryDetails, /feelingsOpen/)
  assert.match(diaryDetails, /contextOpen/)
  assert.match(diaryDetails, /careOpen/)
  assert.match(diaryDetails, /Já adicionado ao registro/)
  assert.match(diaryDetails, /Voltar ao meu registro/)
  assert.doesNotMatch(diaryDetails, /md:right-0/)
  assert.doesNotMatch(diaryDetails, /md:rounded-l-\[2rem\]/)
})
