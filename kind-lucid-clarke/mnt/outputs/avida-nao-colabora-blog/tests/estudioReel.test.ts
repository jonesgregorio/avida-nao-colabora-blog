import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildReelScriptRequest, parseReelScript, reelScriptToText, overlayTexts } from '../src/lib/estudioReel.ts'

const brief = { ideia: 'sinais de esgotamento no trabalho', objetivos: ['alcance'], estilo: 'template' as const }

test('prompt do roteiro pede JSON com gancho, blocos e texto_na_tela curto', () => {
  const p = buildReelScriptRequest(brief)
  assert.match(p, /"gancho"/)
  assert.match(p, /"texto_na_tela"/)
  assert.match(p, /até ~7 palavras/)
  assert.match(p, /abra com o gancho mais forte/) // hint do objetivo "alcance"
  assert.match(p, /SOMENTE um JSON/)
})

test('parseReelScript normaliza os blocos e descarta bloco vazio', () => {
  const s = parseReelScript({
    gancho: 'Você não está preguiçoso.',
    blocos: [
      { tempo: '0-3s', fala: 'Fala 1', texto_na_tela: 'Não é preguiça' },
      { tempo: '', fala: '', texto_na_tela: '' },
      { fala: 'Fala 3' },
    ],
    audio_sugestao: 'instrumental calmo',
    cta: 'Salva pra lembrar',
  })
  assert.equal(s.blocos.length, 2)
  assert.equal(s.blocos[0].textoNaTela, 'Não é preguiça')
  assert.equal(s.cta, 'Salva pra lembrar')
})

test('overlayTexts inclui o gancho + cada texto_na_tela não vazio', () => {
  const s = parseReelScript({
    gancho: 'G',
    blocos: [{ fala: 'x', texto_na_tela: 'A' }, { fala: 'y', texto_na_tela: '' }, { fala: 'z', texto_na_tela: 'B' }],
  })
  assert.deepEqual(overlayTexts(s), ['G', 'A', 'B'])
})

test('reelScriptToText numera os overlays e explica o uso', () => {
  const s = parseReelScript({ gancho: 'G', blocos: [{ fala: 'f', texto_na_tela: 'T1' }], audio_sugestao: 'a', cta: 'c' })
  const txt = reelScriptToText(s)
  assert.match(txt, /overlay-01\.png/)
  assert.match(txt, /PNG transparentes 1080x1920/)
})

test('snapshot aceita fundo transparente para os overlays', () => {
  const src = readFileSync(new URL('../src/lib/estudioRender.ts', import.meta.url), 'utf8')
  assert.match(src, /transparent \? null : '#FBFAF7'/)
})

test('buildZip inclui reel-roteiro.txt quando presente', () => {
  const src = readFileSync(new URL('../src/lib/estudioPackage.ts', import.meta.url), 'utf8')
  assert.match(src, /if \(draft\.reelRoteiro\) zip\.file\('reel-roteiro\.txt'/)
})
