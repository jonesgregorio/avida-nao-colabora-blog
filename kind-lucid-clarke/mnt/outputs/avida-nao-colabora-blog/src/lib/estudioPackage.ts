import type { RenderedAsset } from './estudioRender'

// Monta o pacote .zip de uma publicação: as artes + os textos + as instruções.
// jszip é carregado sob demanda (mesmo padrão de html2canvas/jspdf).

export interface PackageDraft {
  ideia: string
  legenda: string
  hashtags: string
  primeiroComentario: string
  formatos: string[]
  publishMode: 'manual' | 'agendar'
  scheduledFor?: string
  reelRoteiro?: string
}

const STICKER_HINTS: Record<string, string> = {
  story:
    'STORY — stickers nativos (colar no app):\n' +
    '· Enquete: "Você também sente isso?" — opções: Sim / Às vezes\n' +
    '· Link: aponte para o artigo do blog relacionado\n',
  'reel-capa':
    'REEL — o áudio em alta é escolhido dentro do app na publicação.\n' +
    'A capa já vem no formato certo; o conteúdo-chave está no quadrado central (o que aparece na grade).\n',
  quiz:
    'QUIZ — no story, use o sticker de quiz nativo com a pergunta e marque a resposta certa.\n',
}

export function buildInstructions(draft: PackageDraft): string {
  const lines: string[] = [
    'A VIDA NÃO COLABORA — pacote de publicação',
    '',
    `Ideia: ${draft.ideia || '—'}`,
    draft.publishMode === 'agendar'
      ? `Publicação: agendar no Meta Business Suite${draft.scheduledFor ? ` para ${draft.scheduledFor}` : ''}`
      : 'Publicação: manual pelo app do Instagram',
    '',
    'ORDEM SUGERIDA',
    '1. Suba a(s) arte(s) da pasta.',
    '2. Cole a legenda de legenda.txt.',
    '3. Publique.',
    '4. Cole o conteúdo de primeiro-comentario.txt como 1º comentário (hashtags + CTA).',
    '',
  ]
  const stickerFor = draft.formatos.filter(f => STICKER_HINTS[f])
  if (stickerFor.length) {
    lines.push('INSTRUÇÕES DE STICKER')
    for (const f of stickerFor) lines.push(STICKER_HINTS[f])
  }
  lines.push(
    'LEMBRETES',
    '· O Estúdio não publica nem interage automaticamente — isso é sempre manual.',
    '· CTA para o blog vai no 1º comentário, não na legenda.',
  )
  return lines.join('\n')
}

function firstComment(draft: PackageDraft): string {
  return [draft.hashtags, draft.primeiroComentario].filter(Boolean).join('\n\n')
}

export async function buildZip(assets: RenderedAsset[], draft: PackageDraft): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  const artes = zip.folder('artes')
  for (const a of assets) artes?.file(a.filename, await a.blob.arrayBuffer())

  zip.file('legenda.txt', draft.legenda || '')
  zip.file('hashtags.txt', draft.hashtags || '')
  zip.file('primeiro-comentario.txt', firstComment(draft))
  zip.file('instrucoes.txt', buildInstructions(draft))
  if (draft.reelRoteiro) zip.file('reel-roteiro.txt', draft.reelRoteiro)

  return zip.generateAsync({ type: 'blob' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function slugForZip(ideia: string): string {
  const base = ideia
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `estudio-${base || 'publicacao'}-${new Date().toISOString().slice(0, 10)}.zip`
}
