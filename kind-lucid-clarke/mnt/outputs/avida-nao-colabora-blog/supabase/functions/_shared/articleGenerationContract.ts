// Contrato editorial único para artigos gerados por IA.
// Arquivo deliberadamente puro (sem Deno/browser APIs) para ser reutilizado
// tanto pelas Edge Functions quanto pela Fábrica IA no frontend.


export interface ArticleAIContract {
  title: string
  content: string
  excerpt: string
  seo_title: string
  seo_description: string
  keyword: string
  secondary_keywords: string[]
  tags: string[]
  emotional_themes: string[]
  category: string
  image_query: string
  image_alt: string
  diary_question: string
  cta_text: string
  journey_stage?: string
  intent?: string
  audience?: string
}

export interface ArticlePromptOptions {
  plan?: string
  quantity?: number
  themes: string[]
  tone?: string
  category?: string
  audience?: string
  keyword?: string
  extraInstructions?: string
  sourcesBrief?: string
}

export interface ArticleValidationContext {
  plan?: string
  imageUrl?: string | null
  duplicate?: boolean
  publication?: boolean
  reviewed?: boolean
  author?: string
  relatedSlugs?: string[]
  catalog?: ArticleCatalogItem[]
}

export function articleWordCount(text: string): number {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function stringList(value: unknown, max: number): string[] {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean).slice(0, max)
  if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean).slice(0, max)
  return []
}

export function articleExcerptFrom(content: string): string {
  const paragraph = String(content || '')
    .split('\n')
    .map(line => line.trim())
    .find(line => line && !line.startsWith('#') && !line.startsWith('::video-query') && line.length > 40) || ''
  return paragraph.replace(/[*_`>]/g, '').trim().slice(0, 200)
}

export function normalizeArticlePackage(raw: Record<string, unknown>, fallbackTheme = '', fallbackCategory = ''): ArticleAIContract {
  const title = cleanText(raw.title, 140) || cleanText(fallbackTheme, 140)
  const content = cleanText(raw.content, 60000)
  const excerpt = cleanText(raw.excerpt, 300) || articleExcerptFrom(content)
  const seoTitle = cleanText(raw.seo_title, 70) || title.slice(0, 60)
  const seoDescription = cleanText(raw.seo_description, 180) || excerpt.slice(0, 155)
  const keyword = cleanText(raw.keyword, 120) || cleanText(fallbackTheme, 120)
  return {
    title,
    content,
    excerpt,
    seo_title: seoTitle,
    seo_description: seoDescription,
    keyword,
    secondary_keywords: stringList(raw.secondary_keywords, 6),
    tags: stringList(raw.tags, 6),
    emotional_themes: stringList(raw.emotional_themes, 4),
    category: cleanText(raw.category, 120) || cleanText(fallbackCategory, 120) || 'Geral',
    image_query: cleanText(raw.image_query, 120),
    image_alt: cleanText(raw.image_alt, 220),
    diary_question: cleanText(raw.diary_question, 300),
    cta_text: cleanText(raw.cta_text, 220),
    journey_stage: ['descoberta', 'consideracao', 'decisao'].includes(String(raw.journey_stage)) ? String(raw.journey_stage) : 'descoberta',
    intent: cleanText(raw.intent, 120) || 'educar',
    audience: cleanText(raw.audience, 300) || 'Adultos interessados em bem-estar emocional',
  }
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  try {
    const value = JSON.parse(cleaned)
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        const value = JSON.parse(cleaned.slice(start, end + 1))
        return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
      } catch { /* inválido */ }
    }
    return null
  }
}

// Aceita o mesmo contrato em duas embalagens: objeto único (Fábrica) ou
// {articles:[...]} (pacotes da automação). Os CAMPOS do artigo são idênticos.
export function parseArticlePackages(raw: string, fallbackThemes: string[] = [], fallbackCategory = ''): ArticleAIContract[] {
  const parsed = parseJsonObject(raw)
  if (!parsed) return []
  const values = Array.isArray(parsed.articles)
    ? parsed.articles
    : ('title' in parsed || 'content' in parsed ? [parsed] : [])
  return values
    .filter(v => v && typeof v === 'object' && !Array.isArray(v))
    .map((v, index) => normalizeArticlePackage(
      v as Record<string, unknown>,
      fallbackThemes[index % Math.max(fallbackThemes.length, 1)] || fallbackThemes[0] || '',
      fallbackCategory,
    ))
}

export function validateArticlePackage(article: ArticleAIContract, context: ArticleValidationContext = {}): string[] {
  const errors: string[] = []
  if (!article.title.trim()) errors.push('título ausente')
  if (article.content.trim().length < 300) errors.push('conteúdo insuficiente')
  if (/^#\s/m.test(article.content)) errors.push('H1 dentro do corpo')
  if (article.excerpt.trim().length < 80) errors.push('resumo curto/ausente')
  if (article.seo_title.trim().length < 25 || article.seo_title.length > 60) errors.push('SEO title inválido')
  if (article.seo_description.trim().length < 90 || article.seo_description.length > 155) errors.push('meta description inválida')
  if (!article.keyword.trim() || article.secondary_keywords.length < 2) errors.push('palavras-chave insuficientes')
  if (!context.publication && !article.image_query.trim()) errors.push('busca de imagem ausente')
  if (!context.imageUrl || !/^https:\/\//i.test(context.imageUrl)) errors.push('imagem de capa ausente ou URL inválida')
  if (!article.image_alt.trim()) errors.push('texto alternativo da imagem ausente')
  if (!article.diary_question.trim()) errors.push('pergunta para diário ausente')
  if (!article.cta_text.trim()) errors.push('CTA ausente')
  if (context.plan && articleAccessRank(context.plan) < 0) errors.push('acesso editorial desconhecido')
  errors.push(...validateTierDeliverables(article.content, context.plan))
  if (context.duplicate) errors.push('artigo duplicado')
  if (context.publication) {
    if (!context.author?.trim()) errors.push('autoria ausente')
    if (!context.reviewed) errors.push('revisão editorial e capa não confirmadas')
    if (!hasEditorialSource(article.content)) errors.push('fonte oficial com link HTTPS ausente')
    if (!context.relatedSlugs?.length) errors.push('artigos relacionados ausentes')
    if (context.catalog) {
      const bodyTargets = [...article.content.matchAll(/\]\((?:https:\/\/(?:www\.)?avidanaocolabora\.com)?\/blog\/([a-z0-9-]+)(?:[?#][^)]*)?\)/g)].map(match => match[1])
      if ([...bodyTargets, ...(context.relatedSlugs || [])].some(slug => context.catalog!.some(row => row.slug === slug && articleAccessRank(row.plan_required) > articleAccessRank(context.plan || 'free')))) errors.push('link para conteúdo de acesso superior ao plano')
      if (bodyTargets.some(slug => !context.catalog!.some(row => row.slug === slug))) errors.push('link interno no texto indisponível')
      if (context.relatedSlugs?.some(slug => !context.catalog!.some(row => row.slug === slug))) errors.push('artigo relacionado indisponível')
      if (hasTopicOverlap(article.title, article.keyword, context.catalog)) errors.push('tema semelhante no catálogo; diferencie a intenção ou atualize o existente')
    }
  }
  return errors
}

export function buildArticleGenerationPrompt(options: ArticlePromptOptions): string {
  const quantity = Math.max(1, Math.min(12, Math.floor(options.quantity || 1)))
  const themes = [...new Set(options.themes.map(v => String(v || '').trim()).filter(Boolean))]
  const tone = (options.tone || 'acolhedor').trim()
  const category = (options.category || 'saúde emocional').trim()
  const audience = (options.audience || 'público geral').trim()
  const keyword = (options.keyword || '').trim()
  const containerStart = quantity === 1 ? '{' : '{"articles":[{'
  const containerEnd = quantity === 1 ? '}' : '}]}'

  return `Você escreve para o blog A Vida Não Colabora. Gere ${quantity === 1 ? 'UM artigo' : `exatamente ${quantity} artigos distintos`} em português brasileiro.
${articleTierBrief(options.plan)}
Temas disponíveis: ${themes.join(' | ') || 'saúde emocional'}.
Categoria-base: ${category}. Tom: ${tone}. Público-alvo: ${audience}.${keyword ? ` Palavra-chave prioritária: ${keyword}.` : ''}

Cada corpo deve responder à intenção de busca com clareza, sem contagem obrigatória de palavras nem preenchimento. Comece com uma resposta direta, explique o necessário, dê exemplos explicitamente fictícios e adaptáveis, pergunta para diário, CTA gentil e aviso de que o conteúdo não substitui acompanhamento profissional.
Use subtítulos ## e ### quando ajudarem a leitura. Não use título H1 dentro do corpo. Prefira parágrafos corridos e não abuse de listas.
${quantity > 1 ? 'Varie temas e ângulos; não gere títulos quase iguais.' : ''}
Não diagnostique, não prescreva, não prometa cura e não invente pesquisas ou estatísticas.
Use apenas as fontes oficiais fornecidas no briefing. Quando o briefing fornecer fontes verificadas e o texto fizer afirmações factuais de saúde, inclua ao final uma seção "## Fontes consultadas" com os links recebidos. Nunca invente autor, credencial, estudo, instituição ou URL; sem fonte fornecida, mantenha o conteúdo educativo e não clínico.
${options.sourcesBrief ?? editorialSourceBrief()}
Não transforme exemplos fictícios em relatos reais. Não invente autoria ou revisão clínica.
Evite clichês de texto gerado por IA como “em conclusão”, “é importante ressaltar”, “em suma”, “não podemos esquecer que”, “em um mundo cada vez mais”, “convido você a refletir” e “ao longo deste artigo, vamos explorar”. Não repita fórmulas de introdução.

Retorne SOMENTE JSON válido, sem markdown em volta. Cada artigo deve conter EXATAMENTE estes campos editoriais obrigatórios:
title, content, excerpt, seo_title, seo_description, keyword, secondary_keywords, tags, emotional_themes, category, image_query, image_alt, diary_question, cta_text.

Formato:
${containerStart}
  "title": "máx. 10 palavras",
  "content": "corpo completo",
  "excerpt": "120 a 190 caracteres",
  "seo_title": "35 a 60 caracteres",
  "seo_description": "120 a 155 caracteres",
  "keyword": "palavra-chave principal",
  "secondary_keywords": ["3 a 6 termos"],
  "tags": ["3 a 6 tags"],
  "emotional_themes": ["até 4 temas emocionais"],
  "category": "categoria",
  "image_query": "busca curta em inglês para foto real e específica",
  "image_alt": "texto alternativo descritivo em português",
  "diary_question": "pergunta reflexiva curta",
  "cta_text": "CTA gentil",
  "journey_stage": "descoberta, consideracao ou decisao",
  "intent": "intenção editorial específica",
  "audience": "público-alvo específico do tema"
${containerEnd}
${options.extraInstructions?.trim() ? `\nBriefing adicional (não altera o contrato JSON):\n${options.extraInstructions.trim()}` : ''}`.trim()
}


export interface ArticleCatalogItem { slug: string; title: string; keyword?: string | null; plan_required?: string | null }

// Referências editoriais verificadas em 04/10/2026. O resumo limita as alegações
// permitidas; o editor deve conferir a adequação da referência antes de publicar.
export function editorialSourceBrief(): string {
  return `Referências oficiais disponíveis (não atribua conclusões além destes resumos):
- NIMH — Caring for Your Mental Health: autocuidado varia por pessoa; sono, apoio social e prioridades são possibilidades; sintomas persistentes ou preocupantes exigem avaliação. https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health
- NHS — Mental wellbeing audio guides: reúne orientações sobre preocupação, sono, assertividade e pensamentos. https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/mental-wellbeing-audio-guides/
Inclua somente referências pertinentes, em links Markdown, e não copie frases. Para outras afirmações, solicite fonte verificada na revisão; não invente. Identifique apoio de IA sem fingir avaliação profissional.`
}

export function hasEditorialSource(content: string): boolean {
  return /\]\(https:\/\/(?:www\.)?(?:medlineplus\.gov|nhs\.uk|nimh\.nih\.gov|nhlbi\.nih\.gov|cci\.health\.wa\.gov\.au|gov\.br)\/[^\s)]+\)/i.test(content)
}

function topicTokens(text: string): Set<string> {
  return new Set(text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(t => t.length > 3 && !['como', 'para', 'voce', 'sobre', 'seus', 'suas', 'mais', 'quando', 'fazer'].includes(t)))
}

export function hasTopicOverlap(title: string, keyword: string, catalog: ArticleCatalogItem[]): boolean {
  const tokens = topicTokens(title)
  return catalog.some(row => {
    const other = topicTokens(row.title)
    const common = [...tokens].filter(t => other.has(t)).length
    const union = new Set([...tokens, ...other]).size
    return (union > 0 && common / union >= 0.8) || (!!keyword.trim() && keyword.trim().toLowerCase() === row.keyword?.trim().toLowerCase())
  })
}

export function selectRelatedArticles(topic: string, catalog: ArticleCatalogItem[], ownSlug = '', plan = 'free'): ArticleCatalogItem[] {
  const tokens = topicTokens(topic)
  return catalog.filter(row => row.slug !== ownSlug && articleAccessRank(row.plan_required) >= 0 && articleAccessRank(row.plan_required) <= articleAccessRank(plan))
    .map(row => ({ row, score: [...topicTokens(`${row.title} ${row.keyword || ''}`)].filter(t => tokens.has(t)).length }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || articleAccessRank(b.row.plan_required) - articleAccessRank(a.row.plan_required) || a.row.slug.localeCompare(b.row.slug))
    .slice(0, 3).map(item => item.row)
}

export function catalogBrief(catalog: ArticleCatalogItem[]): string {
  return `Catálogo já publicado — crie intenção específica diferente, evite duplicar estes assuntos. Para links internos use exclusivamente os endereços fornecidos, naturalmente no texto:\n${catalog.map(row => `${row.title} | ${row.keyword || ''} | /blog/${row.slug}`).join('\n')}`
}


export function withEditorialDisclosure(content: string, origin: string, reviewed: boolean): string {
  if (origin !== 'ia' || !reviewed || /inteligência artificial|apoio de IA/i.test(content)) return content
  return `${content.trim()}\n\n## Transparência editorial\n\nConteúdo elaborado com apoio de inteligência artificial e conferido editorialmente antes da publicação. Essa conferência não equivale a revisão clínica por profissional habilitado.`
}


export function articleAccessRank(plan?: string | null): number {
  const ranks: Record<string, number> = { free: 0, account: 1, essential: 2, plus: 3 }
  return ranks[plan || 'free'] ?? -1
}

export function articleTierSections(plan?: string): string[] {
  const essential = ['Roteiro de aplicação', 'Modelo para copiar', 'Exemplo fictício preenchido', 'Adaptação para pouca energia', 'Revisão da semana']
  if (plan === 'essential') return essential
  if (plan === 'plus') return [...essential, 'Cenários e alternativas', 'Critérios para escolher', 'Revisão do mês', 'Plano de acompanhamento']
  return []
}

export function articleTierBrief(plan = 'free'): string {
  const name = ({ free: 'Público sem cadastro', account: 'Gratuito com conta', essential: 'Essencial', plus: 'Plus' } as Record<string, string>)[plan] || 'Acesso não reconhecido'
  const sections = articleTierSections(plan)
  const promise = plan === 'plus'
    ? 'Entregue um guia de aprofundamento: decisões com alternativas e limites, pelo menos três cenários fictícios distintos, revisão mensal e plano adaptável de acompanhamento. Diferencie da revisão semanal Essencial. Não invente personalização: o leitor preenche seus próprios registros.'
    : plan === 'essential'
      ? 'Entregue um guia aplicado: roteiro em etapas, modelo copiável com campos claros, exemplo explicitamente fictício preenchido, versão para pouca energia e revisão semanal. Vá além de explicar conceitos.'
      : plan === 'account'
        ? 'Entregue um exercício inicial completo ligado ao diário. O leitor deve poder usar papel ou outro formato; não condicione utilidade ao app. Gratuito tem limite de registros: não exija diário diário ilimitado.'
        : 'Entregue explicação completa, exemplos e uma ação possível sem cadastro. Não esconda a resposta principal nem use texto incompleto como isca.'
  return `Plano editorial: ${name}. ${promise}
${sections.length ? 'Inclua estas seções com títulos Markdown ## exatamente como abaixo; cada seção deve conter instruções e exemplos específicos ao assunto, nunca apenas o título ou generalidades:\n' + sections.map(section => '## ' + section).join('\n') : ''}
Escolha palavra-chave específica da entrega e intenção, não repita o termo amplo de outro artigo. Profundidade é utilidade, não extensão. Não repita o artigo público com mais palavras. Nenhum artigo estático é diagnóstico, terapia ou orientação individual. Não atribua revisão profissional que não ocorreu. Use exemplos fictícios identificados, não dados de usuários.
Recursos reais do AVNC: Essencial tem diário, mapa, descobertas e relatório semanal. Plus inclui relatório mensal; plano de autocuidado e orientação têm elegibilidade e revisão humana próprias. Escreva 'quando disponível', não prometa liberação ou substitua esses serviços. Não proponha inferir causas, gatilhos ou diagnósticos por pontuação.`
}

export function validateTierDeliverables(content: string, plan?: string): string[] {
  const sections = articleTierSections(plan)
  const blocks = [...content.matchAll(/^##\s+(.+)\r?\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/gm)]
  return sections.filter(section => !blocks.some(block => block[1].trim() === section && block[2].replace(/[#*_>\s]/g, '').length >= 80))
    .map(section => `entrega ${plan === 'plus' ? 'Plus' : 'Essencial'} ausente ou incompleta: ${section}`)
}


export function buildTierCompletionPrompt(content: string, plan?: string): string {
  return `Complete as entregas editoriais que faltam no artigo, preservando informações úteis e o assunto. Corrija generalidades e identifique exemplos como fictícios. Não apenas aumente o texto. Preserve links já fornecidos, não invente estudos, URLs, autoria ou revisão profissional. Retorne só o corpo em Markdown, sem H1 ou HTML.
${articleTierBrief(plan)}
${editorialSourceBrief()}
Pendências: ${validateTierDeliverables(content, plan).join('; ')}
Artigo: ${content}`
}
