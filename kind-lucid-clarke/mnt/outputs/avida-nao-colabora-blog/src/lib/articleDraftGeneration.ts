import { supabase } from './supabase'
import { generateWithFailover } from './aiContent'
import { buildArticleGenerationPrompt, parseArticlePackages, validateArticlePackage, catalogBrief, selectRelatedArticles, hasTopicOverlap, articleAccessRank, validateTierDeliverables, buildTierCompletionPrompt, type ArticleAIContract } from './articleGenerationContract'

export interface ArticleDraftState {
  pkg: ArticleAIContract
  cover: { url: string; alt: string } | null
  validationErrors: string[]
  prompt: string
  relatedSlugs: string[]
}


async function searchContractCover(query: string): Promise<{ url: string; alt: string } | null> {
  if (!query.trim()) return null
  try {
    const { data, error } = await supabase.functions.invoke('image-search', { body: { query } })
    const out = data as { url?: string; alt?: string } | null
    if (error || !out?.url) return null
    let alt = ''
    if (out.alt?.trim()) {
      try {
        alt = (await generateWithFailover(`Traduza para português brasileiro apenas a descrição literal da fotografia abaixo. Não acrescente cenário, emoção, diagnóstico ou relação com o artigo. Responda só com a descrição, até 220 caracteres. Descrição do fornecedor: ${out.alt}`, { contentType: 'seo_image_alt', entityKey: `cover-alt:${query}`.slice(0, 120) })).trim().slice(0, 220)
      } catch { /* sem descrição verificada, a revisão deve preencher o campo */ }
    }
    return { url: out.url, alt }
  } catch { return null }
}

export async function generateArticleContract(input: {
  theme: string
  plan: string
  category?: string
  tone?: string
  audience?: string
  keyword?: string
  extraInstructions?: string
  operationId: string
}): Promise<ArticleDraftState> {
  const { data: catalog, error: catalogError } = await supabase.from('articles').select('slug,title,keyword,plan_required').eq('published', true).eq('status', 'published').order('title').limit(500)
  if (catalogError || (catalog?.length || 0) >= 500) throw new Error('Não foi possível conferir o catálogo; tente novamente antes de gerar.')
  const rows = catalog || []
  const prompt = buildArticleGenerationPrompt({
    quantity: 1, plan: input.plan,
    themes: [input.theme],
    category: input.category,
    tone: input.tone,
    audience: input.audience,
    keyword: input.keyword,
    extraInstructions: [catalogBrief(rows.filter(row => articleAccessRank(row.plan_required) >= 0 && articleAccessRank(row.plan_required) <= articleAccessRank(input.plan))), input.extraInstructions || ''].join('\n'),
  })
  // incident_entity_key estável por sessão de geração deste tema: retries
  // resolvem o mesmo incidente; um tema novo é uma operação nova.
  const meta = { contentType: 'editorial_article', entityKey: `editorial_article:${input.operationId}` }
  const raw = await generateWithFailover(prompt, meta)
  const parsed = parseArticlePackages(raw, [input.theme], input.category || '')
  if (!parsed.length) throw new Error('A IA não retornou o contrato JSON válido do artigo.')

  const pkg = parsed[0]
  const tierErrors = validateTierDeliverables(pkg.content, input.plan)
  if (tierErrors.length) {
    try {
      const completed = await generateWithFailover(buildTierCompletionPrompt(pkg.content, input.plan), meta)
      if (validateTierDeliverables(completed, input.plan).length < tierErrors.length) pkg.content = completed.trim()
    } catch { /* conserva o rascunho e explica as entregas pendentes */ }
  }
  const cover = await searchContractCover(pkg.image_query)
  pkg.image_alt = cover?.alt || ''
  const validationErrors = validateArticlePackage(pkg, { plan: input.plan, imageUrl: cover?.url, duplicate: hasTopicOverlap(pkg.title, pkg.keyword, rows) })
  return { pkg, cover, validationErrors, prompt, relatedSlugs: selectRelatedArticles(`${pkg.title} ${pkg.keyword}`, rows, '', input.plan).map(row => row.slug) }
}

