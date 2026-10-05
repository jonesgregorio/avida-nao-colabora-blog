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
}

export interface ArticlePromptOptions {
  quantity?: number
  themes: string[]
  tone?: string
  category?: string
  audience?: string
  keyword?: string
  extraInstructions?: string
}

export interface ArticleValidationContext {
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
  if (context.duplicate) errors.push('artigo duplicado')
  if (context.publication) {
    if (!context.author?.trim()) errors.push('autoria ausente')
    if (!context.reviewed) errors.push('revisão editorial e capa não confirmadas')
    if (!hasEditorialSource(article.content)) errors.push('fonte oficial com link HTTPS ausente')
    if (!context.relatedSlugs?.length) errors.push('artigos relacionados ausentes')
    if (context.catalog) {
      const bodyTargets = [...article.content.matchAll(/\]\((?:https:\/\/(?:www\.)?avidanaocolabora\.com)?\/blog\/([a-z0-9-]+)(?:[?#][^)]*)?\)/g)].map(match => match[1])
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
Temas disponíveis: ${themes.join(' | ') || 'saúde emocional'}.
Categoria-base: ${category}. Tom: ${tone}. Público-alvo: ${audience}.${keyword ? ` Palavra-chave prioritária: ${keyword}.` : ''}

Cada corpo deve responder à intenção de busca com clareza, sem contagem obrigatória de palavras nem preenchimento. Comece com uma resposta direta, explique o necessário, dê exemplos explicitamente fictícios e adaptáveis, pergunta para diário, CTA gentil e aviso de que o conteúdo não substitui acompanhamento profissional.
Use subtítulos ## e ### quando ajudarem a leitura. Não use título H1 dentro do corpo. Prefira parágrafos corridos e não abuse de listas.
${quantity > 1 ? 'Varie temas e ângulos; não gere títulos quase iguais.' : ''}
Não diagnostique, não prescreva, não prometa cura e não invente pesquisas ou estatísticas.
Use apenas as fontes oficiais fornecidas no briefing. Quando o briefing fornecer fontes verificadas e o texto fizer afirmações factuais de saúde, inclua ao final uma seção "## Fontes consultadas" com os links recebidos. Nunca invente autor, credencial, estudo, instituição ou URL; sem fonte fornecida, mantenha o conteúdo educativo e não clínico.
${editorialSourceBrief()}
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
  "cta_text": "CTA gentil"
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
  return /\]\(https:\/\/(?:www\.)?(?:nhs\.uk|nimh\.nih\.gov|nhlbi\.nih\.gov|cci\.health\.wa\.gov\.au|gov\.br)\/[^\s)]+\)/i.test(content)
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

export function selectRelatedArticles(topic: string, catalog: ArticleCatalogItem[], ownSlug = ''): ArticleCatalogItem[] {
  const tokens = topicTokens(topic)
  return catalog.filter(row => row.slug !== ownSlug && row.plan_required === 'free')
    .map(row => ({ row, score: [...topicTokens(`${row.title} ${row.keyword || ''}`)].filter(t => tokens.has(t)).length }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.row.slug.localeCompare(b.row.slug))
    .slice(0, 3).map(item => item.row)
}

export function catalogBrief(catalog: ArticleCatalogItem[]): string {
  return `Catálogo já publicado — crie intenção específica diferente, evite duplicar estes assuntos. Para links internos use exclusivamente os endereços fornecidos, naturalmente no texto:\n${catalog.map(row => `${row.title} | ${row.keyword || ''} | /blog/${row.slug}`).join('\n')}`
}


export function withEditorialDisclosure(content: string, origin: string, reviewed: boolean): string {
  if (origin !== 'ia' || !reviewed || /inteligência artificial|apoio de IA/i.test(content)) return content
  return `${content.trim()}\n\n## Transparência editorial\n\nConteúdo elaborado com apoio de inteligência artificial e conferido editorialmente antes da publicação. Essa conferência não equivale a revisão clínica por profissional habilitado.`
}
