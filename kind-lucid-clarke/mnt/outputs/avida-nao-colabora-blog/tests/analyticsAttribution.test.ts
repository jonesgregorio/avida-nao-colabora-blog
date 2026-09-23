import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('aquisição não chama ausência de sinal de Direto e reconhece identificadores de campanha', () => {
  const analytics = read('src/lib/analytics.ts')
  assert.match(analytics, /Origem não identificada/)
  assert.doesNotMatch(analytics, /if \(!h\) return 'Direto'/)
  for (const id of ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid']) assert.ok(analytics.includes(id), `click-id ausente: ${id}`)
  assert.match(analytics, /persisted_first_touch/)
  assert.match(analytics, /FIRST_TOUCH_KEY/)
})

test('aquisição exclui admin e não persiste o valor sensível dos click-ids', () => {
  const analytics = read('src/lib/analytics.ts')
  assert.match(analytics, /location\.pathname\.startsWith\('\/admin\/'\)/)
  assert.match(analytics, /click_id_type/)
  assert.doesNotMatch(analytics, /metadata:\s*\{[^}]*gclid:/s)
})

test('card do Admin pagina todos os eventos e explica origem não identificada', () => {
  const card = read('src/components/admin/AdminVisitsSourceCard.tsx')
  assert.match(card, /collectAllPages/)
  assert.doesNotMatch(card, /\.limit\(20000\)/)
  assert.match(card, /row\.entity_id === 'Direto' \? 'Origem não identificada'/)
  assert.match(card, /Não tratamos mais isso como “Direto”/)
  assert.match(card, /Entrada \{path\}/)
})
