import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/CuidarPage.tsx', import.meta.url), 'utf8')

test('Fase 22.7 organiza Cuidar em três níveis de decisão', () => {
  const now = page.indexOf('Talvez ajude agora')
  const care = page.indexOf('Seu cuidado')
  const explore = page.indexOf('Explorar')
  assert.ok(now >= 0)
  assert.ok(care > now)
  assert.ok(explore > care)
})

test('recomendação principal fica limitada a uma possibilidade', () => {
  assert.match(page, /source="care"/)
  assert.match(page, /limit=\{1\}/)
  assert.match(page, /Uma possibilidade para este momento/)
})

test('caminhos reais de cuidado continuam disponíveis sem virar catálogo', () => {
  assert.match(page, /Plano de Autocuidado/)
  assert.match(page, /Orientação mensal/)
  assert.match(page, /Conteúdos Guiados/)
  assert.match(page, /onNavigate\(selfCareAccess \? 'self-care' : 'pricing'\)/)
  assert.match(page, /onNavigate\(guidanceAccess \? 'guidance' : 'pricing'\)/)
  assert.match(page, /onNavigate\('articles'\)/)
})

test('Cuidar continua sem mecânicas de pressão ou pontuação', () => {
  assert.match(page, /Cuidar não exige completar uma sequência/)
  assert.doesNotMatch(page, /\bXP\b|ranking|streak|\d+%|faltam\s+\d+|pontos conquistados/i)
  assert.doesNotMatch(page, /progress|aria-valuenow/i)
})
