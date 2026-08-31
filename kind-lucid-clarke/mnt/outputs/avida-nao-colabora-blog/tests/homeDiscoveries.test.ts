import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildHomeDiscovery, buildHomeDiscoveries } from '../src/lib/homeDiscoveries.ts'

test('descoberta simples conta dias distintos e não vários registros no mesmo dia', () => {
  const discovery = buildHomeDiscovery([
    { date: '2026-08-29', mood: 'ansiedade' },
    { date: '2026-08-29', mood: 'ansiedade' },
    { date: '2026-08-28', mood: 'Ansiedade' },
    { date: '2026-08-27', mood: 'ansiedade' },
    { date: '2026-08-26', mood: 'tranquilidade' },
    { date: '2026-08-25', mood: 'tristeza' },
  ], 'free')

  assert.ok(discovery)
  assert.equal(discovery.kind, 'mood')
  assert.equal(discovery.status, 'ready')
  assert.equal(discovery.matchedDays, 3)
  assert.equal(discovery.baseDays, 5)
  assert.match(discovery.evidence, /dias distintos/i)
})

test('antes da amostra mínima a Home fala em descoberta se formando, não em padrão confirmado', () => {
  const discovery = buildHomeDiscovery([
    { date: '2026-08-29', mood: 'sobrecarga' },
    { date: '2026-08-28', mood: 'sobrecarga' },
    { date: '2026-08-27', mood: 'tranquilidade' },
  ], 'free')

  assert.ok(discovery)
  assert.equal(discovery.status, 'forming')
  assert.match(discovery.eyebrow, /se formando/i)
  assert.match(discovery.description, /ainda é cedo/i)
})

test('Gratuito ignora contextos e sentimentos avançados e mantém somente humor simples', () => {
  const entries = [
    { date: '2026-08-29', mood: 'tranquilidade', context_tags: ['trabalho'], emotional_tags: ['sobrecarga'] },
    { date: '2026-08-28', mood: 'tristeza', context_tags: ['trabalho'], emotional_tags: ['sobrecarga'] },
    { date: '2026-08-27', mood: 'bem_estar', context_tags: ['trabalho'], emotional_tags: ['sobrecarga'] },
    { date: '2026-08-26', mood: 'ansiedade', context_tags: ['trabalho'], emotional_tags: ['sobrecarga'] },
    { date: '2026-08-25', mood: 'cansaco', context_tags: ['trabalho'], emotional_tags: ['sobrecarga'] },
  ]

  assert.equal(buildHomeDiscovery(entries, 'free'), null)
  const essential = buildHomeDiscovery(entries, 'essential')
  assert.ok(essential)
  assert.ok(['context_emotion', 'emotion', 'context'].includes(essential.kind))
})

test('Essencial pode perceber sono difícil e ansiedade alta apenas quando os dois foram marcados no mesmo dia', () => {
  const discovery = buildHomeDiscovery([
    { date: '2026-08-29', sleep_quality: 2, anxiety_level: 4 },
    { date: '2026-08-28', sleep_quality: 1, anxiety_level: 5 },
    { date: '2026-08-27', sleep_quality: 2, anxiety_level: 4 },
    { date: '2026-08-26', sleep_quality: 4, anxiety_level: 2 },
  ], 'essential')

  assert.ok(discovery)
  assert.equal(discovery.kind, 'sleep_anxiety')
  assert.equal(discovery.status, 'ready')
  assert.match(discovery.evidence, /coocorrência não significa causa nem diagnóstico/i)
})

test('Plus pode priorizar gatilho + sentimento quando a coocorrência se repete', () => {
  const entries = [
    { date: '2026-08-29', trigger_tags: ['cobrança'], emotional_tags: ['sobrecarga'] },
    { date: '2026-08-28', trigger_tags: ['cobrança'], emotional_tags: ['sobrecarga'] },
    { date: '2026-08-27', trigger_tags: ['cobrança'], emotional_tags: ['sobrecarga'] },
    { date: '2026-08-26', mood: 'tranquilidade' },
    { date: '2026-08-25', mood: 'ansiedade' },
  ]
  const discovery = buildHomeDiscovery(entries, 'plus')
  assert.ok(discovery)
  assert.equal(discovery.kind, 'trigger_emotion')
  assert.equal(discovery.status, 'ready')
  assert.match(discovery.description, /coocorrência/i)
})

test('área Descobertas lista todas as descobertas e a Home usa a primeira', () => {
  const entries = [
    { date: '2026-08-29', mood: 'ansiedade', context_tags: ['trabalho'] },
    { date: '2026-08-28', mood: 'ansiedade', context_tags: ['trabalho'] },
    { date: '2026-08-27', mood: 'ansiedade', context_tags: ['trabalho'] },
    { date: '2026-08-26', mood: 'sobrecarga', context_tags: ['trabalho'] },
    { date: '2026-08-25', mood: 'sobrecarga' },
  ]
  const all = buildHomeDiscoveries(entries, 'essential')
  assert.ok(all.length >= 2, 'a área deve reunir mais de uma descoberta quando há sinais')
  assert.deepEqual(buildHomeDiscovery(entries, 'essential'), all[0])
  for (const item of all) {
    assert.ok(['forming', 'ready'].includes(item.status))
    assert.equal(typeof item.title, 'string')
  }
})

test('sem amostra mínima, a área Descobertas volta vazia (não quebra)', () => {
  assert.deepEqual(buildHomeDiscoveries([{ date: '2026-08-29', mood: 'ansiedade' }], 'plus'), [])
})

test('stableKey não muda quando a contagem de dias muda (feedback sobrevive)', () => {
  const base = [
    { date: '2026-08-29', mood: 'ansiedade' },
    { date: '2026-08-28', mood: 'ansiedade' },
    { date: '2026-08-27', mood: 'ansiedade' },
    { date: '2026-08-26', mood: 'tranquilidade' },
    { date: '2026-08-25', mood: 'tristeza' },
  ]
  const first = buildHomeDiscovery(base, 'free')
  const later = buildHomeDiscovery([{ date: '2026-08-30', mood: 'ansiedade' }, ...base], 'free')
  assert.ok(first && later)
  assert.notEqual(first.id, later.id, 'o id embute a contagem e deve mudar')
  assert.equal(first.stableKey, later.stableKey, 'a stableKey ignora a contagem')
  assert.equal(first.stableKey, 'mood:ansiedade')
})

test('stableKey de relação é normalizada e sem acento', () => {
  const discovery = buildHomeDiscovery([
    { date: '2026-08-29', sleep_quality: 2, anxiety_level: 4 },
    { date: '2026-08-28', sleep_quality: 1, anxiety_level: 5 },
    { date: '2026-08-27', sleep_quality: 2, anxiety_level: 4 },
    { date: '2026-08-26', sleep_quality: 4, anxiety_level: 2 },
  ], 'essential')
  assert.ok(discovery)
  assert.equal(discovery.stableKey, 'sleep_anxiety')
})

test('motor de descobertas é puro e não recebe texto livre do Diário', () => {
  const source = readFileSync(new URL('../src/lib/homeDiscoveries.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\.text\b|free_note|recurring_thoughts|emotional_triggers/)
  assert.match(source, /conta dias distintos/i)
  assert.match(source, /coocorrência, nunca causalidade/i)
})
