import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const home = readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8')
const principles = readFileSync(new URL('../docs/ux-hierarchy-phase22.md', import.meta.url), 'utf8')

test('Fase 22 registra regras de hierarquia sem alterar a navegação lateral', () => {
  assert.match(principles, /Uma decisão principal por tela/)
  assert.match(principles, /No máximo dois blocos contextuais/)
  assert.match(principles, /O menu lateral permanece intacto/)
})

test('Hoje mostra avaliação e ações principais antes do aprofundamento', () => {
  assert.match(home, /E aí, a vida colaborou hoje\?/)
  assert.match(home, /Registrar como estou/)
  assert.match(home, /Quero escrever/)
  assert.match(home, /Olhar minha semana/)
  assert.match(home, /detailsOpen &&/)
})

test('camada analítica da Home começa fechada por padrão', () => {
  assert.match(home, /useState\(false\)/)
  assert.match(home, /aria-expanded=\{detailsOpen\}/)
  assert.match(home, /Continuidade, descobertas, foco e conteúdos continuam aqui/)
})
