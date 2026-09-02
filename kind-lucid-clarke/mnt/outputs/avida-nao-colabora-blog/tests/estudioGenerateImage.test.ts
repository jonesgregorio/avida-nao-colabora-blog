import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fn = readFileSync(new URL('../supabase/functions/estudio-generate-image/index.ts', import.meta.url), 'utf8')
const ai = readFileSync(new URL('../src/lib/estudioAi.ts', import.meta.url), 'utf8')

test('a Edge Function é admin-AAL2, usa a chave só no servidor e não toca generate-content', () => {
  assert.match(fn, /requireAdminAal2\(req\)/)
  assert.match(fn, /Deno\.env\.get\('GEMINI_API_KEY'\)/)
  assert.match(fn, /generativelanguage\.googleapis\.com/)
  assert.doesNotMatch(fn, /invoke\(['"]generate-content|functions\/generate-content/)
})

test('descobre os modelos de imagem via ListModels antes de tentar', () => {
  assert.match(fn, /async function discover\(/)
  assert.match(fn, /pageSize=200/)
  assert.match(fn, /supportedGenerationMethods \?\? \[\]\)\.includes\('predict'\)/)
  assert.match(fn, /supportedGenerationMethods \?\? \[\]\)\.includes\('generateContent'\)/)
})

test('tenta Imagen (:predict) e Gemini Image (:generateContent); secret define modelo único', () => {
  assert.match(fn, /:predict\?key=/)
  assert.match(fn, /:generateContent\?key=/)
  assert.match(fn, /responseModalities: \['IMAGE', 'TEXT'\]/)
  assert.match(fn, /const order = configured\s*\n?\s*\? \[configured\]/)
  assert.match(fn, /const isImagen = model\.startsWith\('imagen'\)/)
})

test('em caso de falha devolve o detalhe e os modelos disponíveis no projeto', () => {
  assert.match(fn, /error: quota \? 'quota' : permission \? 'permission' : noImage \? 'no_image' : 'sem_modelo_de_imagem'/)
  assert.match(fn, /disponiveis: found\.all\.filter/)
})

test('modo "art" muda o lead do Gemini (peça gráfica, não fotografia)', () => {
  assert.match(fn, /const mode: Mode = body\.mode === 'art' \? 'art' : 'photo'/)
  assert.match(fn, /mode === 'art'/)
  assert.match(fn, /peça gráfica editorial completa/)
  assert.match(ai, /generateFullArt/)
  assert.match(ai, /mode: 'art'/)
})

test('estudioAi.generateImage mapeia formato e mostra os modelos disponíveis no erro', () => {
  assert.match(ai, /functions\.invoke\('estudio-generate-image'/)
  assert.match(ai, /'feed-45': '3:4'/)
  assert.match(ai, /d\?\.disponiveis/)
  assert.match(ai, /sem_modelo_de_imagem/)
  assert.doesNotMatch(ai, /GEMINI_API_KEY/)
})
