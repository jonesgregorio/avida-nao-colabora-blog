import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const enhancer = readFileSync(new URL('../src/lib/adminSupportComposerEnhancements.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('composer do suporte fica ainda maior e continua redimensionável', () => {
  assert.match(enhancer, /compact \? '190px' : '230px'/)
  assert.match(enhancer, /compact \? '44vh' : '48vh'/)
  assert.match(enhancer, /setProperty\('resize', 'vertical', 'important'\)/)
  assert.match(enhancer, /startsWith\('Digite sua resposta'\)/)
  assert.match(enhancer, /startsWith\('Escreva uma nota interna'\)/)
})

test('lista de respostas prontas mostra prévia antes do uso', () => {
  assert.match(enhancer, /support_reply_templates/)
  assert.match(enhancer, /PREVIEW_LIMIT = 220/)
  assert.match(enhancer, /Prévia:/)
  assert.match(enhancer, /line-clamp-3/)
  assert.match(enhancer, /max-height', '390px'/)
})

test('melhoria é inicializada junto com a aplicação', () => {
  assert.match(main, /initAdminSupportComposerEnhancements/)
  assert.match(main, /initAdminSupportComposerEnhancements\(\)/)
})
