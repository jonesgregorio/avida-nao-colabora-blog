import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const celebration = readFileSync(new URL('../src/components/garden/GardenCelebration.tsx', import.meta.url), 'utf8')
const garden = readFileSync(new URL('../src/components/MyGardenPage.tsx', import.meta.url), 'utf8')

test('celebração de jardim concluído usa o novo texto e as duas ações', () => {
  assert.match(celebration, /Seu jardim floresceu por completo\./)
  assert.match(celebration, /Os pequenos momentos de cuidado que você registrou ao longo do caminho transformaram este espaço\./)
  assert.match(celebration, /Este jardim agora fica guardado na sua história — e um novo começa a crescer no seu ritmo\./)
  assert.match(celebration, /Que bom ter você por aqui\. 🌿/)
  assert.doesNotMatch(celebration, /Você chegou aos 100%\./)
  assert.match(celebration, />\s*Ver meu jardim concluído\s*</)
  assert.match(celebration, />\s*Conhecer o novo jardim\s*</)
})

test('celebração tem a coreografia pedida: luz varrendo antes do texto, entradas escalonadas, brilho e folhas que não repetem', () => {
  assert.match(celebration, /gc-sweep/)
  assert.match(celebration, /gcFadeScale/)
  assert.match(celebration, /gcSlideFade/)
  assert.match(celebration, /gcGlow/)
  assert.match(celebration, /gc-leaf1[\s\S]*gc-leaf2[\s\S]*gc-leaf3/)
  assert.match(celebration, /\bgcLeaf\b[\s\S]*?\s1\s+both/)
  assert.doesNotMatch(celebration, /infinite/)
})

test('celebração respeita prefers-reduced-motion e usa a imagem "completo" do tema', () => {
  assert.match(celebration, /prefers-reduced-motion: reduce/)
  assert.match(celebration, /theme\.stages\[theme\.stages\.length - 1\]/)
  assert.match(celebration, /animation: none !important/)
})

test('celebração local continua disparando só na virada de jardim, uma única vez, via localStorage', () => {
  assert.match(garden, /LAST_GARDEN_KEY_PREFIX/)
  assert.match(garden, /prev!=null&&!Number\.isNaN\(prev\)&&nextIndex>prev/)
  assert.match(garden, /window\.localStorage\.setItem\(key,String\(nextIndex\)\)/)
  assert.match(garden, /catch\{/)
})

test('"Ver meu jardim concluído" fecha a celebração local e rola até Memórias do Jardim', () => {
  assert.match(garden, /function goToHistory\(\)\{/)
  assert.match(garden, /memoriesRef\.current\?\.scrollIntoView/)
  assert.match(garden, /<section ref=\{memoriesRef\}/)
  assert.match(garden, /<GardenCelebration theme=\{celebrateTheme\} onViewHistory=\{goToHistory\}/)
})

test('cabeçalho do Meu Jardim é uma faixa curta e larga ANTES da foto, não um cartão sobre ela', () => {
  const headerIdx = garden.indexOf('Um espaço que cresce com você')
  const heroSectionIdx = garden.indexOf('aspect-[1672/941]')
  assert.ok(headerIdx > -1 && heroSectionIdx > -1 && headerIdx < heroSectionIdx, 'o texto de introdução precisa vir ANTES da seção do hero no markup')
  assert.doesNotMatch(garden, /absolute[^"]*bg-\[#fffaf1\]/)
  assert.doesNotMatch(garden, /backdrop-blur-sm[^"]*bg-\[#fffaf1\]|bg-\[#fffaf1\][^"]*backdrop-blur-sm/)
  assert.match(garden, /Sua trajetória ganha forma aos poucos/)
})

test('cabeçalho é baixo e ocupa a largura toda (layout deitado, não em pé)', () => {
  assert.match(garden, /sm:flex-row sm:items-end sm:justify-between/)
  assert.doesNotMatch(garden, /w-\[220px\]/)
  assert.doesNotMatch(garden, /flex-col justify-between gap-5 rounded-\[22px\]/)
})

test('o hero mostra a foto inteira, sem cortar nada — proporção trava no tamanho exato da imagem-base', () => {
  assert.match(garden, /aspect-\[1672\/941\]/)
  assert.doesNotMatch(garden, /\baspect-\[[^\]]+\][^"]*\bmax-h-\[/)
  assert.doesNotMatch(garden, /h-\[clamp\(/)
  assert.match(garden, /aspect-\[4\/3\]/)
  assert.doesNotMatch(garden, /relative h-28 overflow-hidden/)
})
