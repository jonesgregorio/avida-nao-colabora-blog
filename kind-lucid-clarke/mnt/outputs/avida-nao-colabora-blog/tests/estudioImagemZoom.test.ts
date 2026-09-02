import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const estudio = readFileSync(new URL('../src/components/admin/AdminEstudio.tsx', import.meta.url), 'utf8')
const fn = readFileSync(new URL('../supabase/functions/estudio-generate-image/index.ts', import.meta.url), 'utf8')
const ai = readFileSync(new URL('../src/lib/estudioAi.ts', import.meta.url), 'utf8')

test('a Edge Function cabe no tempo do proxy (~100s) e tem teto por tentativa', () => {
  assert.match(fn, /const TIMEOUT_MS = 92_000/)
  assert.match(fn, /const PER_TRY_MS = 88_000/)
  // modo "art" tenta 1 modelo só; "photo" pode tentar mais
  assert.match(fn, /mode === 'art' \? 1 : 4/)
  assert.match(fn, /\[\.\.\.new Set\(\[\.\.\.found\.gemini, \.\.\.FALLBACK_GEMINI\]\)\]/)
  assert.match(fn, /setTimeout\(\(\) => perTry\.abort\(\), PER_TRY_MS\)/)
  assert.match(ai, /d\?\.error === 'timeout'/)
  assert.match(ai, /failed to fetch/i) // mensagem amigável quando o proxy corta
})

test('as imagens geradas abrem em tela cheia ao clicar (ZoomableImg)', () => {
  assert.match(estudio, /function ZoomableImg\(/)
  assert.match(estudio, /createPortal\(/)
  assert.match(estudio, /cursor: 'zoom-in'/)
  assert.match(estudio, /clique ou Esc para fechar/)
  assert.match(estudio, /e\.key === 'Escape'/)
  // usado no círculo da pessoa e nas artes geradas
  assert.match(estudio, /<ZoomableImg src=\{fotoUrl\}/)
  assert.match(estudio, /<ZoomableImg src=\{a\.url\}/)
})

test('as prévias ficam maiores (círculo maior, grade de 2 colunas)', () => {
  assert.match(estudio, /h-28 w-28 rounded-full/)
  assert.match(estudio, /grid gap-3 sm:grid-cols-2/)
})
