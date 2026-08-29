import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const home = readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('Home logada é centrada no dia atual, não em um catálogo de atalhos', () => {
  assert.match(home, /Como a vida colaborou hoje\?/)
  assert.match(home, /Seu próximo passo/)
  assert.match(home, /Seu ritmo recente/)
  assert.match(home, /Últimos 7 dias/)
  assert.match(home, /Quando quiser olhar com mais distância/)
  assert.doesNotMatch(home, /Minha rotina emocional/)
  assert.doesNotMatch(home, /const QUICK/)
})

test('Home Hoje reutiliza a taxonomia oficial do check-in e preserva o fluxo do Diário', () => {
  assert.match(home, /MOODS\.map/)
  assert.match(home, /diary\?mood=\$\{mood\.key\}/)
  assert.match(home, /check-ins ilimitados/)
  assert.match(home, /fetchDiaryConfig/)
})

test('Home Hoje traz recomendação contextual existente e abre o conteúdo específico', () => {
  assert.match(home, /<RecommendedContent/)
  assert.match(home, /source="home-hoje"/)
  assert.match(home, /onOpen=\{\(slug\) => onNavigate\('article', slug\)\}/)
  assert.match(home, /Sugestões escolhidas a partir dos seus registros recentes/)
})

test('ritmo de cuidado não pune ausência nem usa sequência obrigatória', () => {
  assert.match(home, /Sem sequência obrigatória/)
  assert.match(home, /Cada retorno conta/)
  assert.match(home, /sem ranking/)
  assert.doesNotMatch(home, /streak/i)
})

test('Home Hoje ganha continuidade sem expor o texto livre do Diário', () => {
  assert.match(home, /buildContinuityPrompt/)
  assert.match(home, /Lembra de ontem|Continuamos daqui|retomada/i)
  assert.match(home, /Agora não/)
  assert.match(home, /Nenhum trecho do texto do Diário é exibido aqui/)
  assert.match(home, /sleep_quality,context_tags,trigger_tags/)
  assert.doesNotMatch(home, /select\([^)]*\btext\b/)
  assert.doesNotMatch(home, /free_note|recurring_thoughts|emotional_triggers/)
})
