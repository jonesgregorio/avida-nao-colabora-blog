import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { slideshowFilename } from '../src/lib/estudioSlideshow.ts'

test('slideshowFilename escolhe a extensão pelo mime', () => {
  assert.equal(slideshowFilename('video/mp4;codecs=avc1'), 'reel-slideshow-1080x1920.mp4')
  assert.equal(slideshowFilename('video/webm;codecs=vp9'), 'reel-slideshow-1080x1920.webm')
  assert.equal(slideshowFilename('video/webm'), 'reel-slideshow-1080x1920.webm')
})

test('slideshow usa APIs nativas (canvas + MediaRecorder), sem ffmpeg nem dep externa', () => {
  const src = readFileSync(new URL('../src/lib/estudioSlideshow.ts', import.meta.url), 'utf8')
  assert.match(src, /new MediaRecorder\(/)
  assert.match(src, /canvas\.captureStream\(/)
  assert.doesNotMatch(src, /from ['"]@ffmpeg|await import\(/)
  assert.match(src, /1080/)
  assert.match(src, /1920/)
  // degrada com mensagem quando o navegador não suporta
  assert.match(src, /slideshowSupported/)
})

test('buildZip guarda o vídeo do reel quando existe', () => {
  const src = readFileSync(new URL('../src/lib/estudioPackage.ts', import.meta.url), 'utf8')
  assert.match(src, /if \(draft\.reelVideo\) zip\.folder\('video'\)/)
})
