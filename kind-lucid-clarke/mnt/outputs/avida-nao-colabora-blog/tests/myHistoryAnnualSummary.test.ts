import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildMyHistory, type MyHistoryEntry } from '../src/lib/myHistory.ts'

const page = readFileSync(new URL('../src/components/MyHistoryPage.tsx', import.meta.url), 'utf8')

function entriesAcrossMonths(year: string, months: string[], daysPerMonth: number): MyHistoryEntry[] {
  const out: MyHistoryEntry[] = []
  for (const month of months) {
    for (let day = 1; day <= daysPerMonth; day++) {
      out.push({ date: `${year}-${month}-${String(day).padStart(2, '0')}`, entry_type: 'diary', mood: 'Ansiedade', context_tags: ['trabalho'] })
    }
  }
  return out
}

test('resumo anual só aparece quando o ano tem >=20 dias ativos em pelo menos 2 meses distintos', () => {
  const enough = buildMyHistory(entriesAcrossMonths('2026', ['01', '02'], 12), [])
  assert.equal(enough.years.length, 1)
  assert.equal(enough.years[0].year, '2026')
  assert.equal(enough.years[0].activeDays, 24)
  assert.equal(enough.years[0].monthsWithData, 2)
})

test('ano com poucos dias ou um único mês não gera resumo anual (nunca inventa)', () => {
  const tooFew = buildMyHistory(entriesAcrossMonths('2026', ['01'], 15), [])
  assert.equal(tooFew.years.length, 0, 'um único mês não deveria virar "resumo do ano"')
  const notEnoughDays = buildMyHistory(entriesAcrossMonths('2026', ['01', '02'], 5), [])
  assert.equal(notEnoughDays.years.length, 0, '10 dias no total é pouco pra um resumo anual')
})

test('resumo anual traz emoção e contexto mais presentes do ano, calculados por dia (não por registro)', () => {
  const model = buildMyHistory(entriesAcrossMonths('2026', ['01', '02'], 12), [])
  assert.equal(model.years[0].topEmotion?.label, 'Ansiedade')
  assert.equal(model.years[0].topContext?.label, 'trabalho')
})

test('página mostra o card "Resumo por ano" só quando history.years não está vazio', () => {
  assert.match(page, /history\.years\.length>0&&<Card/)
  assert.match(page, /Resumo por ano/)
})

test('filtro de marcos distingue "Pessoais" de "Automáticos" e nunca mistura os rótulos', () => {
  assert.match(page, /milestoneFilter/)
  assert.match(page, /'personal','Pessoais'/)
  assert.match(page, /'automatic','Automáticos'/)
  assert.match(page, /Identificado automaticamente/)
})
