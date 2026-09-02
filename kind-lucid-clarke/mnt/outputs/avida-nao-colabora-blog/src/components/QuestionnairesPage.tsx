import { useEffect, useState, type ComponentProps } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, HelpCircle, Loader2, Sprout } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import QuestionnairesPageLegacy from './QuestionnairesPageLegacy'

type Props = ComponentProps<typeof QuestionnairesPageLegacy>

type QItem = {
  id: string
  title: string
  description: string
  short_description?: string
  category: string
  plan_required: string
  estimated_time: string | number
}

export default function QuestionnairesPage(props: Props) {
  const { user, profile, onStart, onStartAuth, onNavigateEvolution } = props
  const [items, setItems] = useState<QItem[]>([])
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [inProgress, setInProgress] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setFailed(false)

    const catalog = supabase.rpc('get_questionnaire_catalog')
    const history = user
      ? supabase.from('questionnaire_responses').select('questionnaire_id,status').eq('user_id', user.id)
      : Promise.resolve({ data: [] as { questionnaire_id: string; status: string }[], error: null })

    Promise.all([catalog, history]).then(([catalogResult, historyResult]) => {
      if (!active) return
      if (catalogResult.error || !catalogResult.data || historyResult.error) {
        setFailed(true)
        setLoading(false)
        return
      }

      setItems(catalogResult.data as unknown as QItem[])
      const done = new Set<string>()
      const progress = new Set<string>()
      for (const response of (historyResult.data ?? []) as { questionnaire_id: string; status: string }[]) {
        if (response.status === 'completed') done.add(response.questionnaire_id)
        else progress.add(response.questionnaire_id)
      }
      setCompleted(done)
      setInProgress(progress)
      setLoading(false)
    }, () => {
      if (!active) return
      setFailed(true)
      setLoading(false)
    })

    return () => { active = false }
  }, [user])

  const isLocked = (item: QItem) => {
    const requiresPaid = normalizePlan(item.plan_required) !== 'free'
    return !hasPlanAccess(profile?.plan, item.plan_required) || (requiresPaid && !user)
  }

  const recommended = items.find(item => !isLocked(item) && !completed.has(item.id))
    ?? items.find(item => !isLocked(item))
    ?? items[0]
    ?? null

  const doneCount = items.filter(item => completed.has(item.id)).length
  const progCount = items.filter(item => !completed.has(item.id) && inProgress.has(item.id)).length
  const availCount = Math.max(0, items.length - doneCount - progCount)

  const handleStart = (item: QItem) => {
    if (!user) { onStartAuth(item.id); return }
    if (!hasPlanAccess(profile?.plan, item.plan_required)) {
      setShowDetails(true)
      return
    }
    onStart(item.id)
  }

  if (failed) return <QuestionnairesPageLegacy {...props} />

  if (showDetails) {
    return (
      <div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
          <button type="button" onClick={() => setShowDetails(false)} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900">
            <ArrowLeft className="w-4 h-4" /> Voltar ao resumo
          </button>
        </div>
        <QuestionnairesPageLegacy {...props} />
      </div>
    )
  }

  const recommendedStatus = recommended
    ? completed.has(recommended.id) ? 'Respondido antes' : inProgress.has(recommended.id) ? 'Para continuar' : 'Disponível'
    : ''

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      <header className="max-w-2xl">
        <div className="flex items-center gap-2 text-forest-600"><Sprout className="w-5 h-5" /><p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Questionários</p></div>
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1.5">Um retrato do seu momento</h1>
        <p className="mt-2 text-ink-soft leading-relaxed">Use uma avaliação quando ela puder ajudar a olhar algo com mais calma. Um espaço para observar, não para completar.</p>
        <p className="text-xs text-forest-600 mt-3">Não existe frequência certa. Não existe objetivo de completar todos.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16" role="status"><Loader2 className="w-5 h-5 animate-spin text-forest-500" /><span className="ml-2 text-sm text-ink-soft">Organizando seus questionários…</span></div>
      ) : recommended ? (
        <section className="rounded-3xl border border-forest-100 bg-gradient-to-br from-mint/45 via-paper-soft to-sand-50 p-5 sm:p-6" aria-labelledby="questionnaire-now-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Pode fazer sentido agora</p>
            <span className="rounded-full border border-line bg-white/80 px-2.5 py-1 text-[11px] text-forest-700">{recommendedStatus}</span>
          </div>
          <h2 id="questionnaire-now-heading" className="font-serif text-2xl text-forest-900 mt-1">{recommended.title}</h2>
          <p className="text-sm text-ink-soft mt-2 max-w-2xl leading-relaxed">{recommended.short_description || recommended.description}</p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button type="button" onClick={() => handleStart(recommended)} className="inline-flex items-center gap-2 rounded-2xl bg-forest-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-forest-800">
              {completed.has(recommended.id) ? 'Responder novamente' : inProgress.has(recommended.id) ? 'Retomar' : 'Responder'} <ArrowRight className="w-4 h-4" />
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft"><Clock3 className="w-3.5 h-3.5" /> {recommended.estimated_time}</span>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-line bg-paper-soft p-6 text-center"><HelpCircle className="w-8 h-8 text-forest-300 mx-auto" /><p className="text-sm text-ink-soft mt-2">Ainda não há questionários publicados por aqui.</p></section>
      )}

      {user && (
        <section className="border-t border-line pt-5" aria-labelledby="questionnaire-history-heading">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Suas avaliações</p>
          <h2 id="questionnaire-history-heading" className="font-serif text-2xl text-forest-900 mt-1">O que já está na sua história</h2>
          <p className="text-sm text-ink-soft mt-1">Respondidos anteriormente: {doneCount}. Para retomar, se quiser: {progCount}. Disponíveis para você: {availCount}.</p>
          {onNavigateEvolution && doneCount > 0 && (
            <button type="button" onClick={onNavigateEvolution} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"><CheckCircle2 className="w-4 h-4" /> Ver registros ao longo do tempo</button>
          )}
        </section>
      )}

      <section className="border-t border-line pt-5">
        <button type="button" onClick={() => setShowDetails(true)} className="inline-flex items-center gap-2 rounded-2xl border border-forest-200 bg-paper-soft px-5 py-2.5 text-sm font-medium text-forest-800 hover:bg-mint/40">
          Explorar questionários <ArrowRight className="w-4 h-4" />
        </button>
        <p className="mt-2 text-xs text-ink-soft">Categorias, ordenação, todos os questionários, estados completos e histórico continuam disponíveis na visão detalhada.</p>
      </section>
    </div>
  )
}
