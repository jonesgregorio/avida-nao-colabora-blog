import { useState, useEffect, useCallback } from 'react'
import { trackEvent } from '../lib/analytics'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Clock, NotebookPen, Heart, Brain, CloudRain, Feather } from 'lucide-react'
import type { Article, Plan } from '../types'
import type { User } from '@supabase/supabase-js'
import { markArticleRead } from '../lib/readingProgress'
import { renderArticleContent, estimateReadTime } from '../lib/renderArticle'
import { setPendingAction } from '../lib/pendingAction'

interface ArticleViewProps {
  slug?: string
  article?: Article
  onBack: () => void
  user: User | null
  profile?: { plan: Plan } | null
  navigate?: (v: string, slug?: string) => void
  onSelectArticle?: (slug: string) => void
  onSavePromptToDiary?: (prompt: string, articleTitle: string, articleSlug: string, category: string) => void
  // Legacy compat: some callers pass navigate as separate prop
}

// --- Quick summary extracted from article content ---
function extractSummary(content: string, _title: string) {
  const lines = content.split('\n').filter(l => l.trim())
  // First non-heading paragraph
  const firstPara = lines.find(l => !l.startsWith('#') && l.length > 60) || ''
  return {
    topic: firstPara.slice(0, 120) + (firstPara.length > 120 ? '…' : ''),
    mainIdea: 'Você não precisa resolver tudo hoje. Entender o que está sentindo já é um passo.',
    smallAction: 'Reserve 5 minutos para anotar uma palavra que descreve como você está agora.',
    diaryQuestion: 'O que está pesando mais para mim hoje, e o que eu precisaria para me sentir um pouco mais leve?',
  }
}

// --- Parse diary questions from content ---
function parseDiaryQuestions(content: string): string[] {
  const lines = content.split('\n')
  const questions: string[] = []
  let inSection = false
  for (const line of lines) {
    if (line.toLowerCase().includes('perguntas para o diário') || line.toLowerCase().includes('para o diário')) {
      inSection = true
      continue
    }
    if (inSection) {
      if (line.startsWith('## ') || line.startsWith('# ')) break
      const clean = line.replace(/^[-*\d.]+\s*/, '').trim()
      if (clean.length > 10 && clean.includes('?')) questions.push(clean)
    }
  }
  return questions.slice(0, 5)
}

type FeedbackType = 'helped' | 'made_me_think' | 'felt_heavy' | 'want_lighter_content'

const FEEDBACK_OPTIONS: { type: FeedbackType; label: string; icon: React.ReactNode }[] = [
  { type: 'helped', label: 'me ajudou', icon: <Heart size={16} /> },
  { type: 'made_me_think', label: 'me fez pensar', icon: <Brain size={16} /> },
  { type: 'felt_heavy', label: 'foi pesado', icon: <CloudRain size={16} /> },
  { type: 'want_lighter_content', label: 'quero algo mais leve', icon: <Feather size={16} /> },
]

export default function ArticleView({
  slug,
  article: initialArticle,
  onBack,
  user,
  navigate,
  onSelectArticle,
  onSavePromptToDiary,
}: ArticleViewProps) {
  const [article, setArticle] = useState<Article | null>(initialArticle || null)
  const [related, setRelated] = useState<Pick<Article, 'id' | 'title' | 'slug' | 'category' | 'read_time' | 'image_url' | 'cover_image_url' | 'cover_image'>[]>([])
  const [loading, setLoading] = useState(!initialArticle)
  // Teaser público quando o corpo do artigo é bloqueado por plano (paywall).
  const [locked, setLocked] = useState<{ title: string; summary: string | null; excerpt: string | null; category: string | null; plan_required: string; image_url: string | null; read_time: number | null } | null>(null)

  // Interactive state
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackType | null>(null)
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)
  const [showSummary, setShowSummary] = useState(true)

  // ---- Load article ----
  useEffect(() => {
    if (slug) {
      loadArticle(slug)
    } else if (initialArticle) {
      setArticle(initialArticle)
      loadRelated(initialArticle.category, initialArticle.slug)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, initialArticle])

  // ---- Load feedback ----
  useEffect(() => {
    if (!user || !article) return
    supabase
      .from('article_feedback')
      .select('feedback_type')
      .eq('user_id', user.id)
      .eq('article_slug', article.slug)
      .single()
      .then(({ data }) => {
        if (data) {
          setSelectedFeedback(data.feedback_type as FeedbackType)
          setFeedbackDone(true)
        }
      })
  }, [user, article])

  // ---- Marca o artigo como lido (progresso de trilhas + histórico) ----
  useEffect(() => {
    if (user && article?.slug) void markArticleRead(user.id, article.slug)
  }, [user, article?.slug])

  // Analytics: visualização do artigo — dispara para QUALQUER visitante, inclusive
  // deslogado. É este evento que alimenta "Artigos vistos" e a etapa "Leram artigo"
  // do funil no Analytics do admin. entity_id = slug (para agrupar por artigo).
  useEffect(() => {
    if (!article?.slug) return
    trackEvent('article_view', {
      entity_id: article.slug,
      entity_title: article.title,
      user_id: user?.id ?? null,
      metadata: { category: article.category ?? null },
    })
    // Dispara uma vez por artigo aberto; não re-enviar ao logar durante a leitura.
  }, [article?.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  // Analytics: profundidade de leitura (scroll_50 / scroll_75 / scroll_100)
  useEffect(() => {
    const slug = article?.slug
    if (!slug) return
    const fired = new Set<number>()
    function onScroll() {
      const h = document.documentElement.scrollHeight - window.innerHeight
      if (h <= 0) return
      const pct = (window.scrollY / h) * 100
      for (const mk of [50, 75, 100]) {
        if (pct >= mk && !fired.has(mk)) { fired.add(mk); trackEvent('scroll_' + mk, { entity_id: slug, user_id: user?.id ?? null }) }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [article?.slug, user?.id])

  async function loadArticle(s: string) {
    setLoading(true)
    setLocked(null)
    try {
      const { data, error } = await supabase.from('articles').select('*').eq('slug', s).single()
      if (error || !data) {
        setArticle(null)
        // Pode ser conteúdo exclusivo (RLS bloqueou o corpo por plano). Busca o
        // teaser público para mostrar paywall em vez de "não encontrado".
        try {
          const { data: t } = await supabase.rpc('get_article_teaser', { p_slug: s })
          const row = Array.isArray(t) ? t[0] : t
          if (row && row.plan_required && row.plan_required !== 'free') { setLocked(row); return }
        } catch { /* segue para redirect / 404 */ }
        // Redirecionamento configurado no admin (Analytics → Erros)?
        try {
          const path = '/blog/' + s
          const { data: rd } = await supabase.from('analytics_redirects').select('id, to_path, is_active, hits').eq('from_path', path).eq('is_active', true).maybeSingle()
          if (rd?.to_path) {
            void supabase.from('analytics_redirects').update({ hits: (rd.hits ?? 0) + 1 }).eq('id', rd.id)
            const target = rd.to_path.replace(/^\/blog\//, '')
            if (rd.to_path.startsWith('/blog/') && onSelectArticle) { onSelectArticle(target); return }
            if (navigate) { navigate(rd.to_path.replace(/^\//, '') || 'home'); return }
          }
        } catch { /* sem redirect — registra 404 */ }
        trackEvent('error_404', { entity_id: '/blog/' + s })
        return
      }
      setArticle(data)
      if (data.category) await loadRelated(data.category, s)
    } catch {
      setArticle(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadRelated(category: string, currentSlug: string) {
    try {
      const { data } = await supabase
        .from('articles')
        .select('id, title, slug, category, read_time, image_url, cover_image_url, cover_image')
        .eq('category', category)
        .neq('slug', currentSlug)
        .limit(3)
      setRelated(data || [])
    } catch {
      // silencia erro de relacionados — não crítico
    }
  }

  // ---- Feedback ----
  const handleFeedback = useCallback(async (type: FeedbackType) => {
    setSelectedFeedback(type)
    if (!user || !article) return
    setFeedbackSaving(true)
    await supabase.from('article_feedback').upsert(
      {
        user_id: user.id,
        article_slug: article.slug,
        article_id: article.id,
        feedback_type: type,
      },
      { onConflict: 'user_id,article_slug' }
    )
    setFeedbackSaving(false)
    setFeedbackDone(true)
  }, [user, article])

  // ---- Answer in diary with context ----
  function handleAnswerInDiary(prompt: string) {
    if (!article) return
    if (!user) {
      setPendingAction({
        view: 'diary',
        diaryContext: {
          prompt,
          articleTitle: article.title,
          articleSlug: article.slug,
          category: article.category,
        },
      })
      doNavigate('auth')
      return
    }
    if (onSavePromptToDiary) {
      onSavePromptToDiary(prompt, article.title, article.slug, article.category)
    } else {
      doNavigate('diary')
    }
  }

  // ---- Navigate helper ----
  const doNavigate = (v: string, articleSlug?: string) => {
    if (navigate) navigate(v, articleSlug)
    else if (onSelectArticle && articleSlug) onSelectArticle(articleSlug)
    else document.dispatchEvent(new CustomEvent('navigate', { detail: v }))
  }

  // ---- Render content ----
  const getImage = (a: Article) =>
    a.image_url || a.cover_image_url || a.cover_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80'

  // ---- Loading / not found ----
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Paywall: artigo existe e está publicado, mas o corpo é exclusivo do plano.
  if (locked) {
    const planLabel = locked.plan_required === 'plus' ? 'Plus' : 'Essencial'
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <button onClick={onBack} className="text-sm text-ink-soft hover:text-forest-900 mb-6 inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Voltar para conteúdos
        </button>
        <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-mint text-forest-700 mb-4">
            Conteúdo exclusivo do plano {planLabel}
          </span>
          <h1 className="font-serif text-2xl md:text-3xl text-forest-900 leading-tight">{locked.title}</h1>
          {(locked.summary || locked.excerpt) && (
            <p className="text-ink-soft mt-3">{locked.summary || locked.excerpt}</p>
          )}
          <p className="text-sm text-ink-soft mt-5">
            Assine o plano <strong>{planLabel}</strong> para ler este conteúdo completo e acompanhar seus padrões emocionais.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <button data-cta="artigo-ver-planos" onClick={() => (navigate ? navigate('pricing') : onBack())} className="bg-forest-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-forest-800">
              Ver planos
            </button>
            {!user && (
              <button onClick={() => (navigate ? navigate('auth') : onBack())} className="border border-line text-forest-800 px-5 py-2.5 rounded-xl text-sm font-medium hover:border-forest-300">
                Já assino — entrar
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-stone-500">Artigo não encontrado.</p>
        <button onClick={onBack} className="mt-4 text-sage-600 hover:underline">
          Ver todos os artigos
        </button>
      </div>
    )
  }

  const summary = extractSummary(article.content || '', article.title)
  const diaryQuestions = parseDiaryQuestions(article.content || '')

  const formattedDate = article.created_at
    ? new Date(article.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Print header (only shows when printing) */}
      <div className="print-only article-print-header">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-serif text-xl font-bold text-sage-800">A Vida Não Colabora</span>
        </div>
        <h1 className="text-2xl font-bold text-stone-800 mb-1">{article.title}</h1>
        <p className="text-sm text-stone-500">{article.category} · {formattedDate}</p>
      </div>

      {/* Breadcrumb */}
      <nav aria-label="Trilha de navegação" className="mb-4 no-print">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
          <li>
            <button onClick={onBack} className="hover:text-forest-900 transition-colors focus:outline-none focus-visible:underline">
              Conteúdos guiados
            </button>
          </li>
          <li aria-hidden className="text-ink-soft/50">›</li>
          <li className="text-forest-700 font-medium truncate max-w-[60vw]">{article.category}</li>
        </ol>
      </nav>

      {/* Back bar */}
      <div className="flex items-center gap-3 mb-8 no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-ink-soft hover:text-forest-900 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 rounded"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para conteúdos
        </button>
      </div>

      {/* Category + title */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-forest-700 bg-mint px-3 py-1 rounded-full">
          {article.category}
        </span>
      </div>

      <h1 className="font-serif text-3xl md:text-4xl text-sage-800 mb-4 leading-tight">{article.title}</h1>

      {/* Tempo de leitura SEMPRE: usa o valor salvo ou calcula do conteúdo, para
          artigos antigos (sem read_time) também exibirem. */}
      <div className="flex items-center gap-2 text-stone-400 text-sm mb-8 no-print">
        <Clock size={14} /> {article.read_time || estimateReadTime(article.content || '')} min de leitura
      </div>

      {/* A) Quick Summary Card */}
      {showSummary && (
        <div className="no-print mb-8 bg-mint/50 border border-forest-100 rounded-2xl p-5 relative">
          <button
            onClick={() => setShowSummary(false)}
            className="absolute top-3 right-3 text-ink-soft hover:text-forest-700 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 rounded"
          >
            ✕ fechar
          </button>
          <p className="text-xs uppercase tracking-wider text-forest-500 mb-3 font-medium">
            Se você está sem energia para ler tudo agora, aqui está o resumo.
          </p>
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <span className="text-forest-400 font-bold text-sm w-5 flex-shrink-0">📌</span>
              <p className="text-sm text-forest-900"><strong>O que aborda:</strong> {summary.topic}</p>
            </div>
            <div className="flex gap-2">
              <span className="text-forest-400 font-bold text-sm w-5 flex-shrink-0">💡</span>
              <p className="text-sm text-forest-900"><strong>Ideia principal:</strong> {summary.mainIdea}</p>
            </div>
            <div className="flex gap-2">
              <span className="text-forest-400 font-bold text-sm w-5 flex-shrink-0">🌱</span>
              <p className="text-sm text-forest-900"><strong>Ação pequena para hoje:</strong> {summary.smallAction}</p>
            </div>
            <div className="flex gap-2">
              <span className="text-forest-400 font-bold text-sm w-5 flex-shrink-0">📖</span>
              <p className="text-sm text-forest-900"><strong>Pergunta para o diário:</strong> {summary.diaryQuestion}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cover image */}
      <div className="rounded-2xl overflow-hidden mb-8 aspect-video">
        <img
          src={getImage(article)}
          alt={article.image_alt || article.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Article content */}
      <div className="prose prose-sage max-w-none article-content">
        {renderArticleContent(article.content || '')}
      </div>

      {/* B) Diary questions */}
      {diaryQuestions.length > 0 && (
        <div className="mt-12 no-print" data-noprint>
          <h3 className="font-bold text-sage-800 mb-1 text-lg">Perguntas para o diário</h3>
          <p className="text-stone-500 text-sm mb-4">Use estas perguntas para explorar o que esse artigo tocou em você.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {diaryQuestions.map((q, i) => (
              <div key={i} className="bg-stone-50 border border-stone-100 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-sage-700 text-sm leading-relaxed">{q}</p>
                <button
                  onClick={() => handleAnswerInDiary(q)}
                  className="self-start text-xs font-medium text-forest-700 border border-forest-200 bg-mint/40 px-3 py-1.5 rounded-full hover:bg-mint transition-colors flex items-center gap-1"
                >
                  <NotebookPen size={12} />
                  {user ? 'Responder no diário' : 'Entrar para responder'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* C) Emotional thermometer */}
      <div className="mt-10 no-print article-feedback" data-noprint>
        <h3 className="font-bold text-sage-800 mb-1">Como esse artigo encontrou você hoje?</h3>
        {feedbackDone ? (
          <p className="text-sage-500 text-sm mt-2">
            Sua resposta foi registrada. Que bom ter você aqui. 💚
          </p>
        ) : (
          <>
            <p className="text-stone-500 text-sm mb-4">Escolha o que mais combina com o que você está sentindo agora.</p>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => handleFeedback(opt.type)}
                  disabled={feedbackSaving}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm border transition-all ${
                    selectedFeedback === opt.type
                      ? 'bg-sage-600 text-white border-sage-600'
                      : 'bg-white border-stone-200 text-sage-700 hover:border-sage-400'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
            {!user && (
              <p className="text-xs text-stone-400 mt-2">
                Faça login para salvar sua resposta.
              </p>
            )}
          </>
        )}
      </div>

      {/* CTA final — logado registra no diário; visitante sem conta recebe o
          convite de cadastro gratuito (aquisição). */}
      {user ? (
        <div className="mt-10 bg-mint/40 rounded-2xl p-6 border border-mint article-cta-buttons" data-noprint>
          <h3 className="font-bold text-stone-800 mb-2">Quer explorar isso mais de perto?</h3>
          <p className="text-stone-600 text-sm mb-4">
            Use o diário para registrar o que você está sentindo agora.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => doNavigate('diary')}
              className="bg-forest-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-forest-700 flex items-center gap-2"
            >
              <NotebookPen size={15} /> Registrar como estou hoje
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-10 bg-mint/40 rounded-2xl p-6 border border-mint article-cta-buttons" data-noprint>
          {article?.cta_mode === 'custom' && (article.cta_custom_title || article.cta_custom_text) ? (
            <>
              <h3 className="font-bold text-stone-800 mb-2">{article.cta_custom_title || 'Quer transformar essa reflexão em um registro pessoal?'}</h3>
              {article.cta_custom_text && <p className="text-stone-600 text-sm mb-4">{article.cta_custom_text}</p>}
            </>
          ) : (
            <>
              <h3 className="font-bold text-stone-800 mb-2">Quer transformar essa reflexão em um registro pessoal?</h3>
              <p className="text-stone-600 text-sm mb-2">
                Faça um check-in emocional gratuito. No <strong>A Vida Não Colabora</strong>, você acompanha seus padrões emocionais com diário, check-ins e mapa emocional.
              </p>
              <p className="text-stone-600 text-sm mb-4">
                Crie sua conta gratuita para salvar seus registros e acompanhar sua evolução emocional.
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              data-cta="artigo-criar-conta"
              onClick={() => { setPendingAction({ view: 'diary' }); doNavigate('auth') }}
              className="bg-forest-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-forest-700 flex items-center gap-2"
            >
              <NotebookPen size={15} /> Criar conta gratuita
            </button>
            <button
              data-cta="artigo-entrar"
              onClick={() => doNavigate('auth')}
              className="border border-line text-forest-800 px-5 py-2.5 rounded-lg text-sm font-medium hover:border-forest-300"
            >
              Já tenho conta — entrar
            </button>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-4 no-print">
        <p className="text-amber-800 text-sm">
          <strong>Importante:</strong> Estes conteúdos são informativos e educativos. Não substituem acompanhamento profissional de saúde mental. Se você está passando por dificuldades severas, procure um psicólogo ou profissional de saúde.
        </p>
      </div>

      {/* Print disclaimer (only shows when printing) */}
      <div className="print-only article-print-disclaimer">
        <p>
          Este conteúdo é de caráter informativo e educativo. Não substitui acompanhamento
          profissional de saúde mental. Se você está passando por dificuldades severas, procure
          um psicólogo ou profissional de saúde. Fonte: avidanaocolabora.com
        </p>
      </div>

      {/* F) Related articles */}
      {related.length > 0 && (
        <div className="mt-12 no-print">
          <h3 className="text-lg font-bold text-sage-800 mb-4">Conteúdos relacionados</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map(rel => (
              <button
                key={rel.id}
                onClick={() => {
                  if (onSelectArticle) onSelectArticle(rel.slug)
                  else doNavigate('article', rel.slug)
                }}
                className="text-left bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-video bg-stone-100 overflow-hidden">
                  <img
                    src={rel.image_url || rel.cover_image_url || rel.cover_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60'}
                    alt={rel.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <span className="text-xs text-sage-600">{rel.category}</span>
                  <p className="font-medium text-sage-700 text-sm mt-1 line-clamp-2">{rel.title}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
