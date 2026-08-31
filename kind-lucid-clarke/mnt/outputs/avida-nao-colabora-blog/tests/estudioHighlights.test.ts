import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_HIGHLIGHTS, HIGHLIGHT_SPEC, slugifyLabel, highlightFilename, newHighlight,
} from '../src/lib/estudioHighlights.ts'
import { FORMAT_SPECS } from '../src/lib/estudioFormats.ts'

test('jogo padrão cobre as áreas do app', () => {
  const labels = DEFAULT_HIGHLIGHTS.map(h => h.label)
  assert.ok(labels.includes('Comece aqui'))
  assert.ok(labels.includes('Diário'))
  assert.ok(labels.includes('Do blog'))
  assert.equal(new Set(DEFAULT_HIGHLIGHTS.map(h => h.id)).size, DEFAULT_HIGHLIGHTS.length)
})

test('capa de destaque é 1080x1920 e existe em FORMAT_SPECS', () => {
  assert.deepEqual([HIGHLIGHT_SPEC.width, HIGHLIGHT_SPEC.height], [1080, 1920])
  assert.deepEqual([FORMAT_SPECS.destaque.width, FORMAT_SPECS.destaque.height], [1080, 1920])
})

test('slug e filename higienizam o nome', () => {
  assert.equal(slugifyLabel('Comece Aqui!'), 'comece-aqui')
  assert.equal(slugifyLabel('  '), 'destaque')
  assert.equal(highlightFilename({ id: 'x', emoji: '🌱', label: 'Do Blog' }), 'destaque-do-blog-1080x1920.png')
})

test('newHighlight gera ids únicos', () => {
  const a = newHighlight()
  const b = newHighlight()
  assert.notEqual(a.id, b.id)
  assert.equal(a.label, 'Novo destaque')
})

test('template usa a marca e não segue tema do painel', () => {
  const src = readFileSync(new URL('../src/components/admin/estudio/HighlightCoverTemplate.tsx', import.meta.url), 'utf8')
  assert.match(src, /#1A4A3A/)
  assert.match(src, /Playfair Display/)
  assert.match(src, /1080/)
})
