import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateStructuredEntriesByDay } from '../src/lib/structuredContentRecommendation.ts'

test('agrega vários check-ins do mesmo dia em um único ponto de contexto', () => {
  const rows = aggregateStructuredEntriesByDay([
    {
      date: '2026-08-29', created_at: '2026-08-29T09:00:00Z', entry_type: 'checkin',
      mood: 'Ansiedade', anxiety_level: 5, energy: 1,
      emotional_tags: ['ansiedade'], context_tags: ['trabalho'],
    },
    {
      date: '2026-08-29', created_at: '2026-08-29T18:00:00Z', entry_type: 'checkin',
      mood: 'Ansiedade', anxiety_level: 3, energy: 3,
      emotional_tags: ['ansiedade', 'cansaço'], context_tags: ['trabalho'],
    },
    {
      date: '2026-08-28', created_at: '2026-08-28T12:00:00Z', entry_type: 'diary',
      mood: 'Tranquilidade', anxiety_level: 2, energy: 4,
      emotional_tags: ['alívio'], context_tags: ['família'],
    },
  ])

  assert.equal(rows.length, 2)
  const day = rows.find(row => row.date === '2026-08-29')
  assert.ok(day)
  assert.equal(day?.anxiety_level, 4)
  assert.equal(day?.energy, 2)
  assert.deepEqual(day?.emotional_tags, ['ansiedade', 'cansaço'])
  assert.deepEqual(day?.context_tags, ['trabalho'])
})

test('não carrega texto livre para o ponto usado na pontuação', () => {
  const [day] = aggregateStructuredEntriesByDay([
    {
      date: '2026-08-29', mood: 'Sobrecarga',
      text: 'texto íntimo que não deve entrar no contexto de recomendação',
      free_note: 'outra anotação privada',
      recurring_thoughts: 'pensamento privado',
      emotional_triggers: 'descrição livre',
      emotional_tags: ['sobrecarga'],
      trigger_tags: ['cobrança'],
    },
  ])

  assert.ok(day)
  assert.equal('text' in day, false)
  assert.equal('free_note' in day, false)
  assert.equal('recurring_thoughts' in day, false)
  assert.equal('emotional_triggers' in day, false)
  assert.deepEqual(day.trigger_tags, ['cobrança'])
})

test('ignora humor legado numérico e preserva marcadores estruturados', () => {
  const [day] = aggregateStructuredEntriesByDay([
    {
      date: '2026-08-29', mood: 3,
      emotional_tags: ['confusão'], need_tags: ['pausa'], care_action_tags: ['respirar'],
    },
  ])

  assert.equal(day.mood, null)
  assert.deepEqual(day.emotional_tags, ['confusão'])
  assert.deepEqual(day.need_tags, ['pausa'])
  assert.deepEqual(day.care_action_tags, ['respirar'])
})
