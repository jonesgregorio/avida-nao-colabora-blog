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
  '- Meio: SEMPRE fotografia realista, estilo lifestyle editorial. Pessoas e ambientes REAIS, pele real, fotorrealista. NUNCA ilustração, desenho, cartoon, 3D, pintura, arte digital ou aparência de IA.',
  '- Luz: natural e quente — luz de janela dourada de fim de tarde OU luz suave de abajur à noite. Profundidade de campo rasa, foco na pessoa, fundo levemente desfocado.',
  '- Ambiente: interior aconchegante e habitado — mesa de madeira, plantas, prateleira de livros, xícara de cerâmica, caderno aberto, notebook. Nada de estúdio branco.',
  '- Paleta: tons terrosos e naturais — bege, cru, madeira, verde-oliva, verde floresta profundo. Cores dessaturadas, quentes, nunca vibrantes nem saturadas.',
  '- Clima: momento íntimo e cotidiano, honesto, calmo. Sem pose forçada, sem sorriso de propaganda.',
].join('\n')

const IMAGEM_NEGATIVOS = [
  'ilustração, desenho, cartoon, anime, 3D render, pintura, arte digital, vetor, aparência de IA;',
  'qualquer texto, letra, número, marca d\'água ou logo na imagem;',
  'rosto deformado, olhos tortos, mãos com dedos errados, pele plástica;',
  'foto de banco de imagem genérica, pessoa sorrindo forçado olhando fixo para a câmera, estúdio branco;',
  'clichês de terapia (divã, pessoa encolhida chorando no canto, chuva triste na janela);',
  'cores saturadas, alto contraste, HDR, filtro dramático, colagem, excesso de elementos.',
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
      'TEMPLATE "com pessoa": a foto entra num CÍRCULO — precisa de um retrato que funcione num recorte circular.',
      'Descreva UMA PESSOA REAL adulta (foto, fotorrealista), do peito para cima ou de meio corpo, num momento emocional autêntico coerente com o tema:',
      'por exemplo pensativa com a mão na testa diante do notebook, escrevendo num caderno com a mão apoiando a cabeça, de olhos fechados respirando fundo na cadeira, ou olhando o celular à noite sob a luz do abajur.',
      'A pessoa NÃO olha fixo para a câmera (olhar baixo, para o lado, ou olhos fechados). Idade 30-45, roupa casual em tom terroso (verde-oliva, cru, bege).',
      'Enquadramento centrado na pessoa, com o rosto e as mãos nítidos e bem formados.',
    ].join(' ')
  }
  return [
    'TEMPLATE "com frase": a imagem é fundo — o título tipográfico entra por cima.',
    'Pode ser uma pessoa real num momento cotidiano (como nas artes da marca) OU uma cena de interior aconchegante sem ninguém (xícara na mesa, caderno aberto, planta na janela).',
    'Deixe a metade que vai receber o título (esquerda ou topo, conforme o formato) mais limpa e com o fundo mais uniforme.',
  ].join(' ')
}

export function buildImagePromptRequest(brief: EstudioBrief): string {
  const tipo = brief.tipoArte ?? 'frase'
  const formatoHint = brief.formato && FORMATO_HINT[brief.formato]
    ? FORMATO_HINT[brief.formato]
    : 'proporção vertical, com uma zona limpa para o título.'

  return [
    'Você é diretor de fotografia de uma marca de saúde emocional. Transforme a ideia abaixo em UM prompt de FOTOGRAFIA de qualidade de produção, pronto para colar em gerador de imagem (Imagen, gpt-image, Midjourney).',
    '',
    IMAGEM_BASE,
    '',
    `Ideia do post: "${brief.ideia}".`,
    brief.artigoTitulo ? `Contexto do artigo: "${brief.artigoTitulo}".` : '',
    `Objetivo do post: ${objetivosFrase(brief.objetivos)}.`,
    `Formato: ${formatoHint}`,
    tipoArteHint(tipo),
    '',
    `EVITAR (negativos): ${IMAGEM_NEGATIVOS}`,
    '',
    'Comece o prompt SEMPRE com "Fotografia realista, estilo lifestyle editorial,". Depois: [sujeito e ação concreta] + [enquadramento] + [luz e ambiente] + [paleta terrosa] + [clima íntimo]. Em português, 1 parágrafo, visual e concreto (nada de "sensação de calma" — mostre COMO).',
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
