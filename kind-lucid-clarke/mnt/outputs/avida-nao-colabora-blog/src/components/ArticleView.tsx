import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Clock, Bookmark, BookmarkCheck, NotebookPen, Printer, Heart, Brain, CloudRain, Clock3, Feather } from 'lucide-react'
import type { Article, View, Plan } from '../types'
import { UpgradeModal } from './UpgradeModal'

interface ArticleViewProps {
  slug?: string
  article?: Article
  onBack: () => void
  user: any
  profile?: { plan: Plan } | null
  navigate?: (v: string, slug?: string) => void
  onSelectArticle?: (slug: string) => void
  onSavePromptToDiary?: (prompt: string, articleTitle: string, articleSlug: string, category: string) => void
  // Legacy compat: some callers pass navigate as separate prop
}

// --- Quick summary extracted from article content ---
function extractSummary(content: string, title: string) {
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

type FeedbackType = 'helped' | 'made_me_think' | 'felt_heavy' | 'save_for_later' | 'want_lighter_content'

const FEEDBACK_OPTIONS: { type: FeedbackType; label: string; icon: React.ReactNode }[] = [
  { type: 'helped', label: 'me ajudou', icon: <Heart size={16} /> },
  { type: 'made_me_think', label: 'me fez pensar', icon: <Brain size={16} /> },
  { type: 'felt_heavy', label: 'foi pesado', icon: <CloudRain size={16} /> },
  { type: 'save_for_later', label: 'salvar para depois', icon: <Clock3 size={16} /> },
  { type: 'want_lighter_content', label: 'quero algo mais leve', icon: <Feather size={16} /> },
]

export default function ArticleView({
  slug,
  article: initialArticle,
  onBack,
  user,
  profile,
  navigate,
  onSelectArticle,
  onSavePromptToDiary,
}: ArticleViewProps) {
  const [article, setArticle] = useState<Article | null>(initialArticle || null)
  const [related, setRelated] = useState<Pick<Article, 'id' | 'title' | 'slug' | 'category' | 'read_time' | 'image_url' | 'cover_image'>[]>([])
  const [loading, setLoading] = useState(!initialArticle)

  // Interactive state
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackType | null>(null)
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; feature: string }>({ open: false, feature: '' })
  const [showSummary, setShowSummary] = useState(true)

  const plan: Plan = profile?.plan || 'free'
  const isPremium = plan !== 'free'

  // ---- Load article ----
  useEffect(() => {
    if (slug) {
      loadArticle(slug)
    } else if (initialArticle) {
      setArticle(initialArticle)
      loadRelated(initialArticle.category, initialArticle.slug)
    }
  }, [slug, initialArticle])

  // ---- Load saved status ----
  useEffect(() => {
    if (!user || !article) return
    supabase
      .from('saved_items')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('item_type', 'article')
      .eq('item_id', article.slug)
      .then(({ data }) => {
        if (data && data.length > 0) setSaved(true)
      })
    // Count total saved
    supabase
      .from('saved_items')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .then(({ count }) => setSavedCount(count || 0))
  }, [user, article])

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

  async function loadArticle(s: string) {
    setLoading(true)
    const { data } = await supabase.from('articles').select('*').eq('slug', s).single()
    setArticle(data)
    if (data?.category) await loadRelated(data.category, s)
    setLoading(false)
  }

  async function loadRelated(category: string, currentSlug: string) {
    const { data } = await supabase
      .from('articles')
      .select('id, title, slug, category, read_time, image_url, cover_image')
      .eq('category', category)
      .neq('slug', currentSlug)
      .limit(3)
    setRelated(data || [])
  }

  // ---- Save to Caixa de Cuidado ----
  const handleSave = useCallback(async () => {
    if (!article) return
    if (!user) {
      doNavigate('auth')
      return
    }
    if (saved) {
      // Remove
      await supabase
        .from('saved_items')
        .delete()
        .eq('user_id', user.id)
        .eq('item_type', 'article')
        .eq('item_id', article.slug)
      setSaved(false)
      setSavedCount(c => c - 1)
      return
    }
    // Check quota for free plan
    if (!isPremium && savedCount >= 3) {
      setUpgradeModal({ open: true, feature: 'Caixa de Cuidado ilimitada' })
      return
    }
    const { error } = await supabase.from('saved_items').insert({
      user_id: user.id,
      item_type: 'article',
      item_id: article.slug,
      title: article.title,
      category: article.category,
    })
    if (!error) {
      setSaved(true)
      setSavedCount(c => c + 1)
    }
  }, [article, user, saved, isPremium, savedCount])

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
      sessionStorage.setItem('pendingDiaryPrompt', JSON.stringify({
        prompt,
        articleTitle: article.title,
        articleSlug: article.slug,
        category: article.category,
      }))
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
  function renderContent(content: string) {
    if (!content) return null
    return content.split('\n').map((line, i) => {
      if (line.startsWith('## '))
        return <h2 key={i} className="font-serif text-2xl text-sage-800 mt-8 mb-3">{line.replace('## ', '')}</h2>
      if (line.startsWith('### '))
        return <h3 key={i} className="text-lg font-semibold text-sage-700 mt-6 mb-2">{line.replace('### ', '')}</h3>
      if (line.startsWith('**') && line.endsWith('**'))
        return <p key={i} className="font-semibold text-sage-800 mt-4 mb-1">{line.slice(2, -2)}</p>
      if (line.startsWith('- '))
        return <li key={i} className="text-sage-600 ml-4 list-disc">{line.replace('- ', '')}</li>
      if (line.startsWith('> '))
        return <blockquote key={i} className="border-l-4 border-sage-300 pl-4 italic text-sage-600 my-4">{line.replace('> ', '')}</blockquote>
      if (line.trim() === '') return <br key={i} />
      return <p key={i} className="text-sage-600 leading-relaxed mb-3">{line}</p>
    })
  }

  const getImage = (a: Article) =>
    a.image_url || a.cover_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80'

  // ---- Loading / not found ----
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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

      {/* Back + actions bar */}
      <div className="flex items-center justify-between mb-8 no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sage-500 hover:text-sage-700 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o blog
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            title={saved ? 'Remover da Caixa de Cuidado' : 'Salvar na Caixa de Cuidado'}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-all ${
              saved
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'border-stone-200 text-stone-500 hover:border-emerald-300 hover:text-emerald-600'
            }`}
          >
            {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            {saved ? 'Salvo' : 'Salvar'}
          </button>
          <button
            onClick={() => window.print()}
            title="Imprimir / exportar PDF"
            className="no-print flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-stone-200 text-stone-500 hover:border-sage-300 hover:text-sage-600 transition-all"
          >
            <Printer size={15} /> PDF
          </button>
        </div>
      </div>

      {/* Category + title */}
      <div className="mb-4">
        <span className="text-sm font-medium text-sage-600 bg-sage-50 px-3 py-1 rounded-full">
          {article.category}
        </span>
      </div>

      <h1 className="font-serif text-3xl md:text-4xl text-sage-800 mb-4 leading-tight">{article.title}</h1>

      {article.read_time && (
        <div className="flex items-center gap-2 text-stone-400 text-sm mb-8 no-print">
          <Clock size={14} /> {article.read_time} min de leitura
        </div>
      )}

      {/* A) Quick Summary Card */}
      {showSummary && (
        <div className="no-print mb-8 bg-purple-50 border border-purple-100 rounded-2xl p-5 relative">
          <button
            onClick={() => setShowSummary(false)}
            className="absolute top-3 right-3 text-purple-300 hover:text-purple-500 text-xs"
          >
            ✕ fechar
          </button>
          <p className="text-xs uppercase tracking-wider text-purple-400 mb-3 font-medium">
            Se você está sem energia para ler tudo agora, aqui está o resumo.
          </p>
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <span className="text-purple-400 font-bold text-sm w-5 flex-shrink-0">📌</span>
              <p className="text-sm text-purple-800"><strong>O que aborda:</strong> {summary.topic}</p>
            </div>
            <div className="flex gap-2">
              <span className="text-purple-400 font-bold text-sm w-5 flex-shrink-0">💡</span>
              <p className="text-sm text-purple-800"><strong>Ideia principal:</strong> {summary.mainIdea}</p>
            </div>
            <div className="flex gap-2">
              <span className="text-purple-400 font-bold text-sm w-5 flex-shrink-0">🌱</span>
              <p className="text-sm text-purple-800"><strong>Ação pequena para hoje:</strong> {summary.smallAction}</p>
            </div>
            <div className="flex gap-2">
              <span className="text-purple-400 font-bold text-sm w-5 flex-shrink-0">📖</span>
              <p className="text-sm text-purple-800"><strong>Pergunta para o diário:</strong> {summary.diaryQuestion}</p>
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
        {renderContent(article.content || '')}
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
                  className="self-start text-xs font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors flex items-center gap-1"
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
            Obrigado por compartilhar. Sua resposta foi registrada. 💚
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

      {/* CTA buttons */}
      <div className="mt-10 bg-emerald-50 rounded-2xl p-6 border border-emerald-100 article-cta-buttons" data-noprint>
        <h3 className="font-bold text-stone-800 mb-2">Quer explorar isso mais de perto?</h3>
        <p className="text-stone-600 text-sm mb-4">
          Use o diário para registrar o que você está sentindo agora.
        </p>
        <div className="flex flex-wrap gap-3">
          {/* E) Register how I'm feeling */}
          <button
            onClick={() => doNavigate(user ? 'diary' : 'auth')}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"
          >
            <NotebookPen size={15} /> Registrar como estou hoje
          </button>
          {/* D) Save to Caixa de Cuidado */}
          <button
            onClick={handleSave}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium border flex items-center gap-2 transition-all ${
              saved
                ? 'bg-white border-emerald-300 text-emerald-700'
                : 'bg-white border-stone-200 text-stone-600 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            {saved ? 'Salvo na Caixa de Cuidado' : 'Salvar na Caixa de Cuidado'}
          </button>
        </div>
        {!isPremium && savedCount >= 3 && !saved && (
          <p className="text-xs text-amber-600 mt-2">
            Você atingiu o limite de 3 itens salvos no plano gratuito.{' '}
            <button onClick={() => setUpgradeModal({ open: true, feature: 'Caixa de Cuidado ilimitada' })} className="underline">
              Fazer upgrade
            </button>
          </p>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-4 no-print">
        <p className="text-amber-800 text-sm">
          <strong>Importante:</strong> Os conteúdos deste blog são informativos e educativos. Não substituem acompanhamento profissional de saúde mental. Se você está passando por dificuldades severas, procure um psicólogo ou profissional de saúde.
        </p>
      </div>

      {/* Print disclaimer (only shows when printing) */}
      <div className="print-only article-print-disclaimer">
        <p>
          Este conteúdo é de caráter informativo e educativo. Não substitui acompanhamento
          profissional de saúde mental. Se você está passando por dificuldades severas, procure
          um psicólogo ou profissional de saúde. Fonte: avidanaocolabora.com.br
        </p>
      </div>

      {/* F) Related articles */}
      {related.length > 0 && (
        <div className="mt-12 no-print">
          <h3 className="text-lg font-bold text-sage-800 mb-4">Artigos relacionados</h3>
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
                    src={rel.image_url || rel.cover_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60'}
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

      {/* G) Upgrade modal */}
      {upgradeModal.open && (
        <UpgradeModal
          isOpen={upgradeModal.open}
          featureName={upgradeModal.feature}
          requiredPlan="essential"
          onClose={() => setUpgradeModal({ open: false, feature: '' })}
          navigate={(v) => doNavigate(v)}
        />
      )}
    </div>
  )
}
