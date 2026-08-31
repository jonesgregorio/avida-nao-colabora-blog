import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInstructions, slugForZip, buildZip } from '../src/lib/estudioPackage.ts'

const draft = {
  ideia: 'Não precisar dar conta de tudo',
  legenda: 'Descansar não é prêmio.',
  hashtags: '#saudeemocional #descanso',
  primeiroComentario: 'Leia no blog: link na bio.',
  formatos: ['feed-45', 'story'],
  publishMode: 'agendar' as const,
  scheduledFor: '2026-09-03T19:00',
}

test('instruções trazem o modo de publicação e o sticker do story', () => {
  const txt = buildInstructions(draft)
  assert.match(txt, /agendar no Meta Business Suite para 2026-09-03T19:00/)
  assert.match(txt, /STORY — stickers nativos/)
  assert.match(txt, /não publica nem interage automaticamente/)
})

test('instruções não citam stickers de formatos ausentes', () => {
  const txt = buildInstructions({ ...draft, formatos: ['feed-45'] })
  assert.doesNotMatch(txt, /STORY —/)
})

test('slug do zip é higienizado, sem acento nem espaço, e datado', () => {
  const s = slugForZip('Não precisar dar conta de TUDO!!!')
  assert.match(s, /^estudio-nao-precisar-dar-conta-de-tudo-\d{4}-\d{2}-\d{2}\.zip$/)
})

test('buildZip empacota artes + textos + instruções', async () => {
  const fakeAsset = {
    filename: 'feed-45-1080x1350.png',
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    url: 'blob:x', width: 1080, height: 1350, bytes: 3,
    check: { ok: true, problems: [] },
  }
  const zipBlob = await buildZip([fakeAsset], draft)
  assert.ok(zipBlob.size > 0)

  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer())
  assert.ok(zip.file('artes/feed-45-1080x1350.png'))
  assert.ok(zip.file('legenda.txt'))
  assert.ok(zip.file('hashtags.txt'))
  assert.ok(zip.file('instrucoes.txt'))
  assert.match(await zip.file('primeiro-comentario.txt')!.async('string'), /#saudeemocional/)
})
