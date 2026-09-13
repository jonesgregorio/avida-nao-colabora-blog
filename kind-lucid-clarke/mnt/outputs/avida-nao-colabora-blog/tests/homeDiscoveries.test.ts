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

test('cada descoberta carrega 1ª ocorrência, ocorrência mais recente, período analisado e as datas que contribuíram', () => {
  const discovery = buildHomeDiscovery([
    { date: '2026-08-29', mood: 'ansiedade' },
    { date: '2026-08-28', mood: 'ansiedade' },
    { date: '2026-08-27', mood: 'ansiedade' },
    { date: '2026-08-26', mood: 'tranquilidade' },
    { date: '2026-08-25', mood: 'tristeza' },
  ], 'free')
  assert.ok(discovery)
  assert.equal(discovery.firstSeen, '2026-08-27')
  assert.equal(discovery.lastSeen, '2026-08-29')
  assert.equal(discovery.periodStart, '2026-08-25')
  assert.equal(discovery.periodEnd, '2026-08-29')
  assert.deepEqual(discovery.matchedDates, ['2026-08-27', '2026-08-28', '2026-08-29'])
})

test('sinal com muito histórico mas quase ausente na metade recente vira "enfraquecendo", não "recorrente"', () => {
  // 14 dias no total: sinal presente em 6 dos 7 dias mais antigos (recorrente antes) e em
  // nenhum dos 7 dias mais recentes — enfraquecimento real, não um padrão em alta.
  const entries: { date: string; mood?: string }[] = []
  const base = new Date('2026-09-10T00:00:00Z')
  for (let i = 0; i < 14; i++) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i)
    const date = d.toISOString().slice(0, 10)
    // i=0..6 -> dias mais recentes (sem o sinal); i=7..13 -> dias mais antigos (com o sinal, exceto 1)
    const withSignal = i >= 7 && i !== 13
    entries.push({ date, mood: withSignal ? 'sobrecarga' : 'calma' })
  }
  const all = buildHomeDiscoveries(entries, 'free')
  const found = all.find(d => d.stableKey === 'mood:sobrecarga')
  assert.ok(found, 'deveria existir uma descoberta de humor "sobrecarga"')
  assert.equal(found.status, 'weakening')
})

test('sinal presente igualmente nas duas metades do período continua "recorrente" (não enfraquece à toa)', () => {
  const entries: { date: string; mood?: string }[] = []
  const base = new Date('2026-09-10T00:00:00Z')
  for (let i = 0; i < 14; i++) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i)
    const date = d.toISOString().slice(0, 10)
    entries.push({ date, mood: i % 2 === 0 ? 'sobrecarga' : 'calma' }) // metade em cada semana
  }
  const found = buildHomeDiscoveries(entries, 'free').find(d => d.stableKey === 'mood:sobrecarga')
  assert.ok(found)
  assert.equal(found.status, 'ready')
})

test('período curto (poucos dias) nunca vira "enfraquecendo" — falta base de comparação', () => {
  // mesmo dataset de "descoberta simples" (5 dias) já teria ratio baixo se comparássemos metades,
  // mas com <10 dias no total o enfraquecimento não deve ser aplicado.
  const discovery = buildHomeDiscovery([
    { date: '2026-08-29', mood: 'ansiedade' },
    { date: '2026-08-28', mood: 'ansiedade' },
    { date: '2026-08-27', mood: 'ansiedade' },
    { date: '2026-08-26', mood: 'tranquilidade' },
    { date: '2026-08-25', mood: 'tristeza' },
  ], 'free')
  assert.ok(discovery)
  assert.equal(discovery.status, 'ready')
})

test('motor de descobertas é puro e não recebe texto livre do Diário', () => {
  const source = readFileSync(new URL('../src/lib/homeDiscoveries.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\.text\b|free_note|recurring_thoughts|emotional_triggers/)
  assert.match(source, /conta dias distintos/i)
  assert.match(source, /coocorrência, nunca causalidade/i)
})
