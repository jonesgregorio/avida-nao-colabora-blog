import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../supabase/migrations/20260904024500_checkin_unico_tres_aprofundamentos.sql', import.meta.url), 'utf8')
const sync = readFileSync(new URL('../src/lib/homeCheckinDiary.ts', import.meta.url), 'utf8')

test('check-in é único por usuário e dia e não é tratado como diário', () => {
  assert.match(migration, /one_checkin_per_user_day/)
  assert.match(migration, /WHERE entry_type = 'checkin'/)
  assert.match(migration, /Check-in não é Diário/)
  assert.match(sync, /if \(existing\?\.id\) return existing\.id/)
  assert.doesNotMatch(sync, /update\(payload\)\.eq\('id', existing\.id\)/)
})

test('diário principal aceita no máximo três aprofundamentos no mesmo dia', () => {
  assert.match(migration, /deepening_count integer NOT NULL DEFAULT 0/)
  assert.match(migration, /deepening_count BETWEEN 0 AND 3/)
  assert.match(migration, /COALESCE\(OLD\.deepening_count, 0\) >= 3/)
  assert.match(migration, /NEW\.deepening_count := COALESCE\(OLD\.deepening_count, 0\) \+ 1/)
})
