import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const wrapper = readFileSync(new URL('../src/components/MyReportPage.tsx', import.meta.url), 'utf8')
const content = readFileSync(new URL('../src/components/MyReportPageContent.tsx', import.meta.url), 'utf8')

describe('Relatórios — navegação do Ver todos', () => {
  it('mantém os filtros de tipo dos dois botões', () => {
    expect(content).toContain("onClick={() => setTypeFilter('weekly')}")
    expect(content).toContain("onClick={() => setTypeFilter('monthly')}")
  })

  it('leva o usuário até o histórico após clicar em Ver todos', () => {
    expect(wrapper).toContain("const HISTORY_HEADING = 'Histórico de relatórios'")
    expect(wrapper).toContain("startsWith('Ver todos')")
    expect(wrapper).toContain("history.id = 'report-history'")
    expect(wrapper).toContain("history.scrollIntoView({ behavior: 'smooth', block: 'start' })")
  })
})
