import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizePlan } from '../lib/officialPlans'
import { useAnalytics } from '../hooks/useAnalytics'
import { ChevronRight, ArrowLeft, BookOpen, Star, RefreshCw, X } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

interface QFull {
  id: string
  title: string
  // campos salvos pelo admin — mapeados abaixo para compatibilidade
  description: string        // admin salva como "description"
  short_description?: string // fallback
  intro_text?: string        // admin salva como "intro_text"
  intro_message?: string     // fallback
  completion_text?: string   // admin salva como "completion_text"
  final_message?: string     // fallback
  disclaimer?: string
  start_button_text?: string
  final_button_text?: string
  default_result_text?: string
  plan_required: string
  estimated_time: string | number
  cover_image?: string
  icon?: string
  category: string
  questions?: AdminQQuestion[]
  results?: AdminQResult[]
}

// Formato salvo pelo admin no JSONB
interface AdminQQuestion {
  id: string
  type: string   // admin usa "type", player usava "question_type"
  text: string   // admin usa "text", player usava "question_text"
  subtitle?: string
  required: boolean
  options: { id: string; text: string; score: number; tag?: string }[]
  min_label?: string
  max_label?: string
}

interface AdminQResult {
  id: string
  min_score: number
  max_score: number
  label: string         // admin usa "label", player usava "title"
  description: string
  recommendation: string
  color: string
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any
  onBack: () => void
  onNavigateDiary?: () => void
  onNavigatePricing?: () => void
  onNavigateArticles?: () => void
  onNavigate?: (v: string) => void
}

// Normaliza o tipo de pergunta para o formato que o player renderiza.
// Aceita 'single' como alias de 'single_choice' (§12.4) e cobre outras variações.
const QTYPE_ALIASES: Record<string, string> = {
  single: 'single_choice',
  choice: 'single_choice',
  radio: 'single_choice',
  multi: 'multiple_choice',
  multiple: 'multiple_choice',
  checkbox: 'multiple_choice',
  boolean: 'yes_no',
  bool: 'yes_no',
  emotion: 'emotion_select',
  scale: 'scale_5',
  scale5: 'scale_5',
  scale10: 'scale_10',
  text: 'text_short',
  short_text: 'text_short',
  long_text: 'text_long',
  textarea: 'text_long',
  info_text: 'info',
}
const SUPPORTED_QTYPES = new Set([
  'single_choice', 'multiple_choice', 'yes_no', 'emotion_select',
  'scale_5', 'scale_10', 'text_short', 'text_long', 'info',
])
function normalizeQType(t: string | undefined): string {
  const raw = String(t ?? 'single_choice').trim()
  const mapped = QTYPE_ALIASES[raw] ?? raw
  return SUPPORTED_QTYPES.has(mapped) ? mapped : 'single_choice'
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function QuestionnairePlayer({
  questionnaireId, user, profile: _profile, onBack, onNavigateDiary, onNavigatePricing, onNavigateArticles, onNavigate,
}: Props) {
  const { track } = useAnalytics(user?.id)
  const [phase, setPhase] = useState<Phase>('loading')
  const [questionnaire, setQuestionnaire] = useState<QFull | null>(null)
  const [questions, setQuestions] = useState<QQuestion[]>([])
  const [results, setResults] = useState<QResult[]>([])
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, { value: string | string[]; score: number; tags: string[] }>>({})
  // Espelho síncrono de answers — evita salvar sem a última resposta (setTimeout).
  const answersRef = useRef(answers)
  useEffect(() => { answersRef.current = answers }, [answers])
  const [matchedResult, setMatchedResult] = useState<QResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  // Progresso parcial (§12.5): id da resposta in_progress e estado do "Salvar e sair".
  const [responseId, setResponseId] = useState<string | null>(null)
  const [exiting, setExiting] = useState(false)
  const [resumed, setResumed] = useState(false)

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

      // Admin salva perguntas como JSONB inline em q.questions.
      // Mapeamos para o formato interno do player.
      const adminQuestions: AdminQQuestion[] = Array.isArray(q.questions) ? q.questions : []
      if (adminQuestions.length > 0) {
        const mapped: QQuestion[] = adminQuestions.map((aq, idx) => ({
          id: aq.id || String(idx),
          question_text: aq.text,
          helper_text: aq.subtitle || '',
          question_type: normalizeQType(aq.type),
          is_required: aq.required ?? true,
          order_index: idx,
          weight: 1,
          placeholder: '',
          character_limit: 0,
          options: (aq.options || []).map((o, oi) => ({
            id: o.id || String(oi),
            option_text: o.text,
            score: o.score || 0,
            tag: o.tag || '',
            order_index: oi,
          })),
        }))
        setQuestions(mapped)
      } else {
        // Fallback: tenta buscar das tabelas separadas (legado)
        const { data: qs } = await supabase
          .from('questionnaire_questions')
          .select('*')
          .eq('questionnaire_id', questionnaireId)
          .order('order_index')

        if (qs && qs.length > 0) {
          const withOpts = await Promise.all(qs.map(async (qq: Record<string, unknown>) => {
            if (['single_choice', 'multiple_choice', 'yes_no', 'emotion_select'].includes(qq.question_type as string)) {
              const { data: opts } = await supabase
                .from('questionnaire_options')
                .select('*')
                .eq('question_id', qq.id)
                .order('order_index')
              return { ...qq, options: opts || [] }
            }
            return qq
          }))
          setQuestions(withOpts as unknown as QQuestion[])
        }
      }

      // Admin salva resultados como JSONB inline em q.results.
      const adminResults: AdminQResult[] = Array.isArray(q.results) ? q.results : []
      if (adminResults.length > 0) {
        const mapped: QResult[] = adminResults.map(ar => ({
          id: ar.id,
          title: ar.label,
          message: ar.description,
          description: ar.recommendation || '',
          min_score: ar.min_score,
          max_score: ar.max_score,
          related_tags: '',
          disclaimer: '',
        }))
        setResults(mapped)
      } else {
        // Fallback: tabelas separadas
        const { data: rs } = await supabase
          .from('questionnaire_results')
          .select('*')
          .eq('questionnaire_id', questionnaireId)
          .order('min_score')
        setResults(rs || [])
      }

      // Retomar progresso parcial, se houver (§12.5). Colunas answers/current_step
      // vêm da migration 060; se ainda não existirem, o select falha e seguimos limpos.
      if (user) {
        try {
          const { data: existing } = await supabase
            .from('questionnaire_responses')
            .select('id, answers, current_step')
            .eq('questionnaire_id', questionnaireId)
            .eq('user_id', user.id)
            .eq('status', 'in_progress')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (existing?.id) {
            setResponseId(existing.id)
            const savedAnswers = (existing as { answers?: unknown }).answers
            if (savedAnswers && typeof savedAnswers === 'object' && !Array.isArray(savedAnswers)) {
              setAnswers(savedAnswers as typeof answers)
            }
            const savedStep = (existing as { current_step?: number }).current_step
            if (typeof savedStep === 'number' && savedStep > 0) { setStep(savedStep); setResumed(true) }
          }
        } catch { /* colunas ainda não migradas — ignora */ }
      }

      setPhase('intro')
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaireId])

  // ── Compute result ─────────────────────────────────────────────────────────
  function computeResult() {
    const cur = answersRef.current
    const totalScore = Object.values(cur).reduce((sum, a) => sum + (a.score || 0), 0)
    const allTags = Object.values(cur).flatMap(a => a.tags || [])

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

  // ── Cria (ou reutiliza) a resposta in_progress ao começar (§12.5) ────────────
  async function ensureResponse(): Promise<string | null> {
    if (!user) return null
    if (responseId) return responseId
    const { data } = await supabase
      .from('questionnaire_responses')
      .insert({
        questionnaire_id: questionnaireId,
        user_id: user.id,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (data?.id) { setResponseId(data.id); return data.id }
    return null
  }

  // ── Persiste respostas parciais + passo atual (colunas da migration 060) ─────
  async function persistProgress(currentStep: number, rid?: string | null) {
    const id = rid ?? responseId
    if (!user || !id) return
    try {
      await supabase
        .from('questionnaire_responses')
        .update({ answers: answersRef.current, current_step: currentStep, status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', id)
    } catch { /* colunas ainda não migradas — não crítico */ }
  }

  // ── "Salvar e sair": guarda o progresso e volta (§11 do player) ──────────────
  async function handleSaveAndExit() {
    if (exiting) return
    setExiting(true)
    const id = await ensureResponse()
    await persistProgress(step, id)
    onBack()
  }

  // ── Conclui: marca a resposta como completed e grava as respostas ────────────
  async function saveResponse() {
    if (!user || saving || saved) return
    setSaving(true)
    const { totalScore, allTags, resultId } = computeResult()

    try {
      let respId = await ensureResponse()
      // Conclusão com colunas garantidas (existem desde as migrations base).
      const completion = {
        status: 'completed',
        total_score: totalScore,
        generated_tags: allTags.join(','),
        result_id: resultId,
        completed_at: new Date().toISOString(),
      }
      if (respId) {
        await supabase.from('questionnaire_responses').update(completion).eq('id', respId)
      } else {
        const { data } = await supabase
          .from('questionnaire_responses')
          .insert({ questionnaire_id: questionnaireId, user_id: user.id, started_at: new Date().toISOString(), ...completion })
          .select('id')
          .single()
        respId = data?.id ?? null
        if (respId) setResponseId(respId)
      }

      // As respostas ficam em questionnaire_responses.answers (JSONB) — NÃO usamos
      // questionnaire_answers (question_id 'q1' não é UUID e causaria erro de schema). §10.3
      // Reforça status='completed' AQUI (mesmo write das respostas, com colunas
      // sempre conhecidas pelo cache do PostgREST): garante que a conclusão persista
      // mesmo se o update de conclusão acima falhar por cache de schema desatualizado.
      if (respId) {
        try {
          await supabase
            .from('questionnaire_responses')
            .update({ answers: answersRef.current, current_step: questions.length, status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', respId)
        } catch { /* colunas answers/current_step vêm da migration — não crítico */ }
        setSaved(true)
      }
    } catch {
      // noop — save failure is non-critical
    }
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
      const next = step + 1
      setStep(next)
      void persistProgress(next) // auto-save a cada avanço (§9.4)
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
        <div className="w-6 h-6 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
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
          <div className="w-16 h-16 bg-forest-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            {questionnaire.icon || '📋'}
          </div>
          <h1 className="font-serif text-2xl text-stone-800 mb-2">{questionnaire.title}</h1>
          <p className="text-stone-500 text-sm mb-5 max-w-sm mx-auto">
            {questionnaire.short_description || questionnaire.description}
          </p>

          {(questionnaire.intro_message || questionnaire.intro_text) && (
            <div className="bg-mint/40 border border-forest-100 rounded-xl p-4 text-sm text-stone-700 text-left mb-5">
              {questionnaire.intro_message || questionnaire.intro_text}
            </div>
          )}

          <div className="flex items-center justify-center gap-6 text-xs text-stone-400 mb-6">
            {questionnaire.estimated_time && <span>⏱ {questionnaire.estimated_time}</span>}
            {questions.length > 0 && <span>📋 {questions.length} perguntas</span>}
          </div>

          <button
            onClick={async () => { await ensureResponse(); if (!resumed) setStep(0); setPhase('playing') }}
            className="w-full bg-stone-800 text-white py-3 rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            {resumed ? 'Continuar de onde parei' : (questionnaire.start_button_text || 'Começar')}
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
        <div className="flex items-center justify-between gap-2 text-xs text-stone-400 mb-2">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : setPhase('intro')} className="text-stone-400 hover:text-stone-700 flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Voltar
          </button>
          <span className="whitespace-nowrap">Pergunta {step + 1} de {questions.length} · {progress}%</span>
          {user ? (
            <button onClick={handleSaveAndExit} disabled={exiting} className="text-stone-400 hover:text-forest-700 whitespace-nowrap disabled:opacity-50">
              {exiting ? 'Salvando…' : 'Salvar e sair'}
            </button>
          ) : <span className="w-14" />}
        </div>
        <div className="h-1.5 bg-stone-200 rounded-full mb-6">
          <div className="h-full bg-forest-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
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
                  className={`w-full text-left flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm transition-all group ${currentAnswer?.value === opt.option_text ? 'border-forest-500 bg-mint/40 text-forest-800' : 'border-stone-200 hover:border-forest-300 hover:bg-mint/40 text-stone-700'}`}
                >
                  <span>{opt.option_text}</span>
                  <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-forest-500 shrink-0" />
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
                  className={`py-4 rounded-xl border text-sm font-medium transition-all ${currentAnswer?.value === opt.option_text ? 'border-forest-500 bg-forest-600 text-white' : 'border-stone-200 text-stone-700 hover:border-forest-300 hover:bg-mint/40'}`}
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
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all ${sel ? 'border-forest-500 bg-mint/40 text-forest-800' : 'border-stone-200 text-stone-700 hover:border-forest-200'}`}
                    >
                      <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${sel ? 'bg-forest-600 border-forest-600' : 'border-stone-300'}`}>
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
                    className={`w-12 h-12 rounded-full border-2 text-sm font-semibold transition-all ${currentAnswer?.value === String(n) ? 'bg-forest-600 border-forest-600 text-white scale-110' : 'border-stone-200 text-stone-600 hover:border-forest-300 hover:bg-mint/40'}`}
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
                    className={`w-10 h-10 rounded-full border-2 text-xs font-semibold transition-all ${currentAnswer?.value === String(n) ? 'bg-forest-600 border-forest-600 text-white' : 'border-stone-200 text-stone-600 hover:border-forest-300'}`}
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
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-300 mb-3"
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
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-300 mb-3 resize-none"
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
    const resultText = matchedResult?.message || questionnaire.default_result_text || 'Que bom que você compartilhou como está.'
    const resultTitle = matchedResult?.title || 'Recebemos suas respostas'
    const disclaimer = matchedResult?.disclaimer || questionnaire.disclaimer
    const rPlan = normalizePlan(_profile?.plan)
    const go = (v: string) => onNavigate?.(v)

    return (
      <section className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-forest-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-forest-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-6 h-6 text-forest-600" />
            </div>
            <h2 className="font-serif text-2xl text-stone-800 mb-1">{resultTitle}</h2>
            <p className="text-sm text-stone-400">Com base nas suas respostas:</p>
          </div>

          <div className="bg-mint/40 border border-forest-100 rounded-xl p-5 mb-4">
            <p className="text-stone-700 leading-relaxed text-sm">{resultText}</p>
          </div>

          {matchedResult?.description && (
            <p className="text-sm text-stone-600 mb-4 leading-relaxed">{matchedResult.description}</p>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800 leading-relaxed text-center">
            {disclaimer || questionnaire.final_message || questionnaire.completion_text ||
              'Este resultado é uma ferramenta de autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'}
          </div>

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

          {/* Próximos passos por plano (§9.3) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {user && (
              <button onClick={() => (onNavigate ? go('diary') : onNavigateDiary?.())} className="flex items-center justify-center gap-2 bg-forest-900 hover:bg-forest-800 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors">
                <BookOpen className="w-4 h-4" /> Registrar no diário
              </button>
            )}

            {user && rPlan === 'free' && <>
              <ResultCTA label="Ver conteúdo gratuito" onClick={() => (onNavigate ? go('articles') : onNavigateArticles?.())} />
              <ResultCTA label="Conhecer o Essencial" onClick={() => onNavigatePricing?.()} />
            </>}

            {user && rPlan === 'essential' && <>
              <ResultCTA label="Ver conteúdo guiado" onClick={() => (onNavigate ? go('articles') : onNavigateArticles?.())} />
              <ResultCTA label="Ver mapa emocional" onClick={() => go('my-evolution')} />
              <ResultCTA label="Ver relatório semanal" onClick={() => go('my-report')} />
            </>}

            {user && rPlan === 'plus' && <>
              <ResultCTA label="Atualizar plano de autocuidado" onClick={() => go('self-care')} />
              <ResultCTA label="Usar no relatório mensal" onClick={() => go('my-report')} />
              <ResultCTA label="Enviar para orientação" onClick={() => go('monthly-guidance')} />
            </>}

            {!user && onNavigatePricing && (
              <ResultCTA label="Conhecer os planos" onClick={onNavigatePricing} />
            )}
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => { setAnswers({}); setStep(0); setPhase('intro'); setSaved(false) }}
              className="flex items-center gap-2 text-stone-400 hover:text-stone-600 text-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refazer
            </button>
            <button onClick={onBack} className="flex items-center gap-2 text-stone-400 hover:text-stone-600 text-sm">
              <X className="w-3.5 h-3.5" /> Fechar
            </button>
          </div>
        </div>
      </section>
    )
  }

  return null
}

// ─── Botão de próximo passo no resultado (§9.3) ──────────────────────────────
function ResultCTA({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 bg-mint hover:bg-mint/70 text-forest-800 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
    >
      {label}
    </button>
  )
}
