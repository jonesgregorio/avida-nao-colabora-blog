import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const weekly = readFileSync(new URL('../src/components/WeeklyReportMockup.tsx', import.meta.url), 'utf8')
const monthly = readFileSync(new URL('../src/components/MonthlyDeepReportMockup.tsx', import.meta.url), 'utf8')

test('relatórios atuais não exibem atalhos para a tela legada', () => {
  assert.doesNotMatch(weekly, /Explorar relatório completo/)
  assert.doesNotMatch(monthly, /Explorar dados completos/)
  assert.doesNotMatch(weekly, /onClick=\{onOpenFullReport\}/)
  assert.doesNotMatch(monthly, /onClick=\{onOpenFullReport\}/)
})
