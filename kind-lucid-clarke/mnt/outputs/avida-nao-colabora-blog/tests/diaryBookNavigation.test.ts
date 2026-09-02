import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const diary = readFileSync(new URL('../src/components/DiaryExperience.tsx', import.meta.url), 'utf8')
const history = readFileSync(new URL('../src/components/DiaryHistorySection.tsx', import.meta.url), 'utf8')
const data = readFileSync(new URL('../src/lib/diaryHistoryData.ts', import.meta.url), 'utf8')

test('escrita e histórico usam livro aberto com vinco central real', () => {
  assert.match(diary, /left-1\/2[\s\S]*-translate-x-1\/2[\s\S]*linear-gradient/)
  assert.match(diary, /grid lg:grid-cols-2/)
  assert.match(diary, /Meu diário/)
  assert.match(history, /left-1\/2[\s\S]*-translate-x-1\/2[\s\S]*linear-gradient/)
  assert.match(history, /grid lg:grid-cols-2/)
})

test('calendário é a navegação principal do histórico e abre só o dia escolhido', () => {
  assert.match(history, /const \[selectedDate, setSelectedDate\]/)
  assert.match(history, /onClick=\{\(\) => setSelectedDate\(date\)\}/)
  assert.match(history, /const selectedRows = groupedHistory\.get\(selectedDate\) \|\| \[\]/)
  assert.match(history, /Página deste dia/)
  assert.doesNotMatch(history, /Folhear registros anteriores/)
})

test('histórico navega por meses e busca somente o mês selecionado', () => {
  assert.match(history, /setViewMonth\(value => shiftMonth\(value, -1\)\)/)
  assert.match(history, /setViewMonth\(value => shiftMonth\(value, 1\)\)/)
  assert.match(history, /loadDiaryMonth\(userId, viewMonth\)/)
  assert.match(data, /\.gte\('date', start\)/)
  assert.match(data, /\.lt\('date', endExclusive\)/)
  assert.match(data, /\.eq\('user_id', userId\)/)
})
