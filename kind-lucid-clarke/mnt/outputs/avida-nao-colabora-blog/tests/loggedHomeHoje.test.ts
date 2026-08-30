import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const home = readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const legacyHome = readFileSync(new URL('../src/components/LoggedHomeLegacy.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('Home logada é centrada no dia atual e mantém a experiência anterior logo abaixo', () => {
  assert.match(home, /E aí, a vida colaborou hoje\?/)
  assert.match(home, /Pense no dia como um todo/)
  assert.match(home, /daily_life_collaboration/)
  assert.match(home, /<LoggedHomeLegacy/)
  assert.match(legacyHome, /Seu próximo passo/)
  assert.match(legacyHome, /Seu ritmo recente/)
  assert.match(legacyHome, /Últimos 7 dias/)
  assert.match(legacyHome, /Quando quiser olhar com mais distância/)
  assert.doesNotMatch(legacyHome, /Minha rotina emocional/)
  assert.doesNotMatch(legacyHome, /const QUICK/)
})

test('Home Hoje separa avaliação do dia e preserva a taxonomia oficial do check-in no legado', () => {
  assert.match(home, /COLLABORATION\.map/)
  assert.match(home, /featuredMoods\.map/)
  assert.match(home, /diary\?mood=\$\{mood\.key\}/)
  assert.match(legacyHome, /MOODS\.map/)
  assert.match(legacyHome, /check-ins ilimitados/)
  assert.match(legacyHome, /fetchDiaryConfig/)
})

test('Home Hoje preserva recomendação contextual existente e abre o conteúdo específico', () => {
  assert.match(legacyHome, /<RecommendedContent/)
  assert.match(legacyHome, /source="home-hoje"/)
  assert.match(legacyHome, /onOpen=\{\(slug\) => onNavigate\('article', slug\)\}/)
  assert.match(legacyHome, /Sugestões escolhidas a partir dos seus registros recentes/)
})

test('ritmo de cuidado não pune ausência nem usa sequência obrigatória', () => {
  assert.match(legacyHome, /Sem sequência obrigatória/)
  assert.match(legacyHome, /Cada retorno conta/)
  assert.match(legacyHome, /sem ranking/)
  assert.doesNotMatch(legacyHome, /streak/i)
})

test('Home Hoje ganha continuidade sem expor o texto livre do Diário', () => {
  assert.match(legacyHome, /buildContinuityPrompt/)
  assert.match(legacyHome, /Lembra de ontem|Continuamos daqui|retomada/i)
  assert.match(legacyHome, /Agora não/)
  assert.match(legacyHome, /Nenhum trecho do texto do Diário é exibido aqui/)
  assert.match(legacyHome, /sleep_quality[^']*context_tags,trigger_tags/)
  assert.doesNotMatch(legacyHome, /select\([^)]*\btext\b/)
  assert.doesNotMatch(legacyHome, /free_note|recurring_thoughts|emotional_triggers/)
})

test('Home Hoje mostra descoberta progressiva sem criar uma segunda leitura de texto', () => {
  assert.match(legacyHome, /buildHomeDiscoveries/)
  assert.match(legacyHome, /<HomeDiscoveryCard/)
  assert.match(legacyHome, /avnc:discovery-dismissed/)
  assert.match(legacyHome, /trigger_tags,emotional_tags/)
  assert.doesNotMatch(legacyHome, /select\([^)]*\btext\b/)
})

test('Home Hoje respeita "não quero acompanhar" sem reabrir a descoberta oculta', () => {
  assert.match(legacyHome, /mutedDiscoveryKeys/)
  assert.match(legacyHome, /!mutedDiscoveries\.has\(item\.stableKey\)/)
  assert.match(legacyHome, /fetchDiscoveryFeedback/)
})

test('Home aceita humor salvo como chave antiga ou rótulo atual', () => {
  assert.match(legacyHome, /item\.key === raw \|\| item\.label\.toLowerCase\(\) === raw\.toLowerCase\(\)/)
  assert.match(legacyHome, /m\.key === key \|\| m\.label\.toLowerCase\(\) === key\.toLowerCase\(\)/)
})

test('Home Hoje oferece pequena ação opcional somente a partir de sinais estruturados', () => {
  assert.match(legacyHome, /buildTodaySmallAction/)
  assert.match(legacyHome, /<TodaySmallActionCard/)
  assert.match(legacyHome, /need_tags,care_action_tags/)
  assert.match(legacyHome, /avnc:small-action-status/)
  assert.match(legacyHome, /avnc:small-action-dismissed/)
  assert.doesNotMatch(legacyHome, /select\([^)]*\btext\b/)
})

test('pequena ação não cria persistência de gamificação no backend', () => {
  assert.doesNotMatch(legacyHome, /small_action_points|mission_points|streak|seeds|sementes/i)
  assert.match(legacyHome, /window\.localStorage\.setItem\(smallActionStatusKey/)
})
