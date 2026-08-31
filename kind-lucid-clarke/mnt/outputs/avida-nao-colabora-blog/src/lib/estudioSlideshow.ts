// Slideshow de vídeo do Estúdio (Fase 3b) — imagens estáticas em sequência
// viram um vídeo 9:16, sem gravar nada e SEM ffmpeg.
//
// Usa canvas + MediaRecorder nativos. O container costuma sair WebM (Chrome/
// Firefox/Edge). O CapCut/InShot importam WebM e exportam MP4 — que é o que o
// Instagram publica. O áudio em alta é adicionado no app, como nos reels.

export interface SlideFrame {
  url: string // object URL de um PNG já renderizado (1080×1920)
  seconds: number
}

export interface SlideshowResult {
  blob: Blob
  url: string
  mime: string
  durationMs: number
}

const WIDTH = 1080
const HEIGHT = 1920

export function slideshowSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  )
}

function pickMime(): string {
  const candidates = [
    'video/mp4;codecs=avc1',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  for (const m of candidates) {
    try {
      if (window.MediaRecorder.isTypeSupported(m)) return m
    } catch {
      // isTypeSupported ausente em navegadores antigos
    }
  }
  return 'video/webm'
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('não consegui carregar um quadro'))
    img.src = url
  })
}

export async function renderSlideshow(frames: SlideFrame[]): Promise<SlideshowResult> {
  if (!slideshowSupported()) {
    throw new Error('Este navegador não grava vídeo do canvas. Use Chrome ou Edge no computador.')
  }
  if (!frames.length) throw new Error('Nenhum quadro para montar o vídeo.')

  const imgs = await Promise.all(frames.map(f => loadImage(f.url)))
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponível')
  const c: CanvasRenderingContext2D = ctx

  c.fillStyle = '#FBFAF7'
  c.fillRect(0, 0, WIDTH, HEIGHT)
  c.drawImage(imgs[0], 0, 0, WIDTH, HEIGHT)

  const stream = canvas.captureStream(0) // sob demanda: forçamos cada quadro
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
  const mime = pickMime()
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

  const done = new Promise<Blob>(resolve => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }))
  })

  const timeline = frames.map((f, i) => ({ img: imgs[i], holdMs: Math.max(800, Math.round(f.seconds * 1000)) }))
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

  function paint(img: HTMLImageElement) {
    c.fillStyle = '#FBFAF7'
    c.fillRect(0, 0, WIDTH, HEIGHT)
    c.drawImage(img, 0, 0, WIDTH, HEIGHT)
    track.requestFrame?.()
  }

  recorder.start()
  const startedAt = performance.now()

  // setTimeout continua rodando mesmo com a aba em segundo plano; requestFrame()
  // garante que o MediaRecorder receba um quadro por slide.
  for (const step of timeline) {
    paint(step.img)
    // re-emite alguns quadros durante o hold para o player não "congelar" a 1 frame
    const pulses = Math.max(1, Math.round(step.holdMs / 500))
    for (let p = 0; p < pulses; p++) {
      await sleep(step.holdMs / pulses)
      track.requestFrame?.()
    }
  }

  recorder.stop()
  stream.getTracks().forEach(t => t.stop())
  const blob = await done
  return {
    blob,
    url: URL.createObjectURL(blob),
    mime: blob.type || 'video/webm',
    durationMs: Math.round(performance.now() - startedAt),
  }
}

export function slideshowFilename(mime: string): string {
  const ext = mime.includes('mp4') ? 'mp4' : 'webm'
  return `reel-slideshow-1080x1920.${ext}`
}
