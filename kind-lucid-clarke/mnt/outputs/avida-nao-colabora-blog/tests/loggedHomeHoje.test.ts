import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const home = readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const legacyHome = readFileSync(new URL('../src/components/LoggedHomeLegacy.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const checkinMigration = readFileSync(new URL('../supabase/migrations/20260902215500_home_checkin_tags.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('Home logada prioriza o dia e recolhe a experiência analítica', () => {
  assert.match(home, /E aí, a vida colaborou hoje\?/)
  assert.match(home, /Escolha o que chega mais perto do seu dia/)
  assert.match(home, /daily_life_collaboration/)
  assert.match(home, /Olhar minha semana/)
  assert.match(home, /aria-expanded=\{detailsOpen\}/)
  assert.match(home, /detailsOpen &&/)
  assert.match(home, /<LoggedHomeLegacy/)
})

test('Home Hoje usa o novo check-in e mantém o Diário separado', () => {
  assert.match(home, /Fez o mínimo/)
  assert.match(home, /Sobrevivemos/)
  assert.match(home, /Até que tentou/)
  assert.match(home, /Registrar meu check-in/)
  assert.match(home, /Quero escrever no diário/)
  assert.match(home, /Como isso apareceu em você\?/)
  assert.match(home, /featuredMoods\.map/)
  assert.match(home, /toggleFeeling\(mood\.key\)/)
  assert.doesNotMatch(home, /featuredMoods\.map\([\s\S]{0,260}diary\?mood=/)
})

test('novo check-in permite tags personalizadas curtas sem virar texto de Diário', () => {
  assert.match(home, /\+ Outro/)
  assert.match(home, /MAX_CUSTOM_TAGS = 5/)
  assert.match(home, /MAX_CUSTOM_TAG_LENGTH = 24/)
  assert.match(home, /home-checkin-custom-tag/)
  assert.match(home, /custom_tags: customTags/)
  assert.match(home, /feeling_tags: selectedFeelings/)
  assert.match(home, /Salvar meu check-in/)
  assert.doesNotMatch(home, /<textarea/)
  assert.match(checkinMigration, /add column if not exists feeling_tags text\[\]/)
  assert.match(checkinMigration, /add column if not exists custom_tags text\[\]/)
  assert.match(checkinMigration, /cardinality\(custom_tags\) <= 5/)
})

test('blocos antigos continuam disponíveis somente após aprofundamento explícito', () => {
  assert.match(legacyHome, /HomeDiscoveryCard/)
  assert.match(legacyHome, /TodaySmallActionCard/)
  assert.match(legacyHome, /WeeklyFocusCard/)
  assert.match(legacyHome, /RecommendedContent/)
  assert.match(home, /detailsOpen &&[\s\S]*LoggedHomeLegacy/)
})

test('continuidade preserva privacidade e não lê texto livre', () => {
  assert.match(legacyHome, /buildContinuityPrompt/)
  assert.match(legacyHome, /Nenhum trecho do texto do Diário é exibido aqui/)
  assert.match(legacyHome, /sleep_quality[^']*context_tags,trigger_tags/)
  assert.doesNotMatch(legacyHome, /select\([^)]*\btext\b/)
})

test('Home mantém descoberta e pequena ação sem persistência punitiva', () => {
  assert.match(legacyHome, /buildHomeDiscoveries/)
  assert.match(legacyHome, /buildTodaySmallAction/)
  assert.match(legacyHome, /avnc:small-action-status/)
  assert.doesNotMatch(legacyHome, /small_action_points|mission_points|streak|seeds|sementes/i)
})
