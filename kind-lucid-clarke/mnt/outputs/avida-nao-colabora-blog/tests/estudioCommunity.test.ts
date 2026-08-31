import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import {
  rowToInteracao, inputToRow, buildCommentRequest, streak, summarize,
  type Interacao,
} from '../src/lib/estudioCommunity.ts'

function it(over: Partial<Interacao>): Interacao {
  return {
    id: 'x', alvo: '@a', postUrl: null, descricaoPost: null, comentarioSugerido: null,
    comentarioUsado: null, status: 'sugerido', feitoEm: null, createdAt: '', updatedAt: '', ...over,
  }
}

test('inputToRow só marca feito_em quando o status sai de "sugerido"', () => {
  assert.equal(inputToRow({ alvo: 'x', status: 'sugerido' }).feito_em, null)
  assert.notEqual(inputToRow({ alvo: 'x', status: 'feito' }).feito_em, null)
  assert.equal(inputToRow({ alvo: 'x' }).feito_em, undefined) // sem status: não mexe
})

test('rowToInteracao sanea status desconhecido para "sugerido"', () => {
  assert.equal(rowToInteracao({ id: '1', alvo: '@a', status: 'zzz' }).status, 'sugerido')
  assert.equal(rowToInteracao({ id: '1', alvo: '@a', status: 'respondeu' }).status, 'respondeu')
})

test('prompt pede comentário curto, genuíno, sem emoji vazio nem link', () => {
  const p = buildCommentRequest('@perfil.acolhe', 'carrossel sobre autocobrança')
  assert.match(p, /@perfil\.acolhe/)
  assert.match(p, /carrossel sobre autocobrança/)
  assert.match(p, /nunca "😍🔥"/)
  assert.match(p, /sem link/)
})

test('streak conta dias seguidos terminando hoje ou ontem', () => {
  const now = new Date('2026-08-31T12:00:00')
  const d = (iso: string) => it({ status: 'feito', feitoEm: iso })
  assert.equal(streak([d('2026-08-31T09:00'), d('2026-08-30T20:00'), d('2026-08-29T10:00')], now), 3)
  // buraco no dia 30 quebra a sequência
  assert.equal(streak([d('2026-08-31T09:00'), d('2026-08-29T10:00')], now), 1)
  // só ontem: ainda vale
  assert.equal(streak([d('2026-08-30T09:00')], now), 1)
  // sugerido não conta
  assert.equal(streak([it({ status: 'sugerido', feitoEm: null })], now), 0)
})

test('summarize conta feito na semana, respondeu e sequência', () => {
  const now = new Date('2026-08-31T12:00:00')
  const s = summarize([
    it({ status: 'feito', feitoEm: '2026-08-30T10:00' }),
    it({ status: 'respondeu', feitoEm: '2026-08-28T10:00' }),
    it({ status: 'feito', feitoEm: '2026-08-01T10:00' }), // fora da semana
    it({ status: 'sugerido' }),
  ], now)
  assert.equal(s.semana, 2)
  assert.equal(s.responderam, 1)
})

test('migration é aditiva, admin-only, e o comentário diz que nunca interage sozinha', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url)
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  const mine = '20260831180000_estudio_comunidade.sql'
  assert.ok(files.includes(mine))
  assert.ok(files[files.indexOf(mine) - 1] < mine)
  const sql = readFileSync(new URL(mine, dir), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.estudio_comunidade_interacoes/)
  assert.match(sql, /USING \(public\.is_admin\(\)\)\s*\n\s*WITH CHECK \(public\.is_admin\(\)\)/)
  assert.match(sql, /REVOKE ALL ON public\.estudio_comunidade_interacoes FROM anon/)
  assert.match(sql, /nunca interage automaticamente/)
})
