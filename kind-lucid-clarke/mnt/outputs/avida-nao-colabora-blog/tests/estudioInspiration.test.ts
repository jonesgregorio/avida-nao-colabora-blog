import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import {
  normalizeHandle, rowToPerfil, inputToRow, buildInspirationAnalysisRequest,
} from '../src/lib/estudioInspiration.ts'

test('normalizeHandle força um único @ e tira espaços', () => {
  assert.equal(normalizeHandle('  perfil.acolhe '), '@perfil.acolhe')
  assert.equal(normalizeHandle('@@mente leve'), '@menteleve')
  assert.equal(normalizeHandle(''), '')
})

test('rowToPerfil e inputToRow fazem o mapa snake/camel', () => {
  const p = rowToPerfil({ id: '1', handle: '@x', legendas_coladas: 'L', analisado_em: '2026-08-31', created_at: 'c' })
  assert.equal(p.legendasColadas, 'L')
  assert.equal(p.analisadoEm, '2026-08-31')
  const row = inputToRow({ handle: 'x', legendasColadas: 'L', analise: 'A' })
  assert.equal(row.handle, '@x')
  assert.equal(row.legendas_coladas, 'L')
})

test('prompt de análise só usa as legendas coladas e proíbe inventar', () => {
  const p = buildInspirationAnalysisRequest('@perfil', 'ansiedade', 'legenda um\nlegenda dois')
  assert.match(p, /@perfil \(tema: ansiedade\)/)
  assert.match(p, /A partir SÓ delas/)
  assert.match(p, /Não invente dados/)
  assert.match(p, /legenda um/)
  assert.doesNotMatch(p, /diário|humor|emotional/i)
})

test('store usa a tabela certa e não expõe segredo', () => {
  const src = readFileSync(new URL('../src/lib/estudioInspirationStore.ts', import.meta.url), 'utf8')
  assert.match(src, /const TABLE = 'estudio_perfis_inspiracao'/)
  assert.doesNotMatch(src, /service_role|API_KEY/)
})

test('migration é aditiva, admin-only, sem raspagem no comentário', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url)
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  const mine = '20260831160000_estudio_perfis_inspiracao.sql'
  assert.ok(files.includes(mine))
  assert.ok(files[files.indexOf(mine) - 1] < mine)
  const sql = readFileSync(new URL(mine, dir), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.estudio_perfis_inspiracao/)
  assert.match(sql, /USING \(public\.is_admin\(\)\)\s*\n\s*WITH CHECK \(public\.is_admin\(\)\)/)
  assert.match(sql, /REVOKE ALL ON public\.estudio_perfis_inspiracao FROM anon/)
  assert.match(sql, /nunca contém dados do Diário nem raspagem/)
  assert.doesNotMatch(sql, /\bDROP TABLE\b/)
})
