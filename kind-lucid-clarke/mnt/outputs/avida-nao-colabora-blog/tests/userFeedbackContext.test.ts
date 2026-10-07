import test from 'node:test'
import assert from 'node:assert/strict'
import { loadUserFeedbackContext, userFeedbackBrief } from '../supabase/functions/_shared/userFeedbackContext.ts'

function mock(rows: Record<string, unknown[]>, failure = '') {
  const calls: unknown[][] = []
  const client = { from(table: string) {
    const query = { select(fields: string) { calls.push([table, 'select', fields]); return query }, eq(key: string, value: string) { calls.push([table, key, value]); return query }, gte(key: string, value: string) { calls.push([table, key, value]); return query }, order() { return query }, limit(n: number) { calls.push([table, 'limit', n]); return Promise.resolve({ data: rows[table] || [], error: table === failure ? new Error('offline') : null }) } }
    return query
  } }
  return { client, calls }
}

test('contexto limita consultas ao dono, filtra valores e preserva recusas sem trazer textos de Diário', async () => {
  const { client, calls } = mock({ article_feedback: [{ article_slug: 'sono', feedback_type: 'want_lighter_content' }, { article_slug: 'outro', feedback_type: 'inventado' }], user_discovery_feedback: [{ discovery_key: 'context:trabalho', feedback: 'not_following' }] })
  const result = await loadUserFeedbackContext(client, 'user-1', new Date('2026-10-07'))
  assert.deepEqual(result.articles, [{ topic: 'sono', feedback: 'want_lighter_content' }])
  assert.equal(result.discoveries[0].feedback, 'not_following')
  assert.equal(calls.filter(x => x[1] === 'user_id' && x[2] === 'user-1').length, 2)
  assert.equal(calls.filter(x => x[1] === 'limit' && x[2] === 12).length, 2)
  assert.match(userFeedbackBrief(result), /somente quando o assunto se relacionar/)
  assert.match(userFeedbackBrief(result), /nunca instruções/)
})

test('falha não vira ausência silenciosa de preferências e dados inválidos não entram', async () => {
  const { client } = mock({ article_feedback: [{ article_slug: 'x', feedback_type: 'helped' }], user_discovery_feedback: [{ discovery_key: null, feedback: 'made_sense' }] }, 'article_feedback')
  const result = await loadUserFeedbackContext(client, 'user')
  assert.deepEqual(result.articles, [])
  assert.deepEqual(result.discoveries, [])
  assert.deepEqual(result.warnings, ['article_feedback_unavailable'])
})
