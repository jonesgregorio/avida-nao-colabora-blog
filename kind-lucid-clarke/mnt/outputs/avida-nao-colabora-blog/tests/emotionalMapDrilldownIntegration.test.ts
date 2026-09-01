import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const map = readFileSync(new URL('../src/components/MyEvolutionPageLegacy.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const panel = readFileSync(new URL('../src/components/EmotionalDrilldownPanel.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const engine = readFileSync(new URL('../src/lib/emotionalDrilldown.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('Mapa Emocional integra exploração por emoção dentro da aba de gráficos', () => {
  assert.match(map, /import EmotionalDrilldownPanel/)
  assert.match(map, /<EmotionalDrilldownPanel entries=\{entries\} plan=\{plan\}/)
  assert.match(panel, /Explore uma emoção/)
  assert.match(panel, /Entenda como ela aparece na sua história/)
  assert.match(panel, /Dias relacionados/)
})

test('investigação deixa explícito que relações não são causas', () => {
  assert.match(panel, /relações observadas, não causas/)
  assert.match(panel, /não afirma que um contexto ou gatilho causou a emoção/)
  assert.match(panel, /poucos dias para falar em padrão/)
})

test('drilldown não cria consulta paralela nem relê texto livre do Diário', () => {
  assert.doesNotMatch(panel, /supabase|\.from\('diary_entries'\)/)
  assert.doesNotMatch(engine, /supabase|free_note|\btext\b|recurring_thoughts/)
  assert.match(panel, /sem ler o texto do seu Diário/)
  assert.match(panel, /O texto escrito no Diário não aparece aqui/)
})

test('gatilhos no drilldown continuam condicionados ao Plus', () => {
  assert.match(panel, /hasPlanAccess\(plan, 'plus'\)/)
  assert.match(engine, /includeTriggers/)
})
