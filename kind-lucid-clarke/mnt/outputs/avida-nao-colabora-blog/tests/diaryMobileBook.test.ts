import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const history = readFileSync(new URL('../src/components/DiaryHistorySection.tsx', import.meta.url), 'utf8')
const mobileCss = readFileSync(new URL('../src/diary-mobile.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('diário mobile usa uma página por vez sem alterar o livro desktop', () => {
  assert.match(history, /data-diary-mobile-page/)
  assert.match(history, /lg:hidden/)
  assert.match(history, /hidden lg:block/)
  assert.match(history, /mobilePage === 'calendar'/)
  assert.match(history, /Voltar ao calendário/)
  assert.match(history, /setMobilePage\('day'\)/)
})

test('escrita mobile reaproveita o DOM desktop como páginas horizontais', () => {
  assert.match(mobileCss, /max-width: 1023px/)
  assert.match(mobileCss, /scroll-snap-type: x mandatory/)
  assert.match(mobileCss, /textarea\[aria-label="Texto do diário"\]/)
  assert.match(mobileCss, /repeating-linear-gradient/)
  assert.match(main, /import '\.\/diary-mobile\.css'/)
})
