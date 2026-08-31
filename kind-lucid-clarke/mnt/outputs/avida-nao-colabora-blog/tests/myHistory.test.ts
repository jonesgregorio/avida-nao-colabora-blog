import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMyHistory } from '../src/lib/myHistory.ts'

test('Minha História conta dias distintos e não infla vários registros no mesmo dia', () => {
  const history = buildMyHistory([
    { date: '2026-08-29', mood: 'Ansiedade', context_tags: ['Trabalho'], entry_type: 'checkin' },
    { date: '2026-08-29', mood: 'Ansiedade', context_tags: ['Trabalho'], entry_type: 'diary' },
    { date: '2026-08-28', mood: 'Tranquilidade', context_tags: ['Casa'], entry_type: 'checkin' },
  ], [], { now: new Date('2026-08-29T12:00:00-03:00') })

  assert.equal(history.totals.entries, 3)
  assert.equal(history.totals.activeDays, 2)
  assert.equal(history.months[0].activeDays, 2)
  assert.equal(history.months[0].entryCount, 3)
  assert.equal(history.months[0].topEmotion?.label, 'Ansiedade')
  assert.equal(history.months[0].topEmotion?.days, 1)
})

test('Memórias usam apenas marcadores estruturados e nunca reproduzem texto livre', () => {
  const secret = 'um texto íntimo que não pode reaparecer'
  const history = buildMyHistory([
    {
      date: '2026-06-10', mood: 'Cansaço', emotional_tags: ['Sobrecarga'], context_tags: ['Trabalho'],
      need_tags: ['Descanso'], text: secret, free_note: secret,
    } as never,
  ], [], { now: new Date('2026-08-29T12:00:00-03:00') })

  assert.equal(history.memories.length, 1)
  assert.equal(history.memories[0].mood, 'Cansaço')
  assert.deepEqual(history.memories[0].contexts, ['Trabalho'])
  assert.equal(JSON.stringify(history).includes(secret), false)
})

test('gatilhos estruturados só aparecem na História quando a camada Plus é autorizada', () => {
  const entries = [{ date: '2026-06-10', mood: 'Ansiedade', trigger_tags: ['Cobrança'] }]
  const essential = buildMyHistory(entries, [], { includeTriggers: false, now: new Date('2026-08-29T12:00:00-03:00') })
  const plus = buildMyHistory(entries, [], { includeTriggers: true, now: new Date('2026-08-29T12:00:00-03:00') })

  assert.equal(essential.months[0].topTrigger, null)
  assert.deepEqual(essential.memories[0].triggers, [])
  assert.equal(plus.months[0].topTrigger?.label, 'Cobrança')
  assert.deepEqual(plus.memories[0].triggers, ['Cobrança'])
})

test('relatórios fechados entram como marcos sem duplicar os registros do Diário', () => {
  const history = buildMyHistory(
    [{ date: '2026-08-20', mood: 'Tranquilidade', entry_type: 'diary' }],
    [
      { id: 'w1', report_type: 'weekly', period_start: '2026-08-17', period_end: '2026-08-23', status: 'generated', title: 'Relatório semanal', summary: 'Resumo real.' },
      { id: 'draft', report_type: 'monthly', period_start: '2026-08-01', period_end: '2026-08-31', status: 'draft', title: 'Rascunho', summary: 'Não deve aparecer.' },
    ],
  )

  assert.equal(history.totals.entries, 1)
  assert.equal(history.totals.reports, 1)
  assert.equal(history.months[0].reports.length, 1)
  assert.equal(history.months[0].reports[0].id, 'w1')
})

test('acontecimentos da trajetória vêm só de dados reais e ficam em ordem cronológica', () => {
  const entries = []
  for (let d = 1; d <= 14; d++) {
    entries.push({ date: `2026-06-${String(d).padStart(2, '0')}`, mood: 'Tranquilidade', entry_type: 'checkin' })
  }
  entries.push({ date: '2026-05-20', mood: 'Cansaço', entry_type: 'diary' })
  const history = buildMyHistory(entries, [
    { id: 'w1', report_type: 'weekly', period_start: '2026-06-01', period_end: '2026-06-07', status: 'generated', title: 'Semana', summary: 'Resumo.' },
  ], { now: new Date('2026-08-29T12:00:00-03:00') })

  const kinds = history.milestones.map(m => m.kind)
  assert.deepEqual(kinds, ['first_entry', 'first_report', 'first_steady_month'])
  assert.equal(history.milestones[0].date, '2026-05-20')
  const dates = history.milestones.map(m => m.date)
  assert.deepEqual([...dates].sort(), dates)
  // nenhum texto livre entra
  assert.equal(JSON.stringify(history.milestones).toLowerCase().includes('resumo'), false)
})

test('sem relatório e sem mês constante, só o marco de início aparece', () => {
  const history = buildMyHistory(
    [{ date: '2026-07-10', mood: 'Ansiedade', entry_type: 'checkin' }],
    [],
    { now: new Date('2026-08-29T12:00:00-03:00') },
  )
  assert.deepEqual(history.milestones.map(m => m.kind), ['first_entry'])
})
