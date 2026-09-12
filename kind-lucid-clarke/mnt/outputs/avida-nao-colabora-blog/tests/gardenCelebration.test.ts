import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const celebration = readFileSync(new URL('../src/components/garden/GardenCelebration.tsx', import.meta.url), 'utf8')
const garden = readFileSync(new URL('../src/components/MyGardenPage.tsx', import.meta.url), 'utf8')

test('celebração de jardim concluído usa exatamente o texto e o botão pedidos', () => {
  assert.match(celebration, /Seu jardim floresceu por completo\./)
  assert.match(celebration, /Você chegou aos 100%\./)
  assert.match(celebration, /O que começou com pequenos cuidados agora ocupa todo esse espaço\./)
  assert.match(celebration, /Parabéns por cultivar até aqui\./)
  assert.match(celebration, /🌿|Leaf/) // ícone de folha substitui/acompanha o emoji
  assert.match(celebration, />\s*Ver minha jornada\s*</)
})

test('celebração tem a coreografia pedida: luz varrendo antes do texto, entradas escalonadas, brilho e folhas que não repetem', () => {
  assert.match(celebration, /gc-sweep/) // luz percorrendo o jardim antes da mensagem
  assert.match(celebration, /gcFadeScale/) // linha 1: fade + scale de ~96% a 100%
  assert.match(celebration, /gcSlideFade/) // linha 2: desliza + fade
  assert.match(celebration, /gcGlow/) // brilho quente na última linha
  assert.match(celebration, /gc-leaf1[\s\S]*gc-leaf2[\s\S]*gc-leaf3/) // 2-3 folhas
  assert.match(celebration, /\bgcLeaf\b[\s\S]*?\s1\s+both/) // iteration-count 1 — não repete
  assert.doesNotMatch(celebration, /infinite/) // nada roda pra sempre
})

test('celebração respeita prefers-reduced-motion e usa a imagem "completo" do tema', () => {
  assert.match(celebration, /prefers-reduced-motion: reduce/)
  assert.match(celebration, /theme\.stages\[3\]/)
  assert.match(celebration, /animation: none !important/)
})

test('celebração dispara só na virada de jardim (garden_index sobe), uma única vez, via localStorage', () => {
  assert.match(garden, /LAST_GARDEN_KEY_PREFIX/)
  assert.match(garden, /prev!=null&&!Number\.isNaN\(prev\)&&nextIndex>prev/) // nunca na 1ª visita (sem baseline)
  assert.match(garden, /window\.localStorage\.setItem\(key,String\(nextIndex\)\)/)
  assert.match(garden, /catch\{/) // localStorage indisponível não deve quebrar a página
})

test('"Ver minha jornada" fecha a celebração e rola até Memórias do Jardim', () => {
  assert.match(garden, /function goToHistory\(\)\{/)
  assert.match(garden, /memoriesRef\.current\?\.scrollIntoView/)
  assert.match(garden, /<section ref=\{memoriesRef\}/)
  assert.match(garden, /<GardenCelebration theme=\{celebrationTheme\} onViewHistory=\{goToHistory\}/)
})

test('hero do Meu Jardim libera a foto do jardim — menos cartões flutuando sobre a imagem', () => {
  assert.doesNotMatch(garden, /Todo progresso,/) // cartão decorativo saiu de cima da foto
  assert.doesNotMatch(garden, /absolute bottom-8 left-5 right-5/) // "Jardim atual" não flutua mais sobre a imagem
  assert.match(garden, /bg-\[#fffaf1\]\/\[0\.72\]/) // resta só o cartão de introdução, sobre a foto
  assert.match(garden, /Sua trajetória ganha forma aos poucos/) // texto editorial preservado (tests/desktopAuditFixes.test.ts)
})

test('cartão de introdução no hero é estreito e alto (não largo), como pedido', () => {
  // largura fixa e estreita em vez do max-w largo anterior — o card fica em pé, não deitado
  assert.match(garden, /w-\[220px\][^"]*flex-col[^"]*justify-between/)
  assert.doesNotMatch(garden, /max-w-\[460px\]/)
})

test('a altura do hero e das miniaturas usa proporção que corta bem menos da foto original (16:9)', () => {
  // clamp() com um vw preferencial mantém a largura cheia da seção (evita o bug de
  // aspect-ratio+max-height encolher a LARGURA pra manter a proporção) enquanto limita
  // o quanto a altura cresce em telas muito largas — reduz o corte de topo/base.
  assert.match(garden, /h-\[clamp\(\d+px,\d+vw,\d+px\)\]/)
  assert.doesNotMatch(garden, /\baspect-\[[^\]]+\][^"]*\bmax-h-\[/) // não repetir o bug aspect-ratio+max-height
  // miniaturas de "Memórias do Jardim": aspect-ratio mais próximo da foto original em vez de h-28 fixo
  assert.match(garden, /aspect-\[4\/3\]/)
  assert.doesNotMatch(garden, /relative h-28 overflow-hidden/)
})
