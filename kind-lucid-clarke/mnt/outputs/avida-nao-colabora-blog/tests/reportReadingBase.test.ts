import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('relatório explica claramente a base desta leitura', () => {
  const src = read('src/components/report/ReportReadingBase.tsx')
  assert.match(src, /Base desta leitura/)
  assert.match(src, /Confirmado nos registros/)
  assert.match(src, /Leitura contextual/)
  assert.match(src, /Sem dados suficientes/)
  assert.match(src, /item\.count}x/)
  assert.match(src, /Emoção registrada:/)
  assert.match(src, /Marcador emocional:/)
  assert.match(src, /Contexto marcado:/)
  assert.match(src, /Necessidade marcada:/)
  assert.match(src, /Gatilho informado:/)
})

test('base diferencia ocorrência literal, contexto e ausência sem sugerir diagnóstico', () => {
  const src = read('src/components/report/ReportReadingBase.tsx')
  assert.match(src, /contagens representam ocorrências marcadas nos registros/i)
  assert.match(src, /não significam diagnóstico, causa ou certeza/i)
  assert.match(src, /ausência de dados é mostrada explicitamente/i)
  assert.match(src, /questionário.*contexto complementar/i)
  assert.match(src, /title="Contagens são ocorrências registradas\./)
})

test('base da leitura não expõe bastidores de IA ao usuário', () => {
  const src = read('src/components/report/ReportReadingBase.tsx')
  assert.doesNotMatch(src, /inteligência artificial/i)
  assert.doesNotMatch(src, /\bIA\b/)
  assert.doesNotMatch(src, /prompt/i)
  assert.doesNotMatch(src, /provider/i)
})

test('visualizador inclui a base antes do corpo do relatório fechado', () => {
  const src = read('src/components/MyReportPageContent.tsx')
  assert.match(src, /import ReportReadingBase from '\.\/report\/ReportReadingBase'/)
  assert.match(src, /<ReportReadingBase content=\{viewer\.report\.content\} \/>/)
  const baseIndex = src.indexOf('<ReportReadingBase content={viewer.report.content} />')
  const bodyIndex = src.indexOf('<ReportBody report={viewer.report}')
  assert.ok(baseIndex >= 0 && bodyIndex > baseIndex)
})
