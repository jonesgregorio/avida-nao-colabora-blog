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
  /** 'frase' = arte só com título; 'pessoa' = foto real à direita + texto à esquerda. */
  tipoArte?: 'frase' | 'pessoa'
  /** id de FORMAT_SPECS (feed-45, story, reel-capa…) para ajustar proporção e zona de texto. */
  formato?: string
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

// ── prompt de imagem ────────────────────────────────────────────────────────
//
// "Prompt base" — a identidade visual que SEMPRE entra, seja qual for a ideia.
// É o que faz a imagem sair condizente e on-brand em vez de genérica.

const IMAGEM_BASE = [
  'IDENTIDADE VISUAL OBRIGATÓRIA da marca "A Vida Não Colabora" (respeitar em toda imagem):',
  '- Meio: ilustração editorial minimalista OU fotografia natural com luz de janela difusa e suave. Sem 3D, sem cartoon, sem vetor chapado, sem render de IA óbvio.',
  '- Paleta dessaturada: base papel quente #FBFAF7; verde floresta profundo #1A4A3A; menta #E8F0EB; acentos discretos em céu #E4EEF7, coral #F7D8CE, lilás #E9E1F3. Cores nunca vibrantes.',
  '- Clima: calmo, acolhedor, adulto, respirável — sensação de pausa, não de urgência.',
  '- Composição: muito espaço negativo, sujeito descentralizado, um único ponto de interesse, enquadramento limpo. Textura sutil de papel é bem-vinda.',
].join('\n')

const IMAGEM_NEGATIVOS = [
  'NÃO incluir de jeito nenhum:',
  'qualquer texto, letra, número, marca d\'água ou logo na imagem;',
  'rostos deformados, olhos tortos, mãos com dedos errados;',
  'foto de banco de imagem genérica ou pessoa sorrindo forçado olhando para a câmera;',
  'clichês de terapia (divã, cabeça entre as mãos, pessoa encolhida no canto, chuva triste na janela);',
  'excesso de elementos, colagem, alto contraste, HDR, saturação alta, filtro dramático.',
].join(' ')

const FORMATO_HINT: Record<string, string> = {
  'feed-45': 'proporção vertical 4:5; deixe o terço superior limpo para o título.',
  'feed-11': 'proporção quadrada 1:1; deixe o topo ou a lateral esquerda limpos.',
  carrossel: 'proporção vertical 4:5; topo limpo para o título de cada slide.',
  story: 'proporção vertical 9:16; muito respiro no centro-alto, longe das bordas (a interface cobre topo e base).',
  'reel-capa': 'proporção vertical 9:16; o conteúdo-chave no quadrado central (é o que aparece na grade do perfil).',
  quiz: 'proporção vertical 4:5; topo limpo para a pergunta.',
  destaque: 'proporção vertical 9:16, mas só um círculo central pequeno aparece: cena simples, centrada, um objeto ou textura.',
}

function tipoArteHint(tipo: EstudioBrief['tipoArte']): string {
  if (tipo === 'pessoa') {
    return [
      'TEMPLATE "com pessoa": a imagem entra num CÍRCULO à direita; o título fica à esquerda.',
      'Prefira um retrato real do editor — mas se ele pedir imagem gerada, descreva uma CENA ou OBJETO simbólico simples (mãos, uma xícara, uma janela, uma planta), enquadramento centrado, NUNCA um rosto de pessoa inventado.',
    ].join(' ')
  }
  return [
    'TEMPLATE "com frase": a imagem é APENAS fundo/cena — sem pessoas, sem texto.',
    'Deixe a zona do título (conforme o formato) totalmente livre e limpa.',
    'Boas escolhas: um objeto simbólico simples (xícara pousada, folha, janela entreaberta, mão relaxando o punho), textura orgânica abstrata, ou paisagem mínima.',
  ].join(' ')
}

export function buildImagePromptRequest(brief: EstudioBrief): string {
  const tipo = brief.tipoArte ?? 'frase'
  const formatoHint = brief.formato && FORMATO_HINT[brief.formato]
    ? FORMATO_HINT[brief.formato]
    : 'proporção vertical, com uma zona limpa para o título.'

  const estiloHint = brief.estilo === 'hibrido'
    ? 'Fundo gerado por IA + tipografia da marca por cima — descreva só o fundo.'
    : brief.estilo === 'ia'
      ? 'Imagem gerada inteiramente por IA — pode compor a cena, mantendo o respiro para o texto.'
      : 'A arte final é um template da marca — descreva só o fundo/ilustração.'

  return [
    'Você é diretor de arte de uma marca de saúde emocional. Transforme a ideia solta abaixo em UM prompt de imagem de qualidade de produção, pronto para colar em gerador de imagem (gpt-image, Midjourney, Imagen, Flux).',
    '',
    IMAGEM_BASE,
    '',
    `Ideia do post: "${brief.ideia}".`,
    brief.artigoTitulo ? `Contexto do artigo: "${brief.artigoTitulo}".` : '',
    `Objetivo do post: ${objetivosFrase(brief.objetivos)}.`,
    `Formato: ${formatoHint}`,
    tipoArteHint(tipo),
    estiloHint,
    '',
    IMAGEM_NEGATIVOS,
    '',
    'O prompt final deve seguir esta ordem: [meio e estilo] + [sujeito e ação] + [composição e enquadramento] + [paleta e luz] + [clima]. Uma frase para negativos. Em português, 1 parágrafo, concreto e visual (nada de abstrações tipo "sensação de calma" — mostre COMO).',
    '',
    'Retorne SOMENTE um JSON válido, sem markdown:',
    '{',
    '  "prompt": "o prompt de imagem, 1 parágrafo",',
    '  "negativos": "lista curta do que evitar, separada por vírgula",',
    '  "precisa_gerar": true,',
    '  "racional": "1-2 frases sobre a escolha visual",',
    '  "titulo_sugerido": "frase curta (até 60 caracteres) para ir sobre a arte"',
    '}',
  ].filter(Boolean).join('\n')
}

// ── frase da arte (o texto grande dentro da imagem) ─────────────────────────

export function buildPhraseRequest(brief: EstudioBrief): string {
  return [
    'Você escreve a FRASE que vai dentro de uma arte de Instagram de uma marca de saúde emocional.',
    MARCA,
    `Ideia do post: "${brief.ideia}".`,
    brief.artigoTitulo ? `Contexto do artigo: "${brief.artigoTitulo}".` : '',
    'A frase é curta (no máximo 12 palavras), forte na primeira palavra, sem ponto final obrigatório.',
    'Não é legenda nem hashtag — é o título visual. Sem aspas, sem emoji, sem "clique aqui".',
    '',
    'Retorne SOMENTE um JSON válido, sem markdown:',
    '{ "frase": "a frase", "alternativas": ["outra opção", "mais uma"] }',
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
