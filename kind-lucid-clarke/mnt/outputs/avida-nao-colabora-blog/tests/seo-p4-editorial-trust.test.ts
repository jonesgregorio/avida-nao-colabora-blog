import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20260920190000_seo_p4_editorial_trust.sql'), 'utf8')

test('P4 restaura published_at sem inventar data histórica', () => {
  assert.match(sql, /set published_at = created_at/i)
  assert.match(sql, /where status = 'published' and published_at is null/i)
})

test('P4 reduz promessas em conteúdo sensível sem registrar revisão profissional fictícia', () => {
  assert.match(sql, /O que pode ajudar durante uma crise de ansiedade/)
  assert.match(sql, /sem promessas de efeito imediato/)
  assert.doesNotMatch(sql, /set\s+reviewed_at/i)
  assert.doesNotMatch(sql, /botão de reset biológico/i)
  assert.doesNotMatch(sql, /alívio imediato/i)
  assert.doesNotMatch(sql, /em poucos minutos/i)
})

test('P4 trata telas e sono com linguagem proporcional à evidência', () => {
  assert.match(sql, /não se resume a “luz azul bloqueia melatonina e estraga o sono”/)
  assert.match(sql, /evidência não permitiu conclusões universais/)
  assert.match(sql, /PMID 38806392/)
  assert.doesNotMatch(sql, /acordar revigorado/)
})

test('P4 remove linguagem quebrada do artigo sobre descanso', () => {
  assert.match(sql, /Descansar ou adiar\? Como perceber a diferença sem culpa/)
  for (const broken of ['ourselves', 'reconnectemos', 'disconforto', 'jornalismo']) {
    assert.equal(sql.includes(broken), false)
  }
})
