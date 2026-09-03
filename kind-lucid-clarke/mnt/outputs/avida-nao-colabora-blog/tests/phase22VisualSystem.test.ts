import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const principles = readFileSync(new URL('../docs/ux-visual-system-phase22.md', import.meta.url), 'utf8')
const home = readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8')
const diary = readFileSync(new URL('../src/components/DiaryPage.tsx', import.meta.url), 'utf8')
const discoveries = readFileSync(new URL('../src/components/DescobertasPage.tsx', import.meta.url), 'utf8')
const map = readFileSync(new URL('../src/components/MyEvolutionPage.tsx', import.meta.url), 'utf8')
const reports = readFileSync(new URL('../src/components/MyReportPage.tsx', import.meta.url), 'utf8')
const care = readFileSync(new URL('../src/components/CuidarPage.tsx', import.meta.url), 'utf8')

test('22.10 centraliza o acabamento visual sem criar uma segunda arquitetura', () => {
  assert.match(css, /--avnc-surface-shadow/)
  assert.match(css, /--avnc-focus-ring/)
  assert.match(css, /rounded-3xl\.border\.border-line/)
  assert.match(css, /border-dashed\.rounded-2xl/)
  assert.match(css, /focus-visible/)
  assert.match(principles, /Acabamento, não reconstrução/)
  assert.match(principles, /Estados vazios são calmos/)
})

test('largura continua contextual: leitura concentrada e superfícies editoriais amplas quando necessário', () => {
  assert.match(diary, /max-w-4xl/)
  assert.match(discoveries, /max-w-5xl/)
  assert.match(map, /max-w-4xl/)
  assert.match(reports, /max-w-6xl/)
  assert.match(care, /max-w-4xl/)
  assert.match(home, /max-w-6xl/)
  assert.match(css, /main > :where\(\.max-w-4xl, \.max-w-5xl, \.max-w-6xl\)/)
})

test('22.10 não reintroduz pressão de completude ou gamificação', () => {
  assert.doesNotMatch(principles, /\bXP\b|ranking de usuários|streak obrigatório|meta de 7\/7|barra de progresso obrigatória/i)
  assert.match(principles, /não pode trazer de volta vários CTAs concorrentes/)
  assert.match(principles, /Mobile continua primeiro/)
})
