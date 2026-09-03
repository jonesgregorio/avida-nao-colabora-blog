import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/MonthlyDeepReportMockup.tsx', import.meta.url), 'utf8')

test('relatório mensal repete a paleta com segurança quando houver seis emoções', () => {
  assert.match(source, /const tone=\(i:number\)=>tones\[i%tones\.length\]/)
  assert.match(source, /tone\(x\)\.split\(' '\)\[0\]/)
  assert.doesNotMatch(source, /tones\[x\]\.split/)
})
