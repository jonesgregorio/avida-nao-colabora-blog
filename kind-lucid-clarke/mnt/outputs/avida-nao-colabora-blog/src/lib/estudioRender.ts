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

async function toCanvas(node: HTMLElement, spec: FormatSpec, transparent = false, scale = 1): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas')
  // As fontes da marca precisam estar prontas antes do snapshot.
  if (document.fonts?.ready) {
    try { await document.fonts.ready } catch { /* segue mesmo assim */ }
  }
  return html2canvas(node, {
    width: spec.width,
    height: spec.height,
    scale,
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
  opts: { transparent?: boolean; scale?: number } = {},
): Promise<RenderedAsset> {
  const scale = opts.scale && opts.scale > 1 ? opts.scale : 1
  const canvas = await toCanvas(node, spec, opts.transparent, scale)
  const blob = await canvasToBlob(canvas)
  // Em alta (scale > 1) o arquivo é maior de propósito — valida contra a
  // dimensão esperada já multiplicada.
  const check = validateAsset(
    { ...spec, width: spec.width * scale, height: spec.height * scale, maxBytes: spec.maxBytes * scale * scale },
    { width: canvas.width, height: canvas.height, bytes: blob.size },
  )
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

/** data:URL → Blob sem usar fetch (a CSP do site bloqueia fetch de data:). */
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const header = dataUrl.slice(0, comma)
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/png'
  const isB64 = /;base64/i.test(header)
  const data = dataUrl.slice(comma + 1)
  if (!isB64) return new Blob([decodeURIComponent(data)], { type: mime })
  const bin = atob(data)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/** Embrulha uma imagem pronta (ex.: arte completa gerada por IA) como RenderedAsset. */
export async function assetFromImage(dataUrl: string, filename: string, spec: FormatSpec): Promise<RenderedAsset> {
  const blob = dataUrlToBlob(dataUrl)
  const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('imagem inválida'))
    img.src = dataUrl
  })
  // A IA não devolve exatamente a dimensão pedida — valida só proporção e peso.
  const check = validateAsset(
    { ...spec, width: dims.w, height: dims.h },
    { width: dims.w, height: dims.h, bytes: blob.size },
  )
  return { filename, blob, url: URL.createObjectURL(blob), width: dims.w, height: dims.h, bytes: blob.size, check }
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
