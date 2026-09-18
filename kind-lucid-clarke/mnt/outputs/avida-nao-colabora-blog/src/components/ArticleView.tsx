import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Brain, Clock, CloudRain, Feather, Heart, NotebookPen } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Article, Plan } from '../types'
import { trackEvent } from '../lib/analytics'
import { DEFAULT_CTA } from '../lib/articleCta'
import { ARTICLE_FALLBACK_TITLE } from '../lib/pageTitles'
import { setPendingAction } from '../lib/pendingAction'
import { markArticleRead } from '../lib/readingProgress'
import { estimateReadTime, renderArticleContent } from '../lib/renderArticle'
import { getCuratedRelatedSlugs, getSeoGuideForArticle, guidePathFor, guideToolPath } from '../lib/seoGuides'
import { supabase } from '../lib/supabase'
import GuidedContentPlayer from './GuidedContentPlayer'

interface ArticleViewProps {
  slug?: string
  article?: Article
  onBack: () => void
  user: User | null
  profile?: { plan: Plan } | null
  navigate?: (v: string, slug?: string) => void
  onSelectArticle?: (slug: string) => void
  onSavePromptToDiary?: (prompt: string, articleTitle: string, articleSlug: string, category: string) => void
}

type RelatedArticle = Pick<Article, 'id' | 'title' | 'slug' | 'category' | 'read_time' | 'image_url' | 'cover_image_url' | 'cover_image'>
type FeedbackType = 'helped' | 'made_me_think' | 'felt_heavy' | 'want_lighter_content'

const FEEDBACK_OPTIONS: { type: FeedbackType; label: string; icon: React.ReactNode }[] = [
  { type: 'helped', label: 'me ajudou', icon: <Heart size={16} /> },
  { type: 'made_me_think', label: 'me fez pensar', icon: <Brain size={16} /> },
  { type: 'felt_heavy', label: 'foi pesado', icon: <CloudRain size={16} /> },
  { type: 'want_lighter_content', label: 'quero algo mais leve', icon: <Feather size={16} /> },
]

function cleanEditorialText(value: string) {
  return value
    .replace(/:::[\s\S]*?:::/g, ' ')
    .replace(/^::.*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#~]/g, ' ')
    .replace(/^[-+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function shorten(value: string, max: number) {
  const clean = cleanEditorialText(value)
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max + 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.65 ? lastSpace : max).trim()}…`
}

function extractSummary(content: string) {
  const lines = content.split('\n').map(cleanEditorialText).filter(line => line.length > 45)
  const topic = shorten(lines[0] || 'Uma leitura para organizar o que você está vivendo agora.', 150)
  const mainIdea = shorten(lines[1] || lines[0] || 'Perceber o que acontece com você pode ajudar a escolher um próximo passo mais possível.', 190)
  const actionVerbs = /^(tente|reserve|pratique|observe|respire|escreva|anote|faça|permita|lembre|cuide|dedique|escolha|experimente)/i
  const action = lines.find(line => actionVerbs.test(line)) || lines[2] || lines[1] || ''
  const question = cleanEditorialText(content).match(/[^.!?]{20,}\?/)?.[0]
  return {
    topic,
    mainIdea,
    smallAction: shorten(action || 'Escolha uma observação pequena que faça sentido para hoje.', 170),
    diaryQuestion: shorten(question || 'O que esse conteúdo despertou em mim hoje?', 210),
  }
}

function parseDiaryQuestions(content: string) {
  const lines = content.split('\n')
  const questions: string[] = []
  let inSection = false
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower.includes('perguntas para o diário') || lower.includes('para o diário')) { inSection = true; continue }
    if (inSection && (line.startsWith('## ') || line.startsWith('# '))) break
    if (inSection) {
      const clean = cleanEditorialText(line.replace(/^[-*\d.]+\s*/, ''))
      if (clean.length > 10 && clean.includes('?')) questions.push(clean)
    }
  }
  return questions.slice(0, 5)
}

export default function ArticleView({ slug, article: initialArticle, onBack, user, profile, navigate, onSelectArticle, onSavePromptToDiary }: ArticleViewProps) {
  const [article, setArticle] = useState<Article | null>(initialArticle || null)
  const [related, setRelated] = useState<RelatedArticle[]>([])
  const [loading, setLoading] = useState(!initialArticle)
  const [locked, setLocked] = useState<{ title: string; summary: string | null; excerpt: string | null; category: string | null; plan_required: string; image_url: string | null; read_time: number | null } | null>(null)
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackType | null>(null)
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)
  const [showSummary, setShowSummary] = useState(true)

  const doNavigate = (view: string, articleSlug?: string) => {
    if (navigate) navigate(view, articleSlug)
    else if (onSelectArticle && articleSlug) onSelectArticle(articleSlug)
    else document.dispatchEvent(new CustomEvent('navigate', { detail: view }))
  }

  useEffect(() => {
    if (!locked || user) return
    const currentSlug = slug || article?.slug
    if (!currentSlug) return
    setPendingAction({ view: 'article', articleSlug: currentSlug })
    if (navigate) navigate('auth')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, user])

  useEffect(() => {
    if (slug) void loadArticle(slug)
    else if (initialArticle) { setArticle(initialArticle); void loadRelated(initialArticle) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, initialArticle])

  useEffect(() => {
    if (!user || !article) return
    void supabase.from('article_feedback').select('feedback_type').eq('user_id', user.id).eq('article_slug', article.slug).single().then(({ data }) => {
      if (data) { setSelectedFeedback(data.feedback_type as FeedbackType); setFeedbackDone(true) }
    })
  }, [user, article])

  useEffect(() => { if (user && article?.slug) void markArticleRead(user.id, article.slug) }, [user, article?.slug])

  useEffect(() => {
    if (!article) { document.title = ARTICLE_FALLBACK_TITLE; return }
    const title = (article.seo_title || article.title || 'Artigo').trim()
    const description = shorten(article.seo_description || article.summary || article.excerpt || article.content || '', 320)
    const canonical = `https://www.avidanaocolabora.com/blog/${encodeURIComponent(article.slug)}`
    const image = article.og_image || article.cover_image_url || article.image_url || article.cover_image || ''
    document.title = title
    const setMeta = (selector: string, content: string) => { const el = document.head.querySelector(selector); if (el && content) el.setAttribute('content', content) }
    setMeta('meta[name="description"]', description); setMeta('meta[property="og:title"]', title); setMeta('meta[property="og:description"]', description); setMeta('meta[property="og:url"]', canonical)
    if (image) setMeta('meta[property="og:image"]', image)
    setMeta('meta[name="twitter:title"]', title); setMeta('meta[name="twitter:description"]', description)
    if (image) setMeta('meta[name="twitter:image"]', image)
    document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
  }, [article])

  useEffect(() => {
    if (!article?.slug) return
    trackEvent('article_view', { entity_id: article.slug, entity_title: article.title, user_id: user?.id ?? null, metadata: { category: article.category ?? null } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.slug])

  useEffect(() => {
    const currentSlug = article?.slug
    if (!currentSlug) return
    const fired = new Set<number>()
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight
      if (height <= 0) return
      const pct = (window.scrollY / height) * 100
      for (const mark of [50, 75, 100]) if (pct >= mark && !fired.has(mark)) { fired.add(mark); trackEvent(`scroll_${mark}`, { entity_id: currentSlug, user_id: user?.id ?? null }) }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [article?.slug, user?.id])

  async function loadArticle(currentSlug: string) {
    setLoading(true); setLocked(null)
    try {
      const cols = 'id,slug,title,category,content,author,created_at,published_at,updated_at,reviewed_at,read_time,image_alt,cta_mode,cta_custom_title,cta_custom_text,image_url,cover_image_url,cover_image,related_slugs,tags,emotional_themes,keywords,seo_title,seo_description,og_image,objective,intensity'
      const { data, error } = await supabase.from('articles').select(cols).eq('slug', currentSlug).single()
      if (error || !data) {
        setArticle(null)
        try {
          const { data: teaser } = await supabase.rpc('get_article_teaser', { p_slug: currentSlug })
          const row = Array.isArray(teaser) ? teaser[0] : teaser
          if (row?.plan_required && row.plan_required !== 'free') { setLocked(row); return }
        } catch { /* no teaser */ }
        try {
          const path = `/blog/${currentSlug}`
          const { data: redirect } = await supabase.from('analytics_redirects').select('id,to_path,is_active,hits').eq('from_path', path).eq('is_active', true).maybeSingle()
          if (redirect?.to_path) {
            void supabase.from('analytics_redirects').update({ hits: (redirect.hits ?? 0) + 1 }).eq('id', redirect.id)
            const target = redirect.to_path.replace(/^\/blog\//, '')
            if (redirect.to_path.startsWith('/blog/') && onSelectArticle) { onSelectArticle(target); return }
            if (navigate) { navigate(redirect.to_path.replace(/^\//, '') || 'home'); return }
          }
        } catch { /* no redirect */ }
        trackEvent('error_404', { entity_id: `/blog/${currentSlug}` }); return
      }
      setArticle(data); await loadRelated(data)
    } catch { setArticle(null) } finally { setLoading(false) }
  }

  async function fetchBySlugs(slugs: string[]) {
    if (!slugs.length) return [] as RelatedArticle[]
    const sel = 'id,title,slug,category,read_time,image_url,cover_image_url,cover_image'
    const { data } = await supabase.from('articles').select(sel).in('slug', slugs).eq('published', true)
    const rows = (data ?? []) as RelatedArticle[]
    const order = new Map(slugs.map((value, index) => [value, index]))
    return rows.sort((a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999))
  }

  async function loadRelated(art: Article) {
    try {
      const chosen: RelatedArticle[] = []
      const seen = new Set<string>([art.slug])
      const add = (items: RelatedArticle[]) => { for (const item of items) if (!seen.has(item.slug) && chosen.length < 3) { seen.add(item.slug); chosen.push(item) } }
      add(await fetchBySlugs(art.related_slugs ?? []))
      add(await fetchBySlugs(getCuratedRelatedSlugs(art.slug, 6)))
      if (chosen.length < 3) {
        const sel = 'id,title,slug,category,read_time,image_url,cover_image_url,cover_image'
        const { data } = await supabase.from('articles').select(sel).eq('category', art.category).neq('slug', art.slug).eq('published', true).order('published_at', { ascending: false }).limit(12)
        add((data ?? []) as RelatedArticle[])
      }
      setRelated(chosen.slice(0, 3))
    } catch { setRelated([]) }
  }

  const handleFeedback = useCallback(async (type: FeedbackType) => {
    setSelectedFeedback(type)
    if (!user || !article) return
    setFeedbackSaving(true)
    await supabase.from('article_feedback').upsert({ user_id: user.id, article_slug: article.slug, article_id: article.id, feedback_type: type }, { onConflict: 'user_id,article_slug' })
    setFeedbackSaving(false); setFeedbackDone(true)
  }, [user, article])

  function handleAnswerInDiary(prompt: string) {
    if (!article) return
    if (!user) {
      setPendingAction({ view: 'diary', diaryContext: { prompt, articleTitle: article.title, articleSlug: article.slug, category: article.category } })
      doNavigate('auth'); return
    }
    if (onSavePromptToDiary) onSavePromptToDiary(prompt, article.title, article.slug, article.category)
    else doNavigate('diary')
  }

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-500 border-t-transparent" /></div>

  if (locked) {
    const isAccount = locked.plan_required === 'account'
    const planLabel = locked.plan_required === 'plus' ? 'Plus' : 'Essencial'
    return <div className="mx-auto max-w-2xl px-4 py-16"><button onClick={onBack} className="mb-6 inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-soft hover:text-forest-900"><ArrowLeft className="h-4 w-4" /> Voltar para conteúdos</button><div className="rounded-2xl border border-line bg-white p-8 text-center"><span className="mb-4 inline-block rounded-full bg-mint px-3 py-1 text-xs font-semibold text-forest-700">{isAccount ? 'Conteúdo gratuito — requer conta' : `Conteúdo exclusivo do plano ${planLabel}`}</span><h1 className="font-serif text-2xl leading-tight text-forest-900 md:text-3xl">{locked.title}</h1>{(locked.summary || locked.excerpt) && <p className="mt-3 text-ink-soft">{shorten(locked.summary || locked.excerpt || '', 260)}</p>}<p className="mt-5 text-sm text-ink-soft">{isAccount ? <>Crie sua conta <strong>gratuita</strong> para ler este conteúdo completo.</> : <>Assine o plano <strong>{planLabel}</strong> para ler este conteúdo completo.</>}</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={() => doNavigate(isAccount ? 'auth' : 'pricing')} className="min-h-11 rounded-xl bg-forest-900 px-5 text-sm font-medium text-white">{isAccount ? 'Criar conta gratuita' : 'Ver planos'}</button>{!user && <button onClick={() => doNavigate('auth')} className="min-h-11 rounded-xl border border-line px-5 text-sm font-medium text-forest-800">Já tenho conta — entrar</button>}</div></div></div>
  }

  if (!article) return <div className="mx-auto max-w-3xl px-4 py-20 text-center"><p className="text-ink-soft">Artigo não encontrado.</p><button onClick={onBack} className="mt-4 min-h-11 text-forest-600 hover:underline">Ver todos os artigos</button></div>

  const guide = getSeoGuideForArticle(article.slug)
  const tool = guideToolPath(guide)
  const displayCategory = guide?.cluster || article.category
  const summary = extractSummary(article.content || '')
  const diaryQuestions = parseDiaryQuestions(article.content || '')
  const formattedDate = (article.published_at || article.created_at) ? new Date(article.published_at || article.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''
  const getImage = (item: Article | RelatedArticle) => item.image_url || item.cover_image_url || item.cover_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80'
  const openTool = () => { if (!user) { setPendingAction({ view: tool.view }); doNavigate('auth'); return } doNavigate(tool.view) }
  const toolLabel = guide?.tool === 'self-care' ? 'Abrir meu plano de autocuidado' : guide?.tool === 'map' ? 'Abrir meu mapa emocional' : guide?.tool === 'checkin' ? 'Fazer meu check-in emocional' : 'Registrar no diário'

  return <div className="mx-auto max-w-3xl px-4 py-10">
    <div className="print-only article-print-header"><h1 className="mb-1 text-2xl font-bold text-forest-900">{article.title}</h1><p className="text-sm text-ink-soft">{displayCategory} · {formattedDate}</p></div>
    <nav aria-label="Trilha de navegação" className="mb-4 no-print"><ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft"><li><button onClick={onBack} className="min-h-11 hover:text-forest-900">Conteúdos guiados</button></li>{guide && <><li aria-hidden>›</li><li><a href={guidePathFor(guide)} className="inline-flex min-h-11 items-center font-medium text-forest-700 hover:underline">{guide.title}</a></li></>}</ol></nav>
    <button onClick={onBack} className="mb-8 flex min-h-11 items-center gap-2 rounded text-sm text-ink-soft hover:text-forest-900 no-print"><ArrowLeft className="h-4 w-4" /> Voltar para conteúdos</button>
    <div className="mb-4"><span className="rounded-full bg-mint px-3 py-1 text-sm font-medium text-forest-700">{displayCategory}</span></div>
    <h1 className="mb-4 font-serif text-3xl leading-tight text-forest-800 md:text-4xl">{article.title}</h1>
    <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft no-print"><span>{article.author || 'Equipe editorial A Vida Não Colabora'}</span>{formattedDate && <><span>·</span><time dateTime={article.published_at || article.created_at}>{formattedDate}</time></>}<span>·</span><span className="inline-flex items-center gap-1.5"><Clock size={14} /> {article.read_time || estimateReadTime(article.content || '')} min de leitura</span><span>·</span><a href="/politica-editorial" onClick={event => { event.preventDefault(); doNavigate('editorial-policy') }} className="font-medium text-forest-700 underline underline-offset-2">Como cuidamos deste conteúdo</a></div>
    <GuidedContentPlayer article={article} user={user} plan={profile?.plan ?? 'free'} onOpenArticle={onSelectArticle} />
    {showSummary && <div className="relative mb-8 rounded-2xl border border-forest-100 bg-mint/50 p-5 no-print"><button onClick={() => setShowSummary(false)} className="absolute right-3 top-3 min-h-11 min-w-11 rounded text-xs text-ink-soft">✕ fechar</button><p className="mb-3 pr-20 text-xs font-medium uppercase tracking-wider text-forest-500">Se você está sem energia para ler tudo agora, aqui está o resumo.</p><div className="space-y-2.5 text-sm text-forest-900"><p><strong>📌 O que aborda:</strong> {summary.topic}</p><p><strong>💡 Ideia principal:</strong> {summary.mainIdea}</p><p><strong>🌱 Ação pequena para hoje:</strong> {summary.smallAction}</p><p><strong>📖 Pergunta para o diário:</strong> {summary.diaryQuestion}</p></div></div>}
    <div className="mb-8 aspect-video overflow-hidden rounded-2xl"><img src={getImage(article)} alt={article.image_alt || article.title} className="h-full w-full object-cover" /></div>
    <div className="prose prose-sage max-w-none article-content">{renderArticleContent(article.content || '')}</div>
    {diaryQuestions.length > 0 && <div className="mt-12 no-print"><h3 className="mb-1 font-serif text-lg text-forest-900">Perguntas para o diário</h3><p className="mb-4 text-sm text-ink-soft">Use estas perguntas para explorar o que esse artigo tocou em você.</p><div className="grid gap-3 sm:grid-cols-2">{diaryQuestions.map((question, index) => <div key={index} className="flex flex-col gap-3 rounded-xl border border-line bg-paper-soft p-4"><p className="text-sm leading-relaxed text-forest-700">{question}</p><button onClick={() => handleAnswerInDiary(question)} className="inline-flex min-h-11 items-center gap-1 self-start rounded-full border border-forest-200 bg-mint/40 px-3 text-xs font-medium text-forest-700"><NotebookPen size={12} />{user ? 'Responder no diário' : 'Entrar para responder'}</button></div>)}</div></div>}
    <div className="mt-10 no-print article-feedback"><h3 className="mb-1 font-serif text-lg text-forest-900">Como esse artigo encontrou você hoje?</h3>{feedbackDone ? <p className="mt-2 text-sm text-forest-500">Sua resposta foi registrada. Que bom ter você aqui. 💚</p> : <><p className="mb-4 text-sm text-ink-soft">Escolha o que mais combina com o que você está sentindo agora.</p><div className="flex flex-wrap gap-2">{FEEDBACK_OPTIONS.map(option => <button key={option.type} onClick={() => handleFeedback(option.type)} disabled={feedbackSaving} className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm ${selectedFeedback === option.type ? 'border-forest-600 bg-forest-600 text-white' : 'border-line bg-white text-forest-700'}`}>{option.icon} {option.label}</button>)}</div>{!user && <p className="mt-2 text-xs text-ink-soft">Faça login para salvar sua resposta.</p>}</>}</div>
    <div className="mt-10 rounded-2xl border border-mint bg-mint/40 p-6 no-print article-cta-buttons"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[.14em] text-forest-600">Próximo passo no AVNC</p><h3 className="mb-2 font-serif text-lg text-forest-900">{guide ? `Continue este cuidado em ${guide.title.toLowerCase()}` : (user ? DEFAULT_CTA.logged.title : DEFAULT_CTA.guest.title)}</h3><p className="mb-4 text-sm text-ink-soft">{guide ? 'Use uma ferramenta do AVNC conectada a este tema para transformar a leitura em uma observação prática da sua rotina.' : (user ? DEFAULT_CTA.logged.paragraph : DEFAULT_CTA.guest.paragraphs[0])}</p><button onClick={openTool} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-forest-600 px-5 text-sm font-medium text-white hover:bg-forest-700"><NotebookPen size={15} />{user ? toolLabel : `Entrar para ${toolLabel.toLowerCase()}`}</button></div>
    <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50 p-4 no-print"><p className="text-sm text-amber-800"><strong>Importante:</strong> Este conteúdo é informativo e educativo. Não substitui avaliação, diagnóstico ou acompanhamento profissional. Sofrimento intenso, sintomas persistentes ou risco à segurança precisam de avaliação profissional adequada.</p></div>
    {related.length > 0 && <section className="mt-12 no-print" aria-labelledby="continue-explorando"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-forest-600">Leituras conectadas</p><h3 id="continue-explorando" className="font-serif text-xl text-forest-900">Continue explorando</h3></div>{guide && <a href={guidePathFor(guide)} className="inline-flex min-h-11 items-center text-sm font-semibold text-forest-700 hover:underline">Ver guia: {guide.title}</a>}</div><div className="grid gap-4 sm:grid-cols-3">{related.map(item => <a key={item.id} href={`/blog/${item.slug}`} onClick={event => { event.preventDefault(); if (onSelectArticle) onSelectArticle(item.slug); else doNavigate('article', item.slug) }} className="overflow-hidden rounded-xl border border-line bg-white text-left transition-shadow hover:shadow-md"><div className="aspect-video overflow-hidden bg-mint"><img src={getImage(item)} alt={item.title} className="h-full w-full object-cover" /></div><div className="p-3"><span className="text-xs text-forest-600">{getSeoGuideForArticle(item.slug)?.cluster || item.category}</span><p className="mt-1 line-clamp-2 text-sm font-medium text-forest-700">{item.title}</p></div></a>)}</div></section>}
    <div className="print-only article-print-disclaimer"><p>Este conteúdo é informativo e educativo e não substitui avaliação, diagnóstico ou acompanhamento profissional. Fonte: avidanaocolabora.com</p></div>
  </div>
}
