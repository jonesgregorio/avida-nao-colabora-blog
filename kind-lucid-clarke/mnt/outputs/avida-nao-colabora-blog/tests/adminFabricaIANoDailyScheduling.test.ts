import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// Decisão definitiva de produto: geração em massa cria rascunhos e não presume
// uma publicação por dia. Planejamento de datas acontece depois, no Calendário.
test('Fábrica IA em massa não agenda conteúdos em datas diárias consecutivas', () => {
  const src = read('src/components/admin/AdminFabricaIA.tsx')

  assert.doesNotMatch(src, /i\s*\*\s*86400000/)
  assert.doesNotMatch(src, /from\('editorial_calendar'\)\.insert/)
  assert.doesNotMatch(src, /scheduled_date:/)
  assert.match(src, /Cada tema vira somente um rascunho/)
  assert.match(src, /calendário fica livre para planejamento manual/i)
})
