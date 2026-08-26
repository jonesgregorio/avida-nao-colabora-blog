import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const diary = readFileSync(new URL('../src/components/DiaryExperience.tsx', import.meta.url), 'utf8')
const history = readFileSync(new URL('../src/components/DiaryHistorySection.tsx', import.meta.url), 'utf8')

test('DiaryExperience delega a apresentação do histórico para componente dedicado', () => {
  assert.match(diary, /import DiaryHistorySection/)
  assert.match(diary, /<DiaryHistorySection/)
  assert.doesNotMatch(diary, /const groupedHistory = useMemo/)
  assert.doesNotMatch(diary, /Sua história deste mês, até aqui/)
  assert.doesNotMatch(diary, /Filtrar período do histórico/)
})

test('DiaryHistorySection concentra calendário, agrupamento, filtros e expansão sem persistência', () => {
  assert.match(history, /const groupedHistory = useMemo/)
  assert.match(history, /Sua história deste mês, até aqui/)
  assert.match(history, /Filtrar período do histórico/)
  assert.match(history, /Exportar PDF/)
  assert.match(history, /Espelho do registro/)
  assert.doesNotMatch(history, /supabase/)
  assert.doesNotMatch(history, /\.insert\(|\.update\(|\.delete\(/)
})
