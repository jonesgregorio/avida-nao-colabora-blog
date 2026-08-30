import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/DescobertasPage.tsx', import.meta.url), 'utf8')
const archive = readFileSync(new URL('../src/components/history/DiscoveryMemoryArchive.tsx', import.meta.url), 'utf8')
const store = readFileSync(new URL('../src/lib/discoveryMemoryStore.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260830154500_discovery_memories.sql', import.meta.url), 'utf8')

test('Descobertas integra a memória histórica real', () => {
  assert.match(page, /DiscoveryMemoryArchive/)
  assert.match(page, /snap(?:shot)?/i)
  assert.match(archive, /O que já fez sentido antes/)
  assert.match(archive, /Volt(?:ou|a) a aparecer/)
  assert.match(archive, /Remover da memória/)
})

test('snapshot histórico usa somente campos estruturados da descoberta', () => {
  assert.match(store, /discovery_key/)
  assert.match(store, /title/)
  assert.match(store, /description/)
  assert.match(store, /evidence/)
  assert.match(store, /question/)
  assert.doesNotMatch(store, /diary_text|free_text|content_text|entry_text/i)
})

test('memória histórica não introduz gamificação punitiva', () => {
  const source = `${page}\n${archive}`
  assert.doesNotMatch(source, /\bXP\b|ranking|streak|sequência atual|\d+%|aria-valuenow/i)
})

test('migration protege memória por RLS e reduz privilégios do usuário autenticado', () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i)
  assert.match(migration, /auth\.uid\(\)/i)
  assert.match(migration, /REVOKE ALL ON public\.user_discovery_memories FROM authenticated/i)
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE/i)
  assert.match(migration, /REVOKE ALL ON public\.user_discovery_memories FROM anon/i)
})
