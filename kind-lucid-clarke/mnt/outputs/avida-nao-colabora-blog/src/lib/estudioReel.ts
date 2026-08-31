import type { EstudioBrief } from './estudioPrompts'

// Roteiro de reel (Fase 3) — puro. Monta o pedido e parseia a resposta.
// O Estúdio não grava vídeo: entrega roteiro + textos de tela como PNG
// transparente para o CapCut. O I/O da IA fica em estudioAi.ts.

export interface ReelBlock {
  tempo: string // ex.: "0-3s"
  fala: string // o que dizer / a ação em cena
  textoNaTela: string // legenda a sobrepor (vira PNG)
}

export interface ReelScript {
  gancho: string
  blocos: ReelBlock[]
  audioSugestao: string
  cta: string
}

const OBJETIVO_HINT: Record<string, string> = {
  salvar: 'termine dando um motivo concreto para salvar',
  compartilhar: 'termine com uma frase que a pessoa manda para alguém',
  comentar: 'termine com uma pergunta aberta',
  blog: 'termine convidando a ler o artigo (link na bio)',
  alcance: 'abra com o gancho mais forte possível nos 2 primeiros segundos',
}

export function buildReelScriptRequest(brief: EstudioBrief): string {
  const hint = brief.objetivos.map(o => OBJETIVO_HINT[o]).filter(Boolean).join('; ') || 'foque em retenção e salvamento'
  return [
    'Você é roteirista de reels de uma marca de saúde emocional ("A Vida Não Colabora").',
    `Tema: "${brief.ideia}".`,
    brief.artigoTitulo ? `Baseado no artigo: "${brief.artigoTitulo}".` : '',
    `Diretriz de fechamento: ${hint}.`,
    'Reel de 20 a 40 segundos, 4 a 6 blocos. Tom acolhedor, adulto, sem clichê de autoajuda. Português brasileiro.',
    'O "texto_na_tela" deve ser curto (até ~7 palavras) — vira legenda sobreposta ao vídeo.',
    '',
    'Retorne SOMENTE um JSON válido, sem markdown:',
    '{',
    '  "gancho": "primeira frase, forte, para os 2 primeiros segundos",',
    '  "blocos": [',
    '    { "tempo": "0-3s", "fala": "o que dizer ou a ação em cena", "texto_na_tela": "legenda curta" }',
    '  ],',
    '  "audio_sugestao": "que tipo de som procurar no app (não um nome específico)",',
    '  "cta": "chamada final"',
    '}',
  ].filter(Boolean).join('\n')
}

export function parseReelScript(json: Record<string, unknown>): ReelScript {
  const blocosRaw = Array.isArray(json.blocos) ? (json.blocos as unknown[]) : []
  const blocos: ReelBlock[] = blocosRaw
    .map(b => {
      const o = b as Record<string, unknown>
      return {
        tempo: String(o.tempo ?? '').trim(),
        fala: String(o.fala ?? '').trim(),
        textoNaTela: String(o.texto_na_tela ?? '').trim(),
      }
    })
    .filter(b => b.fala || b.textoNaTela)
  return {
    gancho: String(json.gancho ?? '').trim(),
    blocos,
    audioSugestao: String(json.audio_sugestao ?? '').trim(),
    cta: String(json.cta ?? '').trim(),
  }
}

/** Roteiro como texto plano, para ir no .zip. */
export function reelScriptToText(script: ReelScript): string {
  const linhas = [
    'ROTEIRO DE REEL — A Vida Não Colabora',
    '',
    `GANCHO (0-2s): ${script.gancho}`,
    '',
  ]
  script.blocos.forEach((b, i) => {
    linhas.push(`[${b.tempo || `bloco ${i + 1}`}]`)
    if (b.fala) linhas.push(`  fala/ação: ${b.fala}`)
    if (b.textoNaTela) linhas.push(`  texto na tela: ${b.textoNaTela}   (overlay-${String(i + 1).padStart(2, '0')}.png)`)
    linhas.push('')
  })
  linhas.push(`ÁUDIO: ${script.audioSugestao || 'som calmo/instrumental em alta'}`)
  linhas.push(`CTA: ${script.cta}`)
  linhas.push('')
  linhas.push('Os overlays são PNG transparentes 1080x1920 — arraste sobre o vídeo no CapCut/InShot.')
  return linhas.join('\n')
}

/** Textos que viram PNG de overlay (gancho + cada texto_na_tela não vazio). */
export function overlayTexts(script: ReelScript): string[] {
  const out: string[] = []
  if (script.gancho) out.push(script.gancho)
  for (const b of script.blocos) if (b.textoNaTela) out.push(b.textoNaTela)
  return out
}
