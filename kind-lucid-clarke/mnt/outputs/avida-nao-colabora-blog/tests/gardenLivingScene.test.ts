import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GARDEN_STAGE_NAMES, GARDEN_STAGE_NAMES_6, GARDEN_THEMES, gardenThemeFor, gardenVisualProgress } from '../src/lib/gardenThemes.ts'

// Contrato dos jardins fotorrealistas (imagem renderizada + camada de movimento em canvas)
// que substituem a ilustração SVG abstrata em MyGardenPage. Cobre o que gardenEcosystem.test.ts
// e myGarden.test.ts não checam: a config em si, os arquivos de imagem no disco e o respeito a
// prefers-reduced-motion no motor/componente.

const engine = readFileSync(new URL('../src/lib/livingGardenEngine.ts', import.meta.url), 'utf8')
const livingGarden = readFileSync(new URL('../src/components/garden/LivingGarden.tsx', import.meta.url), 'utf8')
const publicDir = fileURLToPath(new URL('../public', import.meta.url))

const EXPECTED_SLUGS_4 = ['japones', 'cottage', 'mediterraneo', 'mata-atlantica', 'giverny', 'deserto', 'noturno', 'nordico']
// Jardins mais novos, com 6 imagens em vez de 4.
const EXPECTED_SLUGS_6 = ['bali', 'sakura', 'provence', 'marrocos']

test('os 12 jardins existem, com slugs únicos e label visível', () => {
  assert.equal(GARDEN_THEMES.length, 12)
  const slugs = GARDEN_THEMES.map((t) => t.slug)
  assert.deepEqual([...slugs].sort(), [...EXPECTED_SLUGS_4, ...EXPECTED_SLUGS_6].sort())
  assert.equal(new Set(slugs).size, 12)
  for (const theme of GARDEN_THEMES) assert.ok(theme.label.length > 0, `${theme.slug} precisa de um label`)
})

test('os 8 jardins originais têm 4 imagens de estágio e os arquivos existem em public/gardens', () => {
  for (const theme of GARDEN_THEMES.filter((t) => EXPECTED_SLUGS_4.includes(t.slug))) {
    assert.equal(theme.stages.length, 4)
    for (const src of theme.stages) {
      assert.match(src, new RegExp(`^/gardens/${theme.slug}/`))
      assert.ok(existsSync(`${publicDir}${src}`), `arquivo ausente no disco: ${src}`)
    }
  }
})

test('jardins novos têm 6 imagens de estágio e os arquivos existem em public/gardens', () => {
  for (const theme of GARDEN_THEMES.filter((t) => EXPECTED_SLUGS_6.includes(t.slug))) {
    assert.equal(theme.stages.length, 6)
    for (const src of theme.stages) {
      assert.match(src, new RegExp(`^/gardens/${theme.slug}/`))
      assert.ok(existsSync(`${publicDir}${src}`), `arquivo ausente no disco: ${src}`)
    }
  }
})

test('gardenThemeFor nunca termina — qualquer índice resolve a um jardim válido e o ciclo se repete a cada 12', () => {
  for (const index of [0, 1, 11, 12, 23, 24, 1000, 1000000]) {
    assert.ok(GARDEN_THEMES.includes(gardenThemeFor(index)))
  }
  assert.equal(gardenThemeFor(0).slug, gardenThemeFor(12).slug)
  assert.equal(gardenThemeFor(3).slug, gardenThemeFor(15).slug)
})

test('gardenVisualProgress (4 imagens, default) mapeia o ciclo de 60 passos (v4) para 0..1 sem nunca estourar', () => {
  assert.equal(gardenVisualProgress(0), 0)
  assert.equal(gardenVisualProgress(50), 1)
  assert.equal(gardenVisualProgress(59), 1) // jardim maduro (gp>=50) fica travado na imagem final
  for (let gp = -5; gp <= 70; gp++) {
    const p = gardenVisualProgress(gp)
    assert.ok(p >= 0 && p <= 1, `gardenVisualProgress(${gp}) saiu de 0..1: ${p}`)
  }
  assert.ok(gardenVisualProgress(10) > gardenVisualProgress(9)) // crescente através do limiar de estágio
})

test('gardenVisualProgress (6 imagens) usa os thresholds de garden_settings e trava na imagem final a partir de gp=39', () => {
  assert.equal(gardenVisualProgress(0, 6), 0)
  assert.equal(gardenVisualProgress(39, 6), 1)
  assert.equal(gardenVisualProgress(59, 6), 1)
  for (let gp = -5; gp <= 70; gp++) {
    const p = gardenVisualProgress(gp, 6)
    assert.ok(p >= 0 && p <= 1, `gardenVisualProgress(${gp},6) saiu de 0..1: ${p}`)
  }
  assert.ok(gardenVisualProgress(3, 6) > gardenVisualProgress(2, 6)) // primeiro limiar (gp=3) já move a imagem
})

test('4 nomes de estágio para os jardins originais, na ordem das imagens', () => {
  assert.deepEqual(GARDEN_STAGE_NAMES, ['recém-plantado', 'pegando', 'maduro', 'completo'])
})

test('6 nomes de estágio para os jardins novos, na ordem das imagens', () => {
  assert.deepEqual(GARDEN_STAGE_NAMES_6, ['recém-plantado', 'brotando', 'enraizando', 'ganhando forma', 'florescendo', 'completo'])
})

test('só o jardim japonês declara lago de carpas (koi) — os outros não', () => {
  const koiSlugs = GARDEN_THEMES.filter((t) => t.koi).map((t) => t.slug)
  assert.deepEqual(koiSlugs, ['japones'])
})

test('motor de movimento e componente respeitam prefers-reduced-motion', () => {
  assert.match(engine, /getReduced\(\)/)
  assert.match(engine, /if \(!reduced/)
  assert.match(livingGarden, /prefers-reduced-motion: reduce/)
  assert.match(livingGarden, /reducedRef/)
})

test('o motor limpa listeners e cancela o loop de animação ao trocar/desmontar o jardim', () => {
  assert.match(engine, /function destroy\(\)/)
  assert.match(engine, /cancelAnimationFrame\(rafId\)/)
  assert.match(engine, /destroyed = true/)
  assert.match(livingGarden, /\[theme\.slug\]/) // engine reinicia quando o jardim muda
})
