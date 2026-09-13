import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const hero = readFileSync(new URL('../src/components/Hero.tsx', import.meta.url), 'utf8')

// Bug real do Tailwind (confirmado em sessão anterior, testado com build limpo): o modificador
// curto `bg-[#hex]/NN` (sem colchetes) só gera CSS quando NN é múltiplo de 5. `/82` é descartado
// silenciosamente pelo tailwindcss@3.4.4 deste projeto — o botão CTA da home ficava com fundo
// totalmente transparente abaixo do breakpoint sm (640px), onde `sm:bg-white/20` deixa de
// sobrescrever. `/[0.82]` (com colchetes) sempre funciona, independente do valor.

test('botão "Conheça os planos" do Hero não usa mais o modificador de opacidade quebrado (/82 não-múltiplo-de-5)', () => {
  assert.doesNotMatch(hero, /bg-\[#fffaf1\]\/82\b/)
  assert.match(hero, /bg-\[#fffaf1\]\/\[0\.82\]/)
})

test('a borda do mesmo botão continua com o modificador curto (/55 é múltiplo de 5, funciona normalmente)', () => {
  assert.match(hero, /border-\[#5d5148\]\/55/)
})
