import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/MyHistoryPageLegacy.tsx', import.meta.url), 'utf8')
const card = readFileSync(new URL('../src/components/history/JourneyChapterCard.tsx', import.meta.url), 'utf8')

test('Minha História conecta o capítulo real da jornada ao modelo existente', () => {
  assert.match(page, /buildJourneyChapter\(\{/)
  assert.match(page, /activeDays:\s*history\.totals\.activeDays/)
  assert.match(page, /reports:\s*history\.totals\.reports/)
  assert.match(page, /hasSteadyMonth:\s*history\.milestones\.some/)
  assert.match(page, /<JourneyChapterCard chapter=\{chapter\}/)
})

test('card de jornada comunica evidências sem mecânicas punitivas', () => {
  assert.match(card, /O que sustenta este capítulo/)
  assert.doesNotMatch(card, /\bXP\b|ranking|streak|sequência atual|faltam\s+\d+|\d+%/i)
  assert.doesNotMatch(card, /progress|aria-valuenow/i)
})

test('acontecimento mais recente recebe destaque sem medalha ou pontuação', () => {
  assert.match(page, /Mais recente/)
  assert.match(page, /isLatest/)
  assert.doesNotMatch(page, /medalha|troféu|pontos? conquistados?/i)
})
