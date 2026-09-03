import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wrapper = readFileSync(new URL('../src/components/MyReportPage.tsx', import.meta.url), 'utf8')
const content = readFileSync(new URL('../src/components/MyReportPageContent.tsx', import.meta.url), 'utf8')

test('Ver todos mantém os filtros de tipo dos dois blocos', () => {
  assert.match(content, /onClick=\{\(\) => setTypeFilter\('weekly'\)\}/)
  assert.match(content, /onClick=\{\(\) => setTypeFilter\('monthly'\)\}/)
})

test('Ver todos leva o usuário até o histórico após aplicar o filtro', () => {
  assert.match(wrapper, /HISTORY_HEADING = 'Histórico de relatórios'/)
  assert.match(wrapper, /startsWith\('Ver todos'\)/)
  assert.match(wrapper, /history\.id\s*=\s*'report-history'/)
  assert.match(wrapper, /history\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/)
})