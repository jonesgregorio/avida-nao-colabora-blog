import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Check, ChevronRight, Clock, Pause, Play, Sparkles, Target } from 'lucide-react'
import type { Article } from '../types'
import {
  advanceGuidedStep, completeGuidedContent, loadGuidedProgress, loadGuidedSteps, pauseGuidedContent,
  resumeGuidedContent, startGuidedContent, type GuidedProgress, type GuidedStep,
} from '../lib/guidedContentPlayer'
import { recommendGuidedContent, type RecommendedContent } from '../lib/questionnaireResult'

interface Props {
  article: Article
  user: User | null
  plan: string
  onOpenArticle?: (slug: string) => void
}

const INTENSITY_LABEL: Record<string, string> = { leve: 'Leve', moderada: 'Moderada', intensa: 'Intensa' }

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const minutes = Math.round(seconds / 60)
  return minutes > 0 ? `~${minutes} min` : `~${seconds}s`
}

/**
 * Renderiza o player por etapas quando o conteúdo tem `guided_content_steps`.
 * Sem etapas cadastradas, `hasSteps` fica false e o chamador (ArticleView) segue
 * mostrando o corpo do artigo exatamente como antes — nada muda pros artigos comuns.
 */
export default function GuidedContentPlayer({ article, user, plan, onOpenArticle }: Props) {
  const [steps, setSteps] = useState<GuidedStep[]>([])
  const [progress, setProgress] = useState<GuidedProgress | null>(null)
  const [reflection, setReflection] = useState('')
  const [loading, setLoading] = useState(true)
  const [recs, setRecs] = useState<RecommendedContent[]>([])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      loadGuidedSteps(article.id),
      user ? loadGuidedProgress(user.id, article.id) : Promise.resolve(null),
    ]).then(([loadedSteps, loadedProgress]) => {
      if (!active) return
      setSteps(loadedSteps)
      setProgress(loadedProgress)
      setLoading(false)
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [article.id, user])

  useEffect(() => {
    if (progress?.status !== 'completed') return
    const tags = [...(article.emotional_themes ?? []), ...(article.tags ?? [])]
    if (!tags.length) return
    let active = true
    recommendGuidedContent(plan, tags, 3).then(items => { if (active) setRecs(items.filter(i => i.slug !== article.slug)) }).catch(() => {})
    return () => { active = false }
  }, [progress?.status, article.emotional_themes, article.tags, article.slug, plan])

  if (loading || steps.length === 0) return null

  const status = progress?.status ?? 'not_started'
  const currentStepOrder = progress?.current_step_order ?? 0
  const currentStep = steps.find(s => s.step_order === currentStepOrder) ?? steps[0]
  const currentIndex = steps.findIndex(s => s.id === currentStep.id)
  const isLastStep = currentIndex === steps.length - 1
  const totalDuration = steps.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)

  async function handleStart() {
    if (!user) return
    await startGuidedContent(user.id, article.id)
    setProgress({ status: 'in_progress', current_step_order: 0, reflection_text: null, started_at: new Date().toISOString(), paused_at: null, completed_at: null })
  }
  async function handlePause() {
    if (!user) return
    await pauseGuidedContent(user.id, article.id, currentStepOrder)
    setProgress(p => p ? { ...p, status: 'paused', paused_at: new Date().toISOString() } : p)
  }
  async function handleResume() {
    if (!user) return
    await resumeGuidedContent(user.id, article.id, currentStepOrder)
    setProgress(p => p ? { ...p, status: 'in_progress', paused_at: null } : p)
  }
  async function handleNext() {
    if (!user) return
    if (isLastStep) {
      await completeGuidedContent(user.id, article.id, reflection)
      setProgress(p => ({ status: 'completed', current_step_order: currentStepOrder, reflection_text: reflection.trim() || p?.reflection_text || null, started_at: p?.started_at ?? null, paused_at: null, completed_at: new Date().toISOString() }))
      return
    }
    const next = steps[currentIndex + 1].step_order
    await advanceGuidedStep(user.id, article.id, next)
    setProgress(p => p ? { ...p, status: 'in_progress', current_step_order: next } : p)
  }

  return (
    <section className="rounded-[26px] border border-forest-100 bg-gradient-to-br from-paper-soft to-mint/20 p-5 sm:p-7 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-forest-600">Prática guiada</p>
          {article.objective && <h2 className="mt-1 font-serif text-xl text-forest-900">{article.objective}</h2>}
        </div>
        <div className="flex flex-wrap gap-2">
          {article.intensity && <span className="rounded-full bg-white/80 border border-line px-3 py-1 text-xs text-forest-800">{INTENSITY_LABEL[article.intensity] ?? article.intensity}</span>}
          {totalDuration > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-line px-3 py-1 text-xs text-forest-800"><Clock className="w-3.5 h-3.5" /> {formatDuration(totalDuration)}</span>}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-line px-3 py-1 text-xs text-forest-800"><Target className="w-3.5 h-3.5" /> {steps.length} {steps.length === 1 ? 'etapa' : 'etapas'}</span>
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {steps.map((step, index) => {
          const reached = status !== 'not_started' && index <= currentIndex
          const isCurrent = status !== 'not_started' && status !== 'completed' && step.id === currentStep.id
          return (
            <li key={step.id} className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${isCurrent ? 'border-forest-400 bg-white' : reached ? 'border-line bg-white/60' : 'border-line/70 bg-white/30'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${reached ? 'bg-forest-900 text-white' : 'border border-line bg-white text-ink-soft'}`}>{reached && (status === 'completed' || index < currentIndex) ? <Check className="w-3.5 h-3.5" /> : index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${reached ? 'text-forest-900' : 'text-ink-soft'}`}>{step.title}</p>
                {isCurrent && <p className="mt-1 text-sm leading-6 text-ink-soft">{step.instruction}</p>}
                {step.duration_seconds ? <p className="mt-1 text-[11px] text-ink-soft">{formatDuration(step.duration_seconds)}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>

      {!user ? (
        <p className="mt-5 text-sm text-ink-soft">Entre na sua conta para acompanhar seu progresso nesta prática.</p>
      ) : status === 'not_started' ? (
        <button type="button" onClick={() => void handleStart()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-forest-800"><Play className="w-4 h-4" /> Começar prática</button>
      ) : status === 'completed' ? (
        <div className="mt-5 rounded-2xl border border-forest-100 bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-forest-900"><Check className="w-4 h-4 text-forest-600" /> Prática concluída</p>
          {progress?.reflection_text && <p className="mt-2 text-sm leading-6 text-ink-soft">{progress.reflection_text}</p>}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {isLastStep && (
            <div>
              <label htmlFor="guided-reflection" className="text-sm font-medium text-forest-900 block">Como foi pra você? <span className="text-stone-400">(opcional)</span></label>
              <textarea id="guided-reflection" value={reflection} onChange={e => setReflection(e.target.value)} maxLength={2000} rows={3} placeholder="Uma reflexão rápida, se fizer sentido para você." className="mt-2 w-full rounded-2xl border border-line bg-white p-3 text-sm text-ink placeholder:text-stone-400 focus:outline-none" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {status === 'paused' ? (
              <button type="button" onClick={() => void handleResume()} className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-forest-800"><Play className="w-4 h-4" /> Retomar</button>
            ) : (
              <>
                <button type="button" onClick={() => void handleNext()} className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-forest-800">{isLastStep ? <><Check className="w-4 h-4" /> Concluir prática</> : <>Próxima etapa <ChevronRight className="w-4 h-4" /></>}</button>
                <button type="button" onClick={() => void handlePause()} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-forest-800"><Pause className="w-4 h-4" /> Pausar</button>
              </>
            )}
          </div>
        </div>
      )}

      {status === 'completed' && recs.length > 0 && (
        <div className="mt-6 border-t border-line/70 pt-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forest-600"><Sparkles className="w-3.5 h-3.5" /> Continuar com</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {recs.map(rc => (
              <button key={rc.id} type="button" onClick={() => rc.slug && onOpenArticle?.(rc.slug)} className="rounded-xl border border-line bg-white p-3 text-left text-xs font-medium text-forest-900 hover:bg-mint/20">{rc.title}</button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
