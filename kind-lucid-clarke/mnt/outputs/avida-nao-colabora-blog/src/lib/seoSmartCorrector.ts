import { supabase } from './supabase'
import { generateSEO, generateWithFailover } from './aiContent'
import { searchCoverImage } from './imageSearch'

export type SeoSmartIssue = 'no_seo' | 'no_image' | 'bad_slug' | 'thin' | 'no_author' | 'no_review' | 'no_links' | 'old' | 'indexing' | 'opportunity' | 'ctr' | 'position'

export interface SeoSmartArticle {
  id: string
  title: string
  slug: string
  status: string
  published: boolean | null
  category?: string | null
  seo_title: string | null
  seo_description: string | null
  keyword: string | null
  content: string | null
  image_url: string | null
  cover_image: string | null
  cover_image_url: string | null
  image_alt: string | null
  author: string | null
  related_slugs: string[] | null
  reviewed_at: string | null
  review_notes?: string | null
  published_at: string | null
  updated_at: string | null
  created_at: string
}

export interface SeoSmartFixResult {
  changed: string[]
  skipped: string[]
  newSlug?: string
}

const STOP = new Set(['a','o','as','os','de','da','do','das','dos','e','em','um','uma','para','por','com','sem','como','que','se','seu','sua','seus','suas','na','no','nas','nos'])

function words(value: string) {
  return value.toLocaleLowerCase('pt-BR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/).filter(w => w.length > 2 && !STOP.has(w))
}

function similarity(a: SeoSmartArticle, b: SeoSmartArticle) {
  const aa = new Set(words(`${a.title} ${a.keyword || ''} ${a.category || ''}`))
  const bb = new Set(words(`${b.title} ${b.keyword || ''} ${b.category || ''}`))
  let score = 0
  for (const word of aa) if (bb.has(word)) score += 2
  if (a.category && b.category && a.category === b.category) score += 4
  return score
}

export function normalizedSlug(value: string) {
  const full = value.toLocaleLowerCase('pt-BR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  if (full.length <= 60) return full
  // Corta em fronteira de palavra: o slice(0, 60) puro deixava slugs quebrados no meio
  // (\u2026-transformar-isso-em-obrigaca) \u2014 feio no Google e ruim pra CTR.
  const cut = full.slice(0, 60)
  const clean = full[60] === '-' ? cut : cut.slice(0, cut.lastIndexOf('-'))
  return (clean || cut).replace(/-+$/g, '')
}

async function updateArticle(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('articles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

async function fixMetadata(article: SeoSmartArticle, changed: string[]) {
  const raw = await generateSEO(article.title, article.content || article.title)
  const title = raw.match(/META TITLE:\s*(.+)/i)?.[1]?.trim()
  const desc = raw.match(/META DESCRIPTION:\s*(.+)/i)?.[1]?.trim()
  const kw = raw.match(/KEYWORDS:\s*(.+)/i)?.[1]?.trim()
  const patch: Record<string, unknown> = {}
  if (title) patch.seo_title = title.slice(0, 60)
  if (desc) patch.seo_description = desc.slice(0, 155)
  if (kw) patch.keyword = kw.split(',')[0]?.trim()
  if (!Object.keys(patch).length) throw new Error('A IA não retornou metadados SEO válidos.')
  await updateArticle(article.id, patch)
  changed.push('título SEO, descrição e palavra-chave')
}

async function fixImage(article: SeoSmartArticle, changed: string[]) {
  const hasImage = Boolean(article.image_url || article.cover_image || article.cover_image_url)
  if (!hasImage) {
    const cover = await searchCoverImage(article.title, article.category || undefined, article.content || undefined)
    if (!cover?.url) throw new Error('Não consegui encontrar uma imagem de capa adequada agora.')
    await updateArticle(article.id, { cover_image_url: cover.url, image_alt: cover.alt || `Imagem de apoio do artigo ${article.title}` })
    changed.push('imagem de capa e texto alternativo')
    return
  }
  if (!article.image_alt?.trim()) {
    const alt = await generateWithFailover(
      `Crie um texto alternativo curto e objetivo para a imagem de capa de um artigo chamado "${article.title}". Não invente detalhes visuais específicos que você não consegue ver. Use uma descrição segura do tipo "Imagem de apoio sobre...". Responda somente com o texto alternativo, em português brasileiro, no máximo 140 caracteres.`,
      { contentType: 'seo_image_alt', entityKey: `seo-alt:${article.id}` },
    )
    await updateArticle(article.id, { image_alt: alt.replace(/^['"]|['"]$/g, '').slice(0, 180) })
    changed.push('texto alternativo da imagem')
  }
}

async function fixLinks(article: SeoSmartArticle, all: SeoSmartArticle[], changed: string[]) {
  const candidates = all
    .filter(other => other.id !== article.id && (other.published === true || other.status === 'published') && other.slug)
    .map(other => ({ other, score: similarity(article, other) }))
    .sort((a, b) => b.score - a.score || a.other.title.localeCompare(b.other.title, 'pt-BR'))
    .slice(0, 4)
    .map(item => item.other.slug)
  if (!candidates.length) throw new Error('Não há outros artigos publicados suficientes para criar links internos.')
  await updateArticle(article.id, { related_slugs: candidates })
  changed.push(`${candidates.length} links internos relacionados`)
}

async function fixThinContent(article: SeoSmartArticle, changed: string[]) {
  const original = (article.content || '').trim()
  const prompt = `Você é editor de conteúdo da A Vida Não Colabora. Reescreva e amplie o artigo abaixo para ficar útil, profundo e natural, com aproximadamente 1000 a 1500 palavras. Preserve o assunto, o tom acolhedor, os pontos verdadeiros e a estrutura em Markdown. Não invente estudos, estatísticas, diagnósticos, promessas de tratamento ou fontes. Não use título H1. Inclua subtítulos ##, exemplos cotidianos e orientações práticas quando fizer sentido. Mantenha o aviso de responsabilidade se já existir. Retorne apenas o artigo final completo.\n\nTÍTULO: ${article.title}\n\nCONTEÚDO ATUAL:\n${original || article.title}`
  const improved = await generateWithFailover(prompt, { contentType: 'seo_content_expansion', entityKey: `seo-expand:${article.id}` })
  const count = improved.trim().split(/\s+/).filter(Boolean).length
  if (count < 800) throw new Error(`A IA devolveu conteúdo ainda curto (${count} palavras). Nada foi alterado.`)
  await updateArticle(article.id, { content: improved.trim() })
  changed.push(`conteúdo ampliado para ${count} palavras`)
}

async function fixAuthor(article: SeoSmartArticle, changed: string[]) {
  await updateArticle(article.id, { author: 'Equipe editorial A Vida Não Colabora' })
  changed.push('autoria editorial')
}

async function fixSlug(article: SeoSmartArticle, all: SeoSmartArticle[], changed: string[]) {
  const next = normalizedSlug(article.title)
  if (!next || next === article.slug) throw new Error('O slug atual já é a melhor versão segura que consegui gerar.')
  if (all.some(other => other.id !== article.id && other.slug === next)) throw new Error('Já existe outro conteúdo com o slug sugerido. Nada foi alterado.')
  const fromPath = `/blog/${article.slug}`
  const toPath = `/blog/${next}`
  const { error: redirectError } = await supabase.from('analytics_redirects').upsert({
    from_path: fromPath,
    to_path: toPath,
    type: 301,
    is_active: true,
  }, { onConflict: 'from_path' })
  if (redirectError) throw redirectError
  try {
    await updateArticle(article.id, { slug: next })
  } catch (error) {
    await supabase.from('analytics_redirects').delete().eq('from_path', fromPath).eq('to_path', toPath)
    throw error
  }
  changed.push('slug corrigido com redirecionamento 301 automático')
  return next
}

async function prepareReview(article: SeoSmartArticle, changed: string[]) {
  const notes = await generateWithFailover(
    `Faça uma pré-revisão editorial e de SEO do artigo abaixo. Explique em linguagem simples, em até 6 tópicos curtos, se há problemas de clareza, repetição, promessa clínica, afirmações fortes sem fonte, estrutura, SEO ou links internos. Não diga que houve revisão humana. Termine com "Pré-revisão automática — requer validação humana para marcar como revisado".\n\nTÍTULO: ${article.title}\n\nCONTEÚDO:\n${(article.content || '').slice(0, 12000)}`,
    { contentType: 'seo_editorial_prereview', entityKey: `seo-review:${article.id}` },
  )
  await updateArticle(article.id, { review_notes: notes.slice(0, 6000) })
  changed.push('pré-revisão automática salva nas observações')
}

async function refreshOld(article: SeoSmartArticle, changed: string[]) {
  const original = (article.content || '').trim()
  if (!original) throw new Error('O conteúdo está vazio e precisa ser editado antes da atualização.')
  const refreshed = await generateWithFailover(
    `Atualize este artigo antigo sem mudar seu tema central. Melhore clareza, organização e utilidade. Preserve fatos e não invente dados atuais, estudos, estatísticas ou referências. Não transforme idade do artigo em motivo para mudar conteúdo que já está correto. Retorne somente o artigo final completo em Markdown.\n\nTÍTULO: ${article.title}\n\nARTIGO:\n${original}`,
    { contentType: 'seo_content_refresh', entityKey: `seo-refresh:${article.id}` },
  )
  if (refreshed.trim().split(/\s+/).length < 500) throw new Error('A atualização retornou conteúdo insuficiente. Nada foi alterado.')
  await updateArticle(article.id, { content: refreshed.trim() })
  changed.push('conteúdo antigo revisado e atualizado pela IA')
}

export async function smartFixArticle(
  article: SeoSmartArticle,
  allArticles: SeoSmartArticle[],
  issues: SeoSmartIssue[],
): Promise<SeoSmartFixResult> {
  const changed: string[] = []
  const skipped: string[] = []
  let newSlug: string | undefined
  let metadataDone = false

  const unique = [...new Set(issues)]
  for (const issue of unique) {
    try {
      if (issue === 'no_seo' || issue === 'opportunity' || issue === 'indexing' || issue === 'ctr') {
        if (!metadataDone) {
          await fixMetadata(article, changed)
          metadataDone = true
        }
      } else if (issue === 'position') {
        if (!metadataDone) { await fixMetadata(article, changed); metadataDone = true }
        await fixLinks(article, allArticles, changed)
      } else if (issue === 'no_image') await fixImage(article, changed)
      else if (issue === 'no_links') await fixLinks(article, allArticles, changed)
      else if (issue === 'thin') await fixThinContent(article, changed)
      else if (issue === 'no_author') await fixAuthor(article, changed)
      else if (issue === 'bad_slug') newSlug = await fixSlug(article, allArticles, changed)
      else if (issue === 'no_review') await prepareReview(article, changed)
      else if (issue === 'old') await refreshOld(article, changed)
    } catch (error) {
      skipped.push(`${issue}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { changed, skipped, newSlug }
}
