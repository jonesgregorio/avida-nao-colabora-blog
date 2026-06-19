import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAnalytics } from '../hooks/useAnalytics'
import { ChevronRight, ArrowLeft, RotateCcw, BookOpen, Star, RefreshCw, X } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

interface QFull {
  id: string
  title: string
  short_description: string
  intro_message: string
  final_message: string
  disclaimer: string
  start_button_text: string
  final_button_text: string
  default_result_text: string
  plan_required: string
  estimated_time: string
  icon: string
  category: string
}

interface QQuestion {
  id: string
  question_text: string
  helper_text: string
  question_type: string
  is_required: boolean
  order_index: number
  weight: number
  placeholder: string
  character_limit: number
  options?: QOption[]
}

interface QOption {
  id: string
  option_text: string
  score: number
  tag: string
  order_index: number
}

interface QResult {
  id: string
  title: string
  message: string
  description: string
  min_score: number
  max_score: number
  related_tags: string
  disclaimer: string
}

type Phase = 'loading' | 'intro' | 'playing' | 'result' | 'error'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  questionnaireId: string
  user: any
  profile: any
  onBack: () => void
  onNavigateDiary?: () => void
  onNavigatePricing?: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function QuestionnairePlayer({
  questionnaireId, user, profile, onBack, onNavigateDiary, onNavigatePricing,
}: Props) {
  const { track } = useAnalytics(user?.id)
  const [phase, setPhase] = useState<Phase>('loading')
  const [questionnaire, setQuestionnaire] = useState<QFull | null>(null)
  const [questions, setQuestions] = useState<QQuestion[]>([])
  const [results, setResults] = useState<QResult[]>([])
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, { value: string | string[]; score: number; tags: string[] }>>({})
  const [matchedResult, setMatchedResult] = useState<QResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: q, error: qErr } = await supabase
        .from('questionnaires')
        .select('*')
        .eq('id', questionnaireId)
        .single()

      if (qErr || !q) { setError('Questionário não encontrado.'); setPhase('error'); return }
      setQuestionnaire(q)
      track('questionnaire_start', { entity_id: q.id, entity_title: q.title })

      const { data: qs } = await supabase
        .from('questionnaire_questions')
        .select('*')
        .eq('questionnaire_id', questionnaireId)
        .order('order_index')

      if (qs && qs.length > 0) {
        const withOpts = await Promise.all(qs.map(async (qq: any) => {
          if (['single_choice', 'multiple_choice', 'yes_no', 'emotion_select'].includes(qq.question_type)) {
            const { data: opts } = await supabase
              .from('questionnaire_options')
              .select('*')
              .eq('question_id', qq.id)
              .order('order_index')
            return { ...qq, options: opts || [] }
          }
          return qq
        }))
        setQuestions(withOpts)
      }

      const { data: rs } = await supabase
        .from('questionnaire_results')
        .select('*')
        .eq('questionnaire_id', questionnaireId)
        .order('min_score')
      setResults(rs || [])

      setPhase('intro')
    }
    load()
  }, [questionnaireId])

  // ── Compute result ─────────────────────────────────────────────────────────
  function computeResult() {
    const totalScore = Object.values(answers).reduce((sum, a) => sum + (a.score || 0), 0)
    const allTags = Object.values(answers).flatMap(a => a.tags || [])

    // Find matching result by score range
    const match = results.find(r => totalScore >= r.min_score && totalScore <= r.max_score)
    if (match) { setMatchedResult(match); return { totalScore, allTags, resultId: match.id } }

    // Try matching by tags
    if (allTags.length > 0 && results.length > 0) {
      const tagMatch = results.find(r =>
        r.related_tags && allTags.some(tag => r.related_tags.toLowerCase().includes(tag.toLowerCase()))
      )
      if (tagMatch) { setMatchedResult(tagMatch); return { totalScore, allTags, resultId: tagMatch.id } }
    }

    setMatchedResult(null)
    return { totalScore, allTags, resultId: null }
  }

  // ── Save response ──────────────────────────────────────────────────────────
  async function saveResponse() {
    if (!user || saving || saved) return
    setSaving(true)
    const { totalScore, allTags, resultId } = computeResult()

    try {
      const { data: response } = await supabase
        .from('questionnaire_responses')
        .insert({
          questionnaire_id: questionnaireId,
          user_id: user.id,
          status: 'completed',
          total_score: totalScore,
          generated_tags: allTags.join(','),
          result_id: resultId,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (response) {
        for (const [questionId, ans] of Object.entries(answers)) {
          await supabase.from('questionnaire_answers').insert({
            response_id: response.id,
            question_id: questionId,
            answer_value: Array.isArray(ans.value) ? ans.value.join(',') : ans.value,
            answer_text: Array.isArray(ans.value) ? ans.value.join(', ') : ans.value,
            selected_options: Array.isArray(ans.value) ? JSON.stringify(ans.value) : null,
            score: ans.score,
            generated_tags: ans.tags.join(','),
          }).catch(() => {})
        }
        setSaved(true)
      }
    } catch (_) {}
    setSaving(false)
  }

  // ── Answer handlers ────────────────────────────────────────────────────────
  function answerSingle(option: QOption) {
    setAnswers(a => ({
      ...a,
      [currentQ.id]: { value: option.option_text, score: option.score || 0, tags: option.tag ? [option.tag] : [] },
    }))
    setTimeout(() => advance(), 300)
  }

  function answerScale(val: number) {
    setAnswers(a => ({
      ...a,
      [currentQ.id]: { value: String(val), score: val, tags: [] },
    }))
    setTimeout(() => advance(), 300)
  }

  function answerText(val: string) {
    setAnswers(a => ({ ...a, [currentQ.id]: { value: val, score: 0, tags: [] } }))
  }

  function advance() {
    if (step < questions.length - 1) {
      setStep(s => s + 1)
    } else {
      const { totalScore } = computeResult()
      void totalScore
      setPhase('result')
      if (questionnaire) track('questionnaire_complete', { entity_id: questionnaire.id, entity_title: questionnaire.title })
      if (user) saveResponse()
    }
  }

  // ── Current question ───────────────────────────────────────────────────────
  const currentQ = questions[step]
  const progress = questions.length > 0 ? Math.round((step / questions.length) * 100) : 0
  const currentAnswer = currentQ ? answers[currentQ.id] : null

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-stone-400">
        <p className="mb-4">{error}</p>
        <button onClick={onBack} className="text-sm text-stone-600 hover:underline">← Voltar</button>
      </div>
    )
  }

  if (!questionnaire) return null

  // ── INTRO ─────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <section className="max-w-2xl mx-auto px-4 py-12">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-400 hover:text-stone-700 text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            {questionnaire.icon || '📋'}
          </div>
          <h1 className="font-serif text-2xl text-stone-800 mb-2">{questionnaire.title}</h1>
          <p className="text-stone-500 text-sm mb-5 max-w-sm mx-auto">{questionnaire.short_description}</p>

          {questionnaire.intro_message && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-stone-700 text-left mb-5">
              {questionnaire.intro_message}
            </div>
          )}

          <div className="flex items-center justify-center gap-6 text-xs text-stone-400 mb-6">
            {questionnaire.estimated_time && <span>⏱ {questionnaire.estimated_time}</span>}
            {questions.length > 0 && <span>📋 {questions.length} perguntas</span>}
          </div>

          <button
            onClick={() => { setStep(0); setPhase('playing') }}
            className="w-full bg-stone-800 text-white py-3 rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            {questionnaire.start_button_text || 'Começar'}
          </button>

          <p className="text-xs text-stone-400 mt-4">{questionnaire.disclaimer}</p>
        </div>
      </section>
    )
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────
  if (phase === 'playing' && currentQ) {
    const yesNoOptions: QOption[] = [
      { id: 'yes', option_text: 'Sim', score: 1, tag: '', order_index: 0 },
      { id: 'no',  option_text: 'Não', score: 0, tag: '', order_index: 1 },
    ]

    return (
      <section className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="flex justify-between text-xs text-stone-400 mb-2">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : setPhase('intro')} className="text-stone-400 hover:text-stone-700 flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Voltar
          </button>
          <span>Pergunta {step + 1} de {questions.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-stone-200 rounded-full mb-6">
          <div className="h-full bg-purple-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
          <p className="font-medium text-stone-800 text-base leading-relaxed mb-1">
            {currentQ.question_text}
          </p>
          {currentQ.helper_text && (
            <p className="text-xs text-stone-400 mb-5">{currentQ.helper_text}</p>
          )}
          {!currentQ.helper_text && <div className="mb-5" />}

          {/* Single choice / Emotion select */}
          {(currentQ.question_type === 'single_choice' || currentQ.question_type === 'emotion_select') && (
            <div className="space-y-2">
              {(currentQ.options || []).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => answerSingle(opt)}
                  className={`w-full text-left flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm transition-all group ${currentAnswer?.value === opt.option_text ? 'border-purple-400 bg-purple-50 text-purple-800' : 'border-stone-200 hover:border-purple-300 hover:bg-purple-50 text-stone-700'}`}
                >
                  <span>{opt.option_text}</span>
                  <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-purple-400 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Yes / No */}
          {currentQ.question_type === 'yes_no' && (
            <div className="grid grid-cols-2 gap-3">
              {yesNoOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => answerSingle(opt)}
                  className={`py-4 rounded-xl border text-sm font-medium transition-all ${currentAnswer?.value === opt.option_text ? 'border-purple-400 bg-purple-500 text-white' : 'border-stone-200 text-stone-700 hover:border-purple-300 hover:bg-purple-50'}`}
                >
                  {opt.option_text}
                </button>
              ))}
            </div>
          )}

          {/* Multiple choice */}
          {currentQ.question_type === 'multiple_choice' && (
            <div>
              <div className="space-y-2 mb-4">
                {(currentQ.options || []).map(opt => {
                  const sel = Array.isArray(currentAnswer?.value) && (currentAnswer.value as string[]).includes(opt.option_text)
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        const prev = (Array.isArray(currentAnswer?.value) ? currentAnswer!.value : []) as string[]
                        const next = sel ? prev.filter(v => v !== opt.option_text) : [...prev, opt.option_text]
                        const nextScore = (currentQ.options || []).filter(o => next.includes(o.option_text)).reduce((s, o) => s + (o.score || 0), 0)
                        const nextTags = (currentQ.options || []).filter(o => next.includes(o.option_text)).flatMap(o => o.tag ? [o.tag] : [])
                        setAnswers(a => ({ ...a, [currentQ.id]: { value: next, score: nextScore, tags: nextTags } }))
                      }}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all ${sel ? 'border-purple-400 bg-purple-50 text-purple-800' : 'border-stone-200 text-stone-700 hover:border-purple-200'}`}
                    >
                      <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${sel ? 'bg-purple-500 border-purple-500' : 'border-stone-300'}`}>
                        {sel && <span className="text-white text-xs">✓</span>}
                      </span>
                      {opt.option_text}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={advance}
                disabled={!currentAnswer}
                className="w-full bg-stone-800 text-white py-3 rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-40"
              >
                Continuar
              </button>
            </div>
          )}

          {/* Scale 1-5 */}
          {currentQ.question_type === 'scale_5' && (
            <div>
              <div className="flex justify-center gap-3 mb-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => answerScale(n)}
                    className={`w-12 h-12 rounded-full border-2 text-sm font-semibold transition-all ${currentAnswer?.value === String(n) ? 'bg-purple-500 border-purple-500 text-white scale-110' : 'border-stone-200 text-stone-600 hover:border-purple-300 hover:bg-purple-50'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-stone-400 px-1">
                <span>Pouco</span><span>Muito</span>
              </div>
            </div>
          )}

          {/* Scale 1-10 */}
          {currentQ.question_type === 'scale_10' && (
            <div>
              <div className="flex flex-wrap justify-center gap-2 mb-2">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    onClick={() => answerScale(n)}
                    className={`w-10 h-10 rounded-full border-2 text-xs font-semibold transition-all ${currentAnswer?.value === String(n) ? 'bg-purple-500 border-purple-500 text-white' : 'border-stone-200 text-stone-600 hover:border-purple-300'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-stone-400 px-1">
                <span>1 — Nada</span><span>10 — Muito</span>
              </div>
            </div>
          )}

          {/* Text short */}
          {currentQ.question_type === 'text_short' && (
            <div>
              <input
                value={(currentAnswer?.value as string) || ''}
                onChange={e => answerText(e.target.value)}
                placeholder={currentQ.placeholder || 'Escreva aqui...'}
                maxLength={currentQ.character_limit > 0 ? currentQ.character_limit : undefined}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 mb-3"
              />
              <button onClick={advance} className="w-full bg-stone-800 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-stone-700">
                Continuar
              </button>
            </div>
          )}

          {/* Text long */}
          {currentQ.question_type === 'text_long' && (
            <div>
              <textarea
                value={(currentAnswer?.value as string) || ''}
                onChange={e => answerText(e.target.value)}
                placeholder={currentQ.placeholder || 'Escreva aqui...'}
                rows={4}
                maxLength={currentQ.character_limit > 0 ? currentQ.character_limit : undefined}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 mb-3 resize-none"
              />
              <button onClick={advance} className="w-full bg-stone-800 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-stone-700">
                Continuar
              </button>
            </div>
          )}

          {/* Info (no answer) */}
          {currentQ.question_type === 'info' && (
            <button onClick={advance} className="w-full bg-stone-800 text-white py-3 rounded-xl text-sm font-medium hover:bg-stone-700">
              Continuar
            </button>
          )}
        </div>
      </section>
    )
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const resultText = matchedResult?.message || questionnaire.default_result_text || 'Obrigado(a) por compartilhar como você está.'
    const resultTitle = matchedResult?.title || 'Obrigado(a) por compartilhar'
    const disclaimer = matchedResult?.disclaimer || questionnaire.disclaimer

    return (
      <section className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-6 h-6 text-purple-500" />
            </div>
            <h2 className="font-serif text-2xl text-stone-800 mb-1">{resultTitle}</h2>
            <p className="text-sm text-stone-400">Com base nas suas respostas:</p>
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-xl p-5 mb-4">
            <p className="text-stone-700 leading-relaxed text-sm">{resultText}</p>
          </div>

          {matchedResult?.description && (
            <p className="text-sm text-stone-600 mb-4 leading-relaxed">{matchedResult.description}</p>
          )}

          {questionnaire.final_message && (
            <p className="text-sm text-stone-500 mb-5 leading-relaxed text-center">{questionnaire.final_message}</p>
          )}

          <p className="text-xs text-stone-400 text-center mb-6 leading-relaxed">{disclaimer}</p>

          {user && !saved && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-center text-xs text-emerald-700">
              {saving ? 'Salvando suas respostas...' : 'Respostas salvas no seu perfil ✓'}
            </div>
          )}
          {!user && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 mb-4 text-center text-xs text-stone-500">
              Crie uma conta para salvar suas respostas e acompanhar sua evolução.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {onNavigateDiary && user && (
              <button
                onClick={onNavigateDiary}
                className="flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors"
              >
                <BookOpen className="w-4 h-4" /> Registrar no diário
              </button>
            )}
            {onNavigatePricing && (
              <button
                onClick={onNavigatePricing}
                className="flex items-center justify-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
              >
                Ver planos
              </button>
            )}
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => { setAnswers({}); setStep(0); setPhase('intro'); setSaved(false) }}
              className="flex items-center gap-2 text-stone-400 hover:text-stone-600 text-sm"
            >
                        <RefreshCw className="w-3.5 h-3.5" /> Refazer
            </button>
            {onClose && (
              <button onClick={onClose} className="flex items-center gap-2 text-stone-400 hover:text-stone-600 text-sm">
                <X className="w-3.5 h-3.5" /> Fechar
              </button>
            )}
          </div>
        </div>
      </section>
    )
  }

  return null
}
