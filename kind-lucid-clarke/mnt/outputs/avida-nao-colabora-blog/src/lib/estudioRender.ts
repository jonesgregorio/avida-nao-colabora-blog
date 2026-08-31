import { validateAsset, type FormatSpec, type ValidationResult } from './estudioFormats'

// Captura um nó do DOM (um BrandTemplate já renderizado no tamanho exato) em
// PNG. html2canvas é carregado sob demanda — mesmo padrão de exportPdf.ts.

export interface RenderedAsset {
  filename: string
  blob: Blob
  url: string
  width: number
  height: number
  bytes: number
  check: ValidationResult
}

async function toCanvas(node: HTMLElement, spec: FormatSpec, transparent = false): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas')
  // As fontes da marca precisam estar prontas antes do snapshot.
  if (document.fonts?.ready) {
    try { await document.fonts.ready } catch { /* segue mesmo assim */ }
  }
  return html2canvas(node, {
    width: spec.width,
    height: spec.height,
    scale: 1,
    backgroundColor: transparent ? null : '#FBFAF7',
    useCORS: true,
    logging: false,
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas vazio'))), 'image/png')
  })
}

export async function snapshot(
  node: HTMLElement,
  spec: FormatSpec,
  filename: string,
  opts: { transparent?: boolean } = {},
): Promise<RenderedAsset> {
  const canvas = await toCanvas(node, spec, opts.transparent)
  const blob = await canvasToBlob(canvas)
  const check = validateAsset(spec, { width: canvas.width, height: canvas.height, bytes: blob.size })
  return {
    filename,
    blob,
    url: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
    bytes: blob.size,
    check,
  }
}

export function downloadAsset(asset: RenderedAsset) {
  const a = document.createElement('a')
  a.href = asset.url
  a.download = asset.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function releaseAssets(assets: RenderedAsset[]) {
  for (const a of assets) {
    try { URL.revokeObjectURL(a.url) } catch { /* noop */ }
  }
}
