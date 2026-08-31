import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const estudio = readFileSync(new URL('../src/components/admin/AdminEstudio.tsx', import.meta.url), 'utf8')
const render = readFileSync(new URL('../src/lib/estudioRender.ts', import.meta.url), 'utf8')

test('snapshot aceita scale para render em alta e valida contra a dimensão multiplicada', () => {
  assert.match(render, /opts: \{ transparent\?: boolean; scale\?: number \}/)
  assert.match(render, /width: spec\.width \* scale, height: spec\.height \* scale/)
})

test('cada arte gerada tem baixar, alta 2x e remover', () => {
  assert.match(estudio, /onClick=\{\(\) => downloadAsset\(a\)\}/)
  assert.match(estudio, /onClick=\{\(\) => baixarAlta\(a\)\}/)
  assert.match(estudio, /onClick=\{\(\) => remover\(a\.filename\)\}/)
  assert.match(estudio, /a\.filename\.replace\(\/\\\.png\$\/, '@2x\.png'\)/)
  assert.match(estudio, /\{ scale: 2 \}/)
})

test('há campo manual para a frase da arte, usado nos dois tipos', () => {
  assert.match(estudio, /<Field>Frase da arte/)
  assert.match(estudio, /value=\{draft\.titulo\}/)
  assert.match(estudio, /onChange=\{e => patch\(\{ titulo: e\.target\.value \}\)\}/)
})

test('imagem da pessoa por IA pode ser apagada e melhorada em nitidez', () => {
  assert.match(estudio, /apagar imagem/)
  assert.match(estudio, /Melhorar nitidez/)
  assert.match(estudio, /gerarFotoIA\(true\)/)
  assert.match(estudio, /Alta resolução, foco nítido/)
})
