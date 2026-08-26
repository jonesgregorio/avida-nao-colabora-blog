// Contrato editorial único para artigos gerados por IA.
// Arquivo deliberadamente puro (sem Deno/browser APIs) para ser reutilizado
// tanto pelas Edge Functions quanto pela Fábrica IA no frontend.

export const MIN_ARTICLE_WORDS = 1000

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
  if (articleWordCount(article.content) < MIN_ARTICLE_WORDS) errors.push(`menos de ${MIN_ARTICLE_WORDS} palavras`)
  if (article.excerpt.trim().length < 80) errors.push('resumo curto/ausente')
  if (article.seo_title.trim().length < 25 || article.seo_title.length > 60) errors.push('SEO title inválido')
  if (article.seo_description.trim().length < 90 || article.seo_description.length > 155) errors.push('meta description inválida')
  if (!article.keyword.trim() || article.secondary_keywords.length < 2) errors.push('palavras-chave insuficientes')
  if (!article.image_query.trim()) errors.push('busca de imagem ausente')
  if (!context.imageUrl) errors.push('imagem de capa ausente')
  if (!article.image_alt.trim()) errors.push('texto alternativo da imagem ausente')
  if (!article.diary_question.trim()) errors.push('pergunta para diário ausente')
  if (!article.cta_text.trim()) errors.push('CTA ausente')
  if (context.duplicate) errors.push('artigo duplicado')
  return errors
}

export function buildArticleExpansionPrompt(content: string): string {
  return `Amplie o artigo abaixo para pelo menos 1100 palavras, preservando o sentido, o tom acolhedor, a estrutura e a segurança. Não invente dados clínicos ou pesquisas. Faça somente UMA versão expandida e responda apenas com o corpo final do artigo.\n\n${content}`
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

Cada corpo precisa ter entre 1100 e 1500 palavras, com introdução acolhedora, explicação simples, exemplos de vida real sem nomes, reflexão guiada, exercício prático curto, pergunta para diário, CTA gentil e aviso de que o conteúdo não substitui acompanhamento profissional.
Use subtítulos ## e ### quando ajudarem a leitura. Não use título H1 dentro do corpo. Prefira parágrafos corridos e não abuse de listas.
${quantity > 1 ? 'Varie temas e ângulos; não gere títulos quase iguais.' : ''}
Não diagnostique, não prescreva, não prometa cura e não invente pesquisas ou estatísticas.
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
