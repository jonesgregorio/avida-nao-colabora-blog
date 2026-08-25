import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// MISSÃO GERAL final: "AdminAIUsage aparece em Conteúdo & IA E IA Emocional.
// Não duplicar a mesma tela em dois lugares. Criar UMA Central de IA."

test('AdminAIUsage não é mais renderizado em duas áreas do Admin — só em IA Emocional', () => {
  const conteudo = read('src/components/admin/AdminAreaConteudo.tsx')
  const emocional = read('src/components/admin/AdminAreaEmocional.tsx')
  assert.doesNotMatch(conteudo, /AdminAIUsage/)
  assert.match(emocional, /<AdminAIUsage \/>/)
})

test('Conteúdo & IA linka para a Central de IA em vez de duplicar a tela', () => {
  const conteudo = read('src/components/admin/AdminAreaConteudo.tsx')
  assert.match(conteudo, /onOpenCentralIA/)
  const index = read('src/components/admin/index.tsx')
  assert.match(index, /localStorage\.setItem\('admin-emocional-tab', 'uso-ia'\)/)
})

test('Central de IA filtra editorial vs emocional sem duplicar dado (mesma tabela)', () => {
  const src = read('src/components/admin/AdminAIUsage.tsx')
  assert.match(src, /Central de IA/)
  assert.match(src, /const EMOTIONAL_TYPES = new Set\(/)
  assert.match(src, /const visibleLogs = category === 'todos' \? logs : logs\.filter/)
})
