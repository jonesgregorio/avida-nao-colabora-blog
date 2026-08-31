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
  // onda inferior + blob superior + círculos + sprig
  assert.match(brand, /onda verde inferior/)
  assert.match(brand, /blob verde canto superior direito/)
  assert.match(brand, /sprig botânico/)
})

test('variante "pessoa" compõe a foto real num círculo e mostra placeholder sem foto', () => {
  assert.match(brand, /variant === 'pessoa'/)
  assert.match(brand, /borderRadius: '50%'/)
  assert.match(brand, /suba uma foto/)
  assert.match(brand, /objectFit: 'cover'/)
})

test('o Estúdio usa BrandTemplate (não o FormatTemplate antigo) e oferece a escolha de tipo', () => {
  assert.match(estudio, /import BrandTemplate/)
  assert.doesNotMatch(estudio, /FormatTemplate/)
  assert.match(estudio, /Tipo de arte/)
  assert.match(estudio, /Arte com frase/)
  assert.match(estudio, /Arte com pessoa/)
  assert.match(estudio, /tipoArte: 'frase' \| 'pessoa'/)
  // foto fica só no navegador
  assert.match(estudio, /readAsDataURL/)
  assert.match(estudio, /Fica só no seu navegador/)
})

test('o tipo de arte vai no brief da IA de imagem', () => {
  assert.match(estudio, /tipoArte: d\.tipoArte/)
})
