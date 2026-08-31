// Prompts do Estúdio de Conteúdo (marketing / Instagram).
//
// Puro e sem I/O — as chamadas de rede ficam em estudioAi.ts. A IA roda
// server-side pelo proxy admin `generate-content` (chaves só em secrets do
// Supabase); aqui só montamos o texto do pedido.
//
// Regra de produto: este texto é do marketing. NUNCA inclui trecho do Diário
// dos usuários nem marcadores emocionais individuais — só ideia do editor,
// artigos publicados e temas de categoria.

export interface EstudioBrief {
  ideia: string
  objetivos: string[]
  estilo: 'template' | 'ia' | 'hibrido'
  artigoTitulo?: string
}

const OBJETIVO_LABEL: Record<string, string> = {
  salvar: 'fazer as pessoas salvarem o post',
  compartilhar: 'fazer as pessoas compartilharem em DM',
  comentar: 'gerar comentários genuínos',
  blog: 'levar tráfego ao blog',
  alcance: 'alcançar gente nova (topo de funil)',
}

const MARCA = [
  'Marca: "A Vida Não Colabora" — saúde emocional e autoconhecimento.',
  'Tom: acolhedor, adulto, sem clichê de autoajuda, sem promessa de cura, sem linguagem clínica.',
  'Português brasileiro.',
].join(' ')

function objetivosFrase(objetivos: string[]): string {
  const nomes = objetivos.map(o => OBJETIVO_LABEL[o]).filter(Boolean)
  return nomes.length ? nomes.join('; ') : 'engajamento e salvamento'
}

const PALETA = 'papel (#FBFAF7), verde floresta (#1A4A3A), menta (#E8F0EB); tipografia serifada elegante para títulos'

// ── prompt de imagem ────────────────────────────────────────────────────────

export function buildImagePromptRequest(brief: EstudioBrief): string {
  const estiloHint = brief.estilo === 'template'
    ? 'A arte final é um TEMPLATE da marca: fundo/ilustração simples com muito espaço negativo no topo para um título tipográfico. Descreva só o fundo/ilustração, sem texto na imagem.'
    : brief.estilo === 'hibrido'
      ? 'Fundo gerado por IA + tipografia da marca por cima. Descreva o fundo; o título entra depois.'
      : 'Imagem gerada inteiramente por IA. Pode compor a cena toda, mas mantenha área de respiro para legenda curta.'

  return [
    'Você é diretor de arte de uma marca de saúde emocional.',
    MARCA,
    `Ideia do post: "${brief.ideia}".`,
    brief.artigoTitulo ? `Baseado no artigo: "${brief.artigoTitulo}".` : '',
    `Objetivo: ${objetivosFrase(brief.objetivos)}.`,
    `Paleta e estilo visual da marca: ${PALETA}.`,
    estiloHint,
    'Evite: rostos olhando para a câmera, textos na imagem, bancos de imagem genéricos, excesso de elementos.',
    '',
    'Retorne SOMENTE um JSON válido, sem markdown:',
    '{',
    '  "prompt": "prompt de imagem em português, 1 parágrafo, pronto para um gerador de imagem",',
    '  "racional": "1-2 frases explicando a escolha visual",',
    '  "titulo_sugerido": "frase curta (até 60 caracteres) para ir sobre a imagem"',
    '}',
  ].filter(Boolean).join('\n')
}

// ── legendas + hashtags ─────────────────────────────────────────────────────

export function buildCaptionRequest(brief: EstudioBrief): string {
  return [
    'Você é redator de social media de uma marca de saúde emocional.',
    MARCA,
    `Ideia do post: "${brief.ideia}".`,
    brief.artigoTitulo ? `Artigo relacionado: "${brief.artigoTitulo}".` : '',
    `Objetivo principal: ${objetivosFrase(brief.objetivos)}.`,
    'Diretrizes: primeira linha forte (antes do "ver mais"); sem hashtags no corpo da legenda; CTA no máximo 1, natural; até 2.200 caracteres; pode usar 1 emoji com moderação.',
    'As hashtags vão no primeiro comentário: ~10, de nicho médio (evite as gigantes tipo #amor #vida #foco).',
    '',
    'Retorne SOMENTE um JSON válido, sem markdown:',
    '{',
    '  "legendas": [',
    '    { "rotulo": "acolhedora", "texto": "..." },',
    '    { "rotulo": "direta", "texto": "..." },',
    '    { "rotulo": "pergunta", "texto": "..." }',
    '  ],',
    '  "hashtags": "#tag1 #tag2 ...",',
    '  "primeiro_comentario_cta": "comentário curto convidando a ler o artigo no blog"',
    '}',
  ].filter(Boolean).join('\n')
}
