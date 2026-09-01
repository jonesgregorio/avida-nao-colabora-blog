import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/MyHistoryPage.tsx', import.meta.url), 'utf8')
const legacy = readFileSync(new URL('../src/components/MyHistoryPageLegacy.tsx', import.meta.url), 'utf8')

test('22.6 transforma Minha História em uma jornada antes dos detalhes', () => {
  assert.match(page, /Sua jornada/)
  assert.match(page, /Seu momento agora/)
  assert.match(page, /Trajetória/)
  assert.match(page, /Seu jardim/)
  assert.match(page, /Explorar minha história/)
  assert.match(page, /MyHistoryPageLegacy/)
})

test('trajetória usa os marcos narrativos aprovados sem virar checklist de progresso', () => {
  assert.match(page, /Você começou a registrar/)
  assert.match(page, /Começando a se observar/)
  assert.match(page, /Algumas coisas começaram a se repetir/)
  assert.match(page, /Percebendo padrões/)
  assert.match(page, /Aprendendo o que ajuda/)
  assert.match(page, /Não é uma lista para completar/)
  assert.doesNotMatch(page, /\bXP\b|ranking|streak|7\/7|faltam\s+\d+|\d+%|aria-valuenow/i)
})

test('jardim cresce como memória e nunca regride por ausência', () => {
  assert.match(page, /Este jardim representa apenas o caminho que já existe/)
  assert.match(page, /não diminui, zera ou morre se você passar um tempo sem registrar/)
  assert.match(page, /Sua história continua daqui/)
  assert.match(page, /Sprout/)
  assert.match(page, /TreePine/)
})

test('22.6 preserva a história completa atrás de aprofundamento voluntário', () => {
  assert.match(page, /setShowDetails\(true\)/)
  assert.match(page, /Comparações, marcos detalhados, memórias reconhecidas, meses anteriores/)
  assert.match(legacy, /TemporalComparisonPanel/)
  assert.match(legacy, /JourneyChapterCard/)
  assert.match(legacy, /fetchDiscoveryMemories/)
  assert.match(legacy, /Momentos da sua trajetória/)
})

test('superfície da jornada usa apenas sinais estruturados e não muda o menu', () => {
  assert.match(page, /select\('created_at,date,mood,energy,anxiety_level,sleep_quality,emotional_tags,context_tags,need_tags,trigger_tags,entry_type'\)/)
  assert.doesNotMatch(page, /entry_text|diary_text|free_note|content_html/i)
  assert.match(page, /Nenhum trecho do texto livre do Diário é exibido nesta jornada/)
  assert.doesNotMatch(page, /UserLayout|MOBILE_PRIMARY_IDS|navItems/)
})
