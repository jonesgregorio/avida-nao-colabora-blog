import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildPhraseRequest } from '../src/lib/estudioPrompts.ts'

const estudio = readFileSync(new URL('../src/components/admin/AdminEstudio.tsx', import.meta.url), 'utf8')
const ai = readFileSync(new URL('../src/lib/estudioAi.ts', import.meta.url), 'utf8')

test('prompt da frase pede título visual curto, não legenda', () => {
  const p = buildPhraseRequest({ ideia: 'não precisar dar conta de tudo', objetivos: ['salvar'], estilo: 'template' })
  assert.match(p, /FRASE que vai dentro de uma arte/)
  assert.match(p, /no máximo 12 palavras/)
  assert.match(p, /Não é legenda nem hashtag/)
  assert.match(p, /"frase":/)
  assert.match(p, /"alternativas":/)
})

test('generatePhrase existe e reusa generate-content', () => {
  assert.match(ai, /export async function generatePhrase/)
  assert.match(ai, /'estudio-phrase'/)
})

test('a frase e a imagem são opcionais — a IA completa o que faltar ao gerar', () => {
  assert.match(estudio, /a IA preenche se você deixar em branco/)
  assert.match(estudio, /Deixar a IA completar o que faltar/)
  assert.match(estudio, /const precisaFrase = !draft\.titulo\.trim\(\)/)
  assert.match(estudio, /const precisaImagem = variant === 'pessoa' && !fotoUrl/)
  // no gerar(): completa frase e imagem antes do snapshot
  assert.match(estudio, /if \(autoIA && precisaFrase\)/)
  assert.match(estudio, /if \(autoIA && precisaImagem\)/)
  assert.match(estudio, /deixa o React aplicar o novo estado no palco antes do snapshot/)
})

test('há botão dedicado para a IA escrever só a frase, com alternativas clicáveis', () => {
  assert.match(estudio, /Escrever com a IA/)
  assert.match(estudio, /await generatePhrase\(toBrief\(draft\)\)/)
  assert.match(estudio, /setFraseAlt\(r\.alternativas\)/)
})
