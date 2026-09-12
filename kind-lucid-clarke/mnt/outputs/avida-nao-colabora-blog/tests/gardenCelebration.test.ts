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

test('cabeçalho do Meu Jardim é uma faixa curta e larga ANTES da foto, não um cartão sobre ela', () => {
  // "Meu Jardim" e o H1 ficam numa faixa própria, em fluxo normal, antes da <section> do hero —
  // não mais dentro dela nem posicionados de forma absoluta por cima da imagem.
  const headerIdx = garden.indexOf('Um espaço que cresce com você')
  const heroSectionIdx = garden.indexOf('aspect-[1672/941]')
  assert.ok(headerIdx > -1 && heroSectionIdx > -1 && headerIdx < heroSectionIdx, 'o texto de introdução precisa vir ANTES da seção do hero no markup')
  assert.doesNotMatch(garden, /absolute[^"]*bg-\[#fffaf1\]/) // nada flutuando sobre a foto com fundo de cartão
  assert.doesNotMatch(garden, /backdrop-blur-sm[^"]*bg-\[#fffaf1\]|bg-\[#fffaf1\][^"]*backdrop-blur-sm/) // sem cartão translúcido sobre a imagem
  assert.match(garden, /Sua trajetória ganha forma aos poucos/) // texto editorial preservado (tests/desktopAuditFixes.test.ts)
})

test('cabeçalho é baixo e ocupa a largura toda (layout deitado, não em pé)', () => {
  // flex-row (não flex-col) a partir de sm: título de um lado, texto do outro — largo, não alto.
  assert.match(garden, /sm:flex-row sm:items-end sm:justify-between/)
  assert.doesNotMatch(garden, /w-\[220px\]/) // não existe mais o cartão estreito
  assert.doesNotMatch(garden, /flex-col justify-between gap-5 rounded-\[22px\]/) // não existe mais o cartão em pé
})

test('o hero mostra a foto inteira, sem cortar nada — proporção trava no tamanho exato da imagem-base', () => {
  // 1672×941 é o quadro exato em que as imagens dos 8 jardins foram compostas (VW/VH em
  // livingGardenEngine.ts). Travar a seção nessa proporção elimina qualquer corte de
  // object-cover, porque a caixa nunca fica desproporcional à imagem.
  assert.match(garden, /aspect-\[1672\/941\]/)
  assert.doesNotMatch(garden, /\baspect-\[[^\]]+\][^"]*\bmax-h-\[/) // não reintroduzir aspect-ratio+max-height (encolhe a largura)
  assert.doesNotMatch(garden, /h-\[clamp\(/) // técnica anterior (ainda cortava em telas largas) foi substituída
  // miniaturas de "Memórias do Jardim" continuam com proporção próxima à foto original em vez de h-28 fixo
  assert.match(garden, /aspect-\[4\/3\]/)
  assert.doesNotMatch(garden, /relative h-28 overflow-hidden/)
})
