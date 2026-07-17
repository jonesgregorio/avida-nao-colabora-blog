// ============================================================================
// Exporta os PNGs da marca a partir dos SVGs de public/brand/
// ============================================================================
// Rodar:  node scripts/export-brand.mjs
// Requer (temporários, instalar com --no-save):
//   npm install --no-save @resvg/resvg-js @fontsource/playfair-display wawoff2
//
// POR QUE A FONTE IMPORTA:
// A logo usa Playfair Display. Um rasterizador SEM a fonte não falha — ele
// simplesmente não desenha o texto (verificado: 0 pixels na área do texto) ou
// troca por uma fonte substituta. Os dois casos entregariam uma logo diferente
// da que está no site. Por isso convertemos o woff2 real do @fontsource para
// TTF (o resvg não lê woff/woff2) e o passamos explicitamente.
//
// NADA aqui é redesenhado: os SVGs de origem copiam os paths de
// src/components/Logo.tsx e as medidas foram tiradas da logo renderizada em
// produção (fonte 400, 20px, gap 10px, #123528 / #1A4A3A).
// ============================================================================

import { Resvg } from '@resvg/resvg-js'
import { decompress } from 'wawoff2'
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = process.cwd()
const BRAND = path.join(RAIZ, 'public', 'brand')
const TMP = path.join(RAIZ, '.brand-tmp')
const WOFF2 = path.join(RAIZ, 'node_modules/@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2')

function prepararFonte() {
  fs.mkdirSync(TMP, { recursive: true })
  const ttf = path.join(TMP, 'PlayfairDisplay-Regular.ttf')
  if (!fs.existsSync(ttf)) {
    const bytes = fs.readFileSync(WOFF2)
    // decompress é async (wasm), mas o retorno é aguardado no main().
    return decompress(bytes).then((out) => { fs.writeFileSync(ttf, Buffer.from(out)); return ttf })
  }
  return Promise.resolve(ttf)
}

function render(svgPath, largura, fontes) {
  const svg = fs.readFileSync(svgPath, 'utf8')
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: largura },
    font: { fontFiles: fontes, loadSystemFonts: false, defaultFontFamily: 'Playfair Display' },
    background: 'rgba(0,0,0,0)', // fundo transparente
  })
  return r.render().asPng()
}

async function main() {
  const ttf = await prepararFonte()
  const fontes = [ttf]
  fs.mkdirSync(BRAND, { recursive: true })

  const icone = path.join(BRAND, 'logo-icon.svg')
  const horizontal = path.join(BRAND, 'logo-horizontal.svg')
  const horizontalDark = path.join(BRAND, 'logo-horizontal-dark.svg')

  const saidas = [
    // Horizontal (cabeçalho do site) — proporção 225x32
    { svg: horizontal, largura: 450, nome: 'logo-horizontal.png' },
    { svg: horizontal, largura: 900, nome: 'logo-horizontal@2x.png' },
    { svg: horizontal, largura: 1800, nome: 'logo-original.png' },
    { svg: horizontalDark, largura: 900, nome: 'logo-horizontal-dark.png' },
    // Ícone quadrado (perfil, redes, cards)
    { svg: icone, largura: 512, nome: 'logo-quadrada.png' },
    { svg: icone, largura: 1024, nome: 'logo-quadrada@2x.png' },
    // Menu / admin
    { svg: icone, largura: 64, nome: 'logo-menu.png' },
    { svg: icone, largura: 128, nome: 'logo-admin.png' },
    // Favicons
    { svg: icone, largura: 16, nome: 'favicon-16.png' },
    { svg: icone, largura: 32, nome: 'favicon-32.png' },
    { svg: icone, largura: 48, nome: 'favicon-48.png' },
    { svg: icone, largura: 180, nome: 'apple-touch-icon-180.png' },
    { svg: icone, largura: 512, nome: 'logo-favicon.png' },
  ]

  let ok = 0
  for (const s of saidas) {
    if (!fs.existsSync(s.svg)) { console.log(`  pulado (SVG ausente): ${s.nome}`); continue }
    const png = render(s.svg, s.largura, fontes)
    fs.writeFileSync(path.join(BRAND, s.nome), png)
    console.log(`  ok  ${s.nome.padEnd(28)} ${String(s.largura).padStart(4)}px  ${(png.length / 1024).toFixed(1)} KB`)
    ok++
  }

  // ── Verificação: o texto REALMENTE saiu nos horizontais? ──
  for (const svgPath of [horizontal, horizontalDark]) {
    if (!fs.existsSync(svgPath)) continue
    const svg = fs.readFileSync(svgPath, 'utf8')
    const img = new Resvg(svg, {
      fitTo: { mode: 'width', value: 900 },
      font: { fontFiles: fontes, loadSystemFonts: false, defaultFontFamily: 'Playfair Display' },
    }).render()
    const { width, height, pixels } = img
    const inicioTexto = Math.floor((42 / 225) * width)
    let opacos = 0
    for (let y = 0; y < height; y++) {
      for (let x = inicioTexto; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] > 10) opacos++
      }
    }
    const nome = path.basename(svgPath)
    if (opacos === 0) {
      console.error(`\n✗ FALHA: o texto não renderizou em ${nome}. A fonte não foi aplicada — os PNGs sairiam só com o ícone.`)
      process.exit(1)
    }
    console.log(`  verificado: texto presente em ${nome} (${opacos} px)`)
  }

  console.log(`\n✓ ${ok} arquivos em public/brand/\n`)
}

main().catch((e) => { console.error('Erro:', e.message); process.exit(1) })
