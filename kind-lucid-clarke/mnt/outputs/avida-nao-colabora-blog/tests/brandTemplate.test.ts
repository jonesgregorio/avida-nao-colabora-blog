import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

const brand = read('../src/components/admin/estudio/BrandTemplate.tsx')
const estudio = read('../src/components/admin/AdminEstudio.tsx')

test('BrandTemplate tem as duas variantes e a moldura da marca', () => {
  assert.match(brand, /export type TemplateVariant = 'frase' \| 'pessoa'/)
  assert.match(brand, /#FBFAF7/) // creme
  assert.match(brand, /#1A4A3A/) // floresta
  assert.match(brand, /A Vida Não Colabora/)
  assert.match(brand, /Seu espaço de cuidado/)
  assert.match(brand, /onda verde inferior/)
  assert.match(brand, /sombra de folhas/) // folhagem desfocada à esquerda
})

test('variante "pessoa": recorte grande da foto, ajustável, com contorno fino', () => {
  assert.match(brand, /variant === 'pessoa'/)
  assert.match(brand, /suba uma foto/)
  // recorte configurável, não travado no círculo
  assert.match(brand, /export type PhotoShape = 'circle' \| 'rounded' \| 'rect' \| 'full'/)
  assert.match(brand, /backgroundSize: `\$\{baseCover \* zoom\}%`/)
  assert.match(brand, /backgroundPosition: `\$\{50 \+ offX \* 50\}% \$\{50 \+ offY \* 50\}%`/)
  assert.match(brand, /contorno fino verde/)
})

test('a frase tem ajustes de tamanho, posição, cor e sobrepor', () => {
  assert.match(brand, /export interface TitleAdjust/)
  assert.match(brand, /onPhoto\?: boolean/)
  assert.match(brand, /const tScale = clamp\(title\.scale/)
  assert.match(brand, /placement: TitlePlacement/)
})

test('o Estúdio usa BrandTemplate (não o FormatTemplate antigo) e oferece a escolha de tipo', () => {
  assert.match(estudio, /import BrandTemplate/)
  assert.doesNotMatch(estudio, /FormatTemplate/)
  assert.match(estudio, /tipoArte: 'frase' \| 'pessoa'/)
  assert.match(estudio, /readAsDataURL/)
})

test('o tipo de arte vai no brief da IA de imagem', () => {
  assert.match(estudio, /tipoArte: d\.tipoArte/)
})
