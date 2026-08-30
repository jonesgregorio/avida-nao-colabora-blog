import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DISCOVERY_FEEDBACK_OPTIONS,
  mutedDiscoveryKeys,
  type DiscoveryFeedbackMap,
} from '../src/lib/discoveryFeedback.ts'

test('as três opções de feedback são "fez sentido / mais ou menos / não acompanhar"', () => {
  assert.deepEqual(
    DISCOVERY_FEEDBACK_OPTIONS.map(option => option.value),
    ['made_sense', 'sort_of', 'not_following'],
  )
})

test('mutedDiscoveryKeys devolve só as descobertas marcadas como "não quero acompanhar"', () => {
  const map: DiscoveryFeedbackMap = {
    'mood:ansiedade': 'made_sense',
    'context:trabalho': 'not_following',
    'context_emotion:trabalho:sobrecarga': 'sort_of',
    'sleep_anxiety': 'not_following',
  }
  const muted = mutedDiscoveryKeys(map)
  assert.equal(muted.size, 2)
  assert.ok(muted.has('context:trabalho'))
  assert.ok(muted.has('sleep_anxiety'))
  assert.ok(!muted.has('mood:ansiedade'))
})

test('o store é reversível e não guarda progresso, pontuação nem gamificação', () => {
  const source = readFileSync(new URL('../src/lib/discoveryFeedbackStore.ts', import.meta.url), 'utf8')
  assert.match(source, /clearDiscoveryFeedback/)
  assert.match(source, /onConflict: 'user_id,discovery_key'/)
  assert.match(source, /user_discovery_feedback/)
  assert.doesNotMatch(source, /points|score|streak|seeds|sementes|progress/i)
  // Nunca lê texto livre do Diário.
  assert.doesNotMatch(source, /\bfrom\('diary_entries'\)|\.text\b/)
})

test('a migration cria a tabela com RLS do próprio dono e sem acesso anônimo', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20260830030000_discovery_feedback.sql', import.meta.url),
    'utf8',
  )
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.user_discovery_feedback/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /feedback IN \('made_sense', 'sort_of', 'not_following'\)/)
  assert.match(migration, /UNIQUE \(user_id, discovery_key\)/)
  assert.match(migration, /USING \(user_id = auth\.uid\(\)\)/)
  assert.match(migration, /REVOKE ALL ON public\.user_discovery_feedback FROM anon/)
  assert.doesNotMatch(migration, /ALTER TABLE public\.(diary_entries|profiles|subscriptions)/)
})

test('a Descoberta some da Home e da área quando marcada como "não acompanhar"', () => {
  const page = readFileSync(new URL('../src/components/DescobertasPage.tsx', import.meta.url), 'utf8')
  const home = readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8')
  assert.match(page, /mutedDiscoveryKeys/)
  assert.match(page, /filter\(d => !muted\.has\(d\.stableKey\)\)/)
  assert.match(home, /mutedDiscoveryKeys/)
  assert.match(home, /!mutedDiscoveries\.has\(item\.stableKey\)/)
})
