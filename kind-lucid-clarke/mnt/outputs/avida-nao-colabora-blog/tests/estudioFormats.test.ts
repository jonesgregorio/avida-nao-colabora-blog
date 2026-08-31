import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FORMAT_SPECS, validateAsset, safeInsets } from '../src/lib/estudioFormats.ts'

test('specs batem com as dimensões oficiais do Instagram', () => {
  assert.deepEqual([FORMAT_SPECS['feed-45'].width, FORMAT_SPECS['feed-45'].height], [1080, 1350])
  assert.deepEqual([FORMAT_SPECS['feed-11'].width, FORMAT_SPECS['feed-11'].height], [1080, 1080])
  assert.deepEqual([FORMAT_SPECS.story.width, FORMAT_SPECS.story.height], [1080, 1920])
  assert.deepEqual([FORMAT_SPECS['reel-capa'].width, FORMAT_SPECS['reel-capa'].height], [1080, 1920])
  assert.equal(FORMAT_SPECS.carrossel.ratio, 4 / 5)
})

test('validateAsset aprova a arte no tamanho exato', () => {
  const r = validateAsset(FORMAT_SPECS['feed-45'], { width: 1080, height: 1350, bytes: 400_000 })
  assert.equal(r.ok, true)
  assert.deepEqual(r.problems, [])
})

test('validateAsset reprova dimensão errada, proporção fora da faixa e arquivo pesado', () => {
  const dim = validateAsset(FORMAT_SPECS['feed-45'], { width: 1000, height: 1350, bytes: 1000 })
  assert.equal(dim.ok, false)
  assert.match(dim.problems.join(' '), /dimensão/)

  const heavy = validateAsset(FORMAT_SPECS.story, { width: 1080, height: 1920, bytes: 40 * 1024 * 1024 })
  assert.equal(heavy.ok, false)
  assert.match(heavy.problems.join(' '), /acima do limite/)

  const empty = validateAsset(FORMAT_SPECS.story, { width: 1080, height: 1920, bytes: 0 })
  assert.equal(empty.ok, false)
})

test('story e reel declaram zona segura; feed não', () => {
  assert.ok(safeInsets(FORMAT_SPECS.story).top > 0)
  assert.ok(safeInsets(FORMAT_SPECS['reel-capa']).bottom > 0)
  assert.equal(safeInsets(FORMAT_SPECS['feed-45']).top, 0)
})

test('render usa html2canvas sob demanda e passa pelo validador', () => {
  const src = readFileSync(new URL('../src/lib/estudioRender.ts', import.meta.url), 'utf8')
  assert.match(src, /await import\('html2canvas'\)/)
  assert.match(src, /validateAsset\(/)
  assert.match(src, /document\.fonts\?\.ready/)
})
