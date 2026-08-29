import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTodaySmallAction } from '../src/lib/todaySmallAction.ts'

const TODAY = '2026-08-29'

function entry(overrides: Record<string, unknown> = {}) {
  return {
    date: TODAY,
    created_at: `${TODAY}T12:00:00Z`,
    mood: 'Tranquilidade',
    emotional_tags: [],
    context_tags: [],
    need_tags: [],
    care_action_tags: [],
    trigger_tags: [],
    ...overrides,
  }
}

test('não cria pequena ação antes de existir registro hoje', () => {
  const action = buildTodaySmallAction([
    entry({ date: '2026-08-28', mood: 'Sobrecarga' }),
  ], TODAY)
  assert.equal(action, null)
})

test('sobrecarga prioriza aliviar uma exigência em vez de adicionar produtividade', () => {
  const action = buildTodaySmallAction([entry({ mood: 'Sobrecarga' })], TODAY)
  assert.equal(action?.kind, 'overload')
  assert.match(action?.title ?? '', /Tire uma coisa da lista/)
  assert.match(action?.reason ?? '', /reduzir uma exigência/)
})

test('ansiedade alta recebe uma pausa opcional e não linguagem clínica', () => {
  const action = buildTodaySmallAction([entry({ anxiety_level: 5, mood: 'Ansiedade' })], TODAY)
  assert.equal(action?.kind, 'anxiety')
  assert.match(action?.description ?? '', /Por um minuto/)
  assert.match(action?.reason ?? '', /não uma orientação clínica/)
})

test('energia baixa reduz o tamanho da próxima tarefa', () => {
  const action = buildTodaySmallAction([entry({ energy: 1, mood: 'Cansaço' })], TODAY)
  assert.equal(action?.kind, 'low_energy')
  assert.match(action?.title ?? '', /Diminua o tamanho/)
})

test('sono difícil pode gerar convite para proteger o fim do dia', () => {
  const action = buildTodaySmallAction([entry({ sleep_quality: 1, context_tags: ['sono'] })], TODAY)
  assert.equal(action?.kind, 'sleep')
  assert.match(action?.title ?? '', /Proteja um pouco do seu fim de dia/)
})

test('solidão ou necessidade de conversa pode sugerir contato simples', () => {
  const action = buildTodaySmallAction([entry({ emotional_tags: ['solidão'], need_tags: ['conversa'] })], TODAY)
  assert.equal(action?.kind, 'connection')
  assert.match(action?.description ?? '', /pessoa de confiança/)
})

test('não repete cuidado que já foi marcado no registro atual', () => {
  const action = buildTodaySmallAction([entry({ mood: 'Ansiedade', anxiety_level: 5, care_action_tags: ['respirar', 'fazer uma pausa'] })], TODAY)
  assert.equal(action, null)
})

test('usa o registro mais recente do dia em vez de um estado antigo do mesmo dia', () => {
  const action = buildTodaySmallAction([
    entry({ created_at: `${TODAY}T09:00:00Z`, mood: 'Sobrecarga' }),
    entry({ created_at: `${TODAY}T18:00:00Z`, mood: 'Tranquilidade' }),
  ], TODAY)
  assert.equal(action, null)
})

test('estado tranquilo sem sinal estruturado relevante não força uma ação', () => {
  assert.equal(buildTodaySmallAction([entry()], TODAY), null)
})
