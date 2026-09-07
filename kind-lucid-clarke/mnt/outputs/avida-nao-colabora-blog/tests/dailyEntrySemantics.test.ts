import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const home = fs.readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8')
const diaryMood = fs.readFileSync(new URL('../src/components/DiaryMoodSelector.tsx', import.meta.url), 'utf8')
const legacyHome = fs.readFileSync(new URL('../src/components/LoggedHomeLegacy.tsx', import.meta.url), 'utf8')

const expected = ['Nem um pouco', 'Fez o mínimo', 'Sobrevivemos', 'Até que tentou', 'Colaborou']

test('Home separa avaliação do dia de estados e sensações percebidos', () => {
  assert.match(home, /E aí, a vida colaborou hoje\?/)
  for (const label of expected) assert.match(home, new RegExp(label))
  assert.match(home, /daily_life_collaboration/)
  assert.match(home, /O que mais marcou como você se sentiu hoje\?/)
  assert.match(home, /Opcional\. Escolha as opções que mais combinaram com o seu dia\./)
  assert.match(home, /'alegria'/)
  assert.doesNotMatch(home, /featuredMoodKeys = new Set\(\['bem_estar'/)
})

test('Diário e check-in continuam usando estados emocionais, não a escala da Home', () => {
  assert.match(diaryMood, /Como você está se sentindo\?/)
  assert.match(diaryMood, /Quer acrescentar algo sobre este momento\?/)
  assert.match(diaryMood, /contexto ao que você escreveu/)
  for (const label of expected) assert.doesNotMatch(diaryMood, new RegExp(label))
})

test('Home anterior fica preservada como legado sem perder os demais blocos da Ideia 1', () => {
  assert.match(legacyHome, /HomeDiscoveryCard/)
  assert.match(legacyHome, /TodaySmallActionCard/)
  assert.match(legacyHome, /WeeklyFocusCard/)
  assert.match(legacyHome, /RecommendedContent/)
})
