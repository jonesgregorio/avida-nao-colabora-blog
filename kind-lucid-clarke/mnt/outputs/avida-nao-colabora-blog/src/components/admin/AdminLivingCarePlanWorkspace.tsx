import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Eye, HeartHandshake, Leaf, Loader2, RefreshCw, Save, Send, Sparkles, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { computeEmotionalAnalysis, type DiaryRowLite, type EmotionalAnalysis, MOOD_EMOJI } from '../../lib/emotionalAnalytics'
import { buildRecordsSummary, generateCarePlanAI, resolveRecommendedContent, type CarePlanContent, type CareSummary, type ResolvedContent } from '../../lib/careePlanAI'
import { createUserNotification } from '../../lib/notifications'
import { emailSelfCarePlanForUser } from '../../lib/emailTriggers'
import { activationYmd, formatDateBR, formatPeriodShort, getReportAvailabilityDate, monthTitle, parseYmd, ymd } from '../../lib/reportPeriods'

type EligibleUser = {
  user_id: string
  full_name: string | null
  email: string | null
  plan: string
  plan_activated_at: string | null
}

type CarePlanRow = {
  id: string
  user_id: string
  month_reference: string
  period_start: string
  period_end: string
  available_at: string
  status: string
  ai_summary_json: CareSummary | null
  care_plan: CarePlanContent | null
  records_summary: Record<string, unknown> | null
  recommended_content_ids: string[] | null
  admin_notes: string | null
  generated_at: string | null
  generated_by_ai: boolean | null
  fallback_used: boolean | null
  error_message: string | null
  edited_by_human: boolean | null
  edited_at: string | null
  sent_at: string | null
}

type PreviousInsight = {
  plan: CarePlanRow | null
  active_actions: number
  paused_actions: number
  removed_actions: number
  helped: number
  neutral: number
  could_not: number
  adapt_requests: number
  not_for_me: number
}

type Period = { start: string; end: string; availableAt: string; activatedAfter: boolean }
type Tab = 'aberto' | 'revisao' | 'pronto' | 'enviados' | 'sem_contexto' | 'todos'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'aberto', label: 'Em aberto' },
  { key: 'revisao', label: 'Em revisão' },
  { key: 'pronto', label: 'Prontos para envio' },
  { key: 'sem_contexto', label: 'Sem contexto' },
  { key: 'enviados', label: 'Enviados' },
  { key: 'todos', label: 'Todos' },
]

const STATUS_LABEL: Record<string, string> = {
  pending_generation: 'Pendente de geração', generating: 'Gerando', draft: 'Rascunho', pending_review: 'Em revisão',
  approved: 'Pronto para envio', sent: 'Enviado', skipped: 'Sem contexto suficiente', failed: 'Falhou',
}

const emptySummary = (): CareSummary => ({
  general_overview: '', main_emotions: [], recurring_emotional_markers: [], energy_anxiety_relation: '', attention_days: [], improvement_moments: [], patterns: [], attention_points: [],
})

const emptyPlan = (): CarePlanContent => ({
  title: '', month_label: '', based_on_period: '', main_focus: '', why_this_focus: '', three_care_priorities: [
    { priority: '', why_it_matters: '', small_actions: ['', ''] },
    { priority: '', why_it_matters: '', small_actions: ['', ''] },
    { priority: '', why_it_matters: '', small_actions: ['', ''] },
  ],
  suggested_micro_actions: [], recommended_guided_contents: [], gentle_reminders: [], what_not_to_force: '', light_emotional_goal: '',
  monthly_priority: '', main_care: '', recommended_practice: '', attention_point: '', small_commitment: '', checkin_suggestion: '', practical_tips: [], reflection_questions: [], final_message: '',
})

function recentClosedMonths(n = 6) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (i + 1), 1, 12)
    return ymd(d)
  })
}

function periodForMonth(monthRef: string, activation: string | null): Period {
  const d = parseYmd(monthRef)
  const start0 = ymd(new Date(d.getFullYear(), d.getMonth(), 1, 12))
  const end = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))
  const act = activationYmd(activation)
  return { start: act && act > start0 && act <= end ? act : start0, end, availableAt: getReportAvailabilityDate(end), activatedAfter: !!act && act > end }
}

function normPlus(plan: string | null | undefined) {
  return ['plus', 'therapeutic', 'therapeutic-plus'].includes(String(plan))
}

function statusInTab(tab: Tab, status: string) {
  if (tab === 'todos') return true
  if (tab === 'aberto') return ['pending_generation', 'generating', 'failed'].includes(status)
  if (tab === 'revisao') return ['draft', 'pending_review'].includes(status)
  if (tab === 'pronto') return status === 'approved'
  if (tab === 'enviados') return status === 'sent'
  if (tab === 'sem_contexto') return status === 'skipped'
  return true
}

function readinessOf(analysis: EmotionalAnalysis | null) {
  const total = analysis?.totalEntries ?? 0
  const days = analysis?.activeDays ?? 0
  return { ready: total >= 12 && days >= 8, total, days, minTotal: 12, minDays: 8 }
}

export default function AdminLivingCarePlanWorkspace() {
  const months = useMemo(() => recentClosedMonths(6), [])
  const [monthRef, setMonthRef] = useState(months[0] ?? '')
  const [eligible, setEligible] = useState<EligibleUser[]>([])
  const [plans, setPlans] = useState<CarePlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('aberto')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<{ user: EligibleUser; plan: CarePlanRow | null; period: Period } | null>(null)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error })
    window.setTimeout(() => setToast(null), 4200)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [usersResult, plansResult] = await Promise.all([
      supabase.rpc('admin_eligible_plus_users'),
      supabase.from('monthly_care_plans').select('*').eq('month_reference', monthRef).order('updated_at', { ascending: false }).limit(1000),
    ])
    if (usersResult.error) notify('Não foi possível carregar usuários elegíveis: ' + usersResult.error.message, true)
    if (plansResult.error) notify('Não foi possível carregar os planos: ' + plansResult.error.message, true)
    setEligible(((usersResult.data ?? []) as EligibleUser[]).filter(u => normPlus(u.plan)))
    setPlans((plansResult.data ?? []) as CarePlanRow[])
    setLoading(false)
  }, [monthRef, notify])

  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => {
    const byUser = new Map(plans.map(p => [p.user_id, p]))
    const q = search.trim().toLowerCase()
    return eligible
      .map(user => ({ user, period: periodForMonth(monthRef, user.plan_activated_at), plan: byUser.get(user.user_id) ?? null }))
      .filter(row => !row.period.activatedAfter)
      .filter(row => !q || (row.user.full_name ?? '').toLowerCase().includes(q) || (row.user.email ?? '').toLowerCase().includes(q))
      .filter(row => statusInTab(tab, row.plan?.status ?? 'pending_generation'))
  }, [eligible, plans, monthRef, search, tab])

  const counts = useMemo(() => {
    const all = eligible.map(user => ({ status: plans.find(p => p.user_id === user.user_id)?.status ?? 'pending_generation', period: periodForMonth(monthRef, user.plan_activated_at) })).filter(r => !r.period.activatedAfter)
    return Object.fromEntries(TABS.map(t => [t.key, all.filter(r => statusInTab(t.key, r.status)).length])) as Record<Tab, number>
  }, [eligible, plans, monthRef])

  return (
    <section className="rounded-2xl border border-line bg-white overflow-hidden">
      {toast && <div className={`fixed z-[80] top-5 right-5 rounded-xl px-4 py-3 text-sm text-white shadow-xl ${toast.error ? 'bg-red-700' : 'bg-forest-900'}`}>{toast.text}</div>}
      <div className="p-5 border-b border-line bg-paper-soft/70">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[.14em] font-semibold text-forest-600">Revisão do Plano Vivo</p>
            <h2 className="font-serif text-2xl text-forest-900 mt-1">Da leitura estruturada ao plano que o usuário verá</h2>
            <p className="text-sm text-ink-soft mt-1 max-w-3xl">O Admin mostra a mesma estrutura do Plano Vivo: contexto disponível, aprendizado do ciclo anterior, foco, três frentes de cuidado, pequenas ações e prévia final. A IA só deve gerar quando houver contexto suficiente.</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="admin-input text-sm" value={monthRef} onChange={e => setMonthRef(e.target.value)}>{months.map(m => <option key={m} value={m}>{monthTitle(m)}</option>)}</select>
            <button type="button" className="admin-btn-secondary" onClick={() => void load()} aria-label="Atualizar fila"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-5">{TABS.map(t => <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`rounded-xl border px-3 py-2 text-xs font-medium ${tab === t.key ? 'border-forest-300 bg-mint text-forest-900' : 'border-line bg-white text-ink-soft hover:border-forest-200'}`}>{t.label} <span className="ml-1 opacity-70">{counts[t.key] ?? 0}</span></button>)}</div>
        <div className="mt-3 max-w-md"><input className="admin-input w-full text-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" /></div>
      </div>

      {loading ? <div className="py-14 flex justify-center text-sm text-ink-soft"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Carregando fila…</div> : rows.length === 0 ? <div className="py-14 text-center text-sm text-ink-soft">Nenhum plano nesta visão.</div> : (
        <div className="divide-y divide-line">{rows.map(row => {
          const status = row.plan?.status ?? 'pending_generation'
          return <button key={row.user.user_id} type="button" onClick={() => setOpen(row)} className="w-full text-left px-5 py-4 hover:bg-mint/20 transition flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
            <div className="min-w-0 md:flex-1"><p className="text-sm font-medium text-forest-900 truncate">{row.user.full_name || 'Usuário sem nome'}</p><p className="text-xs text-ink-soft truncate">{row.user.email || row.user.user_id}</p></div>
            <div className="text-xs text-ink-soft md:w-48">{formatPeriodShort(row.period)}</div>
            <span className={`text-xs rounded-full px-2.5 py-1 md:w-44 text-center ${status === 'sent' ? 'bg-forest-100 text-forest-800' : status === 'skipped' ? 'bg-amber-100 text-amber-800' : status === 'pending_review' || status === 'draft' ? 'bg-violet-100 text-violet-800' : 'bg-stone-100 text-stone-700'}`}>{STATUS_LABEL[status] ?? status}</span>
            <ChevronRight className="w-4 h-4 text-ink-soft" />
          </button>
        })}</div>
      )}

      {open && <ReviewDrawer user={open.user} plan={open.plan} period={open.period} monthRef={monthRef} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load() }} notify={notify} />}
    </section>
  )
}

function ReviewDrawer({ user, plan, period, monthRef, onClose, onSaved, notify }: { user: EligibleUser; plan: CarePlanRow | null; period: Period; monthRef: string; onClose: () => void; onSaved: () => void; notify: (text: string, error?: boolean) => void }) {
  const [analysis, setAnalysis] = useState<EmotionalAnalysis | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState<'draft' | 'send' | 'skip' | null>(null)
  const [summary, setSummary] = useState<CareSummary>({ ...emptySummary(), ...(plan?.ai_summary_json ?? {}) })
  const [care, setCare] = useState<CarePlanContent>({ ...emptyPlan(), ...(plan?.care_plan ?? {}) })
  const [content, setContent] = useState<ResolvedContent[]>([])
  const [notes, setNotes] = useState(plan?.admin_notes ?? '')
  const [generatedByAI, setGeneratedByAI] = useState(plan?.generated_by_ai ?? false)
  const [fallbackUsed, setFallbackUsed] = useState(plan?.fallback_used ?? false)
  const [aiError, setAiError] = useState(plan?.error_message ?? null)
  const [generatedAt, setGeneratedAt] = useState(plan?.generated_at ?? null)
  const [previous, setPrevious] = useState<PreviousInsight | null>(null)
  const [preview, setPreview] = useState(false)
  const baselineRef = useRef(JSON.stringify({ summary, care }))
  const sent = plan?.status === 'sent'

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoadingData(true)
      const { data, error } = await supabase.rpc('admin_monthly_care_source', { p_user: user.user_id, p_start: period.start, p_end: period.end })
      if (!active) return
      if (error) { notify('Erro ao carregar a base do plano: ' + error.message, true); setLoadingData(false); return }
      const rows: DiaryRowLite[] = ((data ?? []) as Record<string, unknown>[]).map(d => ({
        mood: d.mood as string, mood_score: d.mood_score as number, energy: d.energy as number, anxiety_level: d.anxiety_level as number, sleep_quality: d.sleep_quality as number, self_esteem: d.self_esteem as number, stress_level: d.stress_level as number,
        emotional_tags: d.emotional_tags as string[], context_tags: d.context_tags as string[], need_tags: d.need_tags as string[], care_action_tags: d.care_action_tags as string[], trigger_tags: d.trigger_tags as string[], entry_type: d.entry_type as string, created_at: d.created_at as string, date: d.entry_date as string,
      }))
      setAnalysis(computeEmotionalAnalysis(rows))
      setLoadingData(false)
    })()
    return () => { active = false }
  }, [user.user_id, period.start, period.end, notify])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: prevRows } = await supabase.from('monthly_care_plans').select('*').eq('user_id', user.user_id).eq('status', 'sent').lt('month_reference', monthRef).order('month_reference', { ascending: false }).limit(1)
      if (!active) return
      const prev = ((prevRows ?? [])[0] ?? null) as CarePlanRow | null
      if (!prev) { setPrevious(null); return }
      const { data: insight } = await supabase.rpc('admin_care_plan_insights', { p_plan: prev.id })
      if (!active) return
      const row = (insight ?? {}) as Partial<PreviousInsight>
      setPrevious({ plan: prev, active_actions: row.active_actions ?? 0, paused_actions: row.paused_actions ?? 0, removed_actions: row.removed_actions ?? 0, helped: row.helped ?? 0, neutral: row.neutral ?? 0, could_not: row.could_not ?? 0, adapt_requests: row.adapt_requests ?? 0, not_for_me: row.not_for_me ?? 0 })
    })()
    return () => { active = false }
  }, [user.user_id, monthRef])

  const readiness = readinessOf(analysis)
  const rs = useMemo(() => analysis ? buildRecordsSummary(analysis, monthTitle(monthRef), formatPeriodShort(period)) : null, [analysis, monthRef, period])
  const priorities = care.three_care_priorities ?? []
  const currentSnapshot = JSON.stringify({ summary, care })
  const edited = currentSnapshot !== baselineRef.current

  function setPriority(index: number, patch: Partial<{ priority: string; why_it_matters: string; small_actions: string[] }>) {
    const next = [...(care.three_care_priorities ?? [])]
    while (next.length < 3) next.push({ priority: '', why_it_matters: '', small_actions: [] })
    next[index] = { ...next[index], ...patch }
    setCare({ ...care, three_care_priorities: next })
  }

  async function generate() {
    if (!analysis || !rs) return
    if (!readiness.ready) { notify(`Contexto insuficiente: são necessários pelo menos ${readiness.minTotal} registros distribuídos em ${readiness.minDays} dias ativos. A IA não será chamada para criar um plano genérico.`, true); return }
    setGenerating(true)
    try {
      const result = await generateCarePlanAI(analysis, rs, { userId: user.user_id, sourcePeriodStart: period.start })
      setSummary(result.summary)
      setCare({ ...emptyPlan(), ...result.care_plan })
      setGeneratedByAI(result.generatedByAI)
      setFallbackUsed(!result.generatedByAI)
      setAiError(result.generatedByAI ? null : (result.aiError ?? 'A IA não devolveu um plano válido.'))
      setGeneratedAt(new Date().toISOString())
      baselineRef.current = JSON.stringify({ summary: result.summary, care: { ...emptyPlan(), ...result.care_plan } })
      const resolved = await resolveRecommendedContent(result.recommended_content_tags, 'plus', 4)
      setContent(resolved)
      notify(result.generatedByAI ? 'Plano Vivo gerado com IA. Revise a estrutura antes de enviar.' : 'A geração caiu em fallback. Não envie sem revisão humana.', !result.generatedByAI)
    } catch (error) {
      notify('Não foi possível gerar o plano: ' + (error as Error).message, true)
    } finally {
      setGenerating(false)
    }
  }

  function validatePlan() {
    if (!care.main_focus?.trim()) return 'Defina o foco atual.'
    if (!care.why_this_focus?.trim()) return 'Explique por que esse foco foi escolhido.'
    if (priorities.length < 3) return 'O Plano Vivo precisa de três frentes de cuidado.'
    for (let i = 0; i < 3; i++) {
      const p = priorities[i]
      if (!p?.priority?.trim()) return `Preencha o nome da frente ${i + 1}.`
      if (!p?.why_it_matters?.trim()) return `Explique por que a frente ${i + 1} importa.`
      if (!p?.small_actions?.filter(Boolean).length) return `Inclua pelo menos uma pequena ação na frente ${i + 1}.`
    }
    return null
  }

  async function persist(next: 'draft' | 'send' | 'skip') {
    if (!analysis || !rs) return
    if (next === 'send' && !readiness.ready) { notify('Este ciclo não tem contexto suficiente e não pode ser enviado como plano personalizado.', true); return }
    if (next !== 'skip') {
      const invalid = validatePlan()
      if (invalid) { notify(invalid, true); return }
    }
    if (next === 'send' && fallbackUsed && !generatedByAI && !edited) { notify('O conteúdo atual é um fallback não revisado. Gere novamente com IA ou edite o plano antes de enviar.', true); return }
    setSaving(next)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const adminId = auth.user?.id ?? null
      if (next === 'send' && !adminId) throw new Error('Sessão administrativa inválida.')
      const now = new Date().toISOString()
      const recommendedIds = content.length ? content.map(c => c.id) : (plan?.recommended_content_ids ?? [])
      const base: Record<string, unknown> = {
        user_id: user.user_id, month_reference: monthRef, period_start: period.start, period_end: period.end, available_at: period.availableAt,
        records_summary: rs, ai_summary: next === 'skip' ? null : (summary.general_overview || null), ai_summary_json: next === 'skip' ? {} : summary, care_plan: next === 'skip' ? {} : care,
        recommended_content_ids: next === 'skip' ? [] : recommendedIds, admin_notes: notes || null, generated_at: generatedAt,
        generated_by_ai: next === 'skip' ? false : generatedByAI, fallback_used: next === 'skip' ? false : fallbackUsed, error_message: next === 'skip' ? null : aiError,
        edited_by_human: next === 'skip' ? false : ((plan?.edited_by_human ?? false) || edited), edited_at: edited ? now : (plan?.edited_at ?? null), updated_at: now,
        status: next === 'skip' ? 'skipped' : next === 'send' ? 'sent' : 'pending_review',
      }
      if (next === 'send') Object.assign(base, { reviewed_by: adminId, reviewed_at: now, sent_by: adminId, sent_at: now })
      const { data: saved, error } = await supabase.from('monthly_care_plans').upsert(base, { onConflict: 'user_id,month_reference' }).select('id').single()
      if (error) throw error
      if (next === 'send') {
        const id = (saved as { id?: string } | null)?.id
        await createUserNotification({ userId: user.user_id, type: 'self_care_review', title: 'Seu Plano de Autocuidado do mês está disponível', message: 'Seu Plano Vivo foi revisado e está disponível na sua área.', destination: 'self-care', targetResourceType: 'monthly_care_plan', targetResourceId: id })
        if (id) void emailSelfCarePlanForUser(user.user_id, id)
      }
      notify(next === 'send' ? 'Plano revisado e enviado.' : next === 'skip' ? 'Ciclo marcado como sem contexto suficiente.' : 'Plano salvo para revisão.')
      onSaved()
    } catch (error) {
      notify('Erro ao salvar: ' + (error as Error).message, true)
    } finally {
      setSaving(null)
    }
  }

  return <div className="fixed inset-0 z-50 flex justify-end">
    <button type="button" aria-label="Fechar revisão" className="absolute inset-0 bg-black/35" onClick={onClose} />
    <div className="relative w-full max-w-5xl h-full overflow-y-auto bg-[#f7f5ef] shadow-2xl">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur px-5 sm:px-7 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0"><p className="text-[11px] uppercase tracking-[.14em] font-semibold text-forest-600">Revisão do Plano Vivo</p><h2 className="font-serif text-xl sm:text-2xl text-forest-900 truncate">{user.full_name || user.email || 'Usuário'}</h2><p className="text-xs text-ink-soft mt-0.5">{monthTitle(monthRef)} · {formatPeriodShort(period)} · disponível desde {formatDateBR(period.availableAt)}</p></div>
        <button type="button" onClick={onClose} className="h-9 w-9 rounded-xl border border-line bg-white grid place-items-center" aria-label="Fechar"><X className="w-4 h-4" /></button>
      </header>

      <div className="p-5 sm:p-7 space-y-5">
        <section className="grid lg:grid-cols-[1.4fr_.8fr] gap-4">
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-forest-700">1. Contexto disponível para a IA</p><h3 className="font-serif text-xl text-forest-900 mt-1">O sistema reuniu sinais estruturados deste ciclo</h3></div>{loadingData ? <Loader2 className="w-5 h-5 animate-spin text-forest-500" /> : readiness.ready ? <span className="rounded-full bg-forest-100 text-forest-800 px-3 py-1 text-xs font-medium">Contexto suficiente</span> : <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-medium">Contexto insuficiente</span>}</div>
            {analysis && <><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4"><MiniStat label="Registros" value={analysis.totalEntries} /><MiniStat label="Dias ativos" value={analysis.activeDays} /><MiniStat label="Check-ins" value={analysis.checkinCount} /><MiniStat label="Diários" value={analysis.diaryCount} /></div><div className="mt-4 space-y-2 text-xs text-ink-soft"><Signal label="Emoções" values={analysis.topEmotions.slice(0, 6).map(e => `${MOOD_EMOJI[e.label] ?? ''} ${e.label} (${e.count})`)} /><Signal label="Contextos" values={analysis.contexts.slice(0, 6).map(x => `${x.tag} (${x.count})`)} /><Signal label="Necessidades" values={analysis.needs.slice(0, 6).map(x => `${x.tag} (${x.count})`)} /><Signal label="Ações de cuidado" values={analysis.careActions.slice(0, 6).map(x => `${x.tag} (${x.count})`)} /></div></>}
            {!loadingData && !readiness.ready && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-medium">A IA não deve gerar um plano personalizado neste ciclo.</p><p className="mt-1 text-xs">Atual: {readiness.total} registro(s) em {readiness.days} dia(s). Critério do produto: pelo menos {readiness.minTotal} registros distribuídos em {readiness.minDays} dias ativos. O usuário receberá apenas a explicação de contexto insuficiente.</p></div>}
          </div>

          <div className="rounded-2xl border border-line bg-white p-5"><p className="text-xs font-semibold text-forest-700">2. Aprendizado do ciclo anterior</p><h3 className="font-serif text-xl text-forest-900 mt-1">O que deve pesar na próxima geração</h3>{previous?.plan ? <><p className="text-xs text-ink-soft mt-2">Foco anterior: <strong className="text-forest-900">{previous.plan.care_plan?.main_focus || previous.plan.care_plan?.monthly_priority || '—'}</strong></p><div className="grid grid-cols-2 gap-2 mt-4"><MiniStat label="Ajudaram" value={previous.helped} /><MiniStat label="Adaptações" value={previous.adapt_requests} /><MiniStat label="Não combinaram" value={previous.not_for_me} /><MiniStat label="Não conseguiram" value={previous.could_not} /></div><p className="text-[11px] text-ink-soft mt-3">Somente feedback estruturado do plano anterior. Nenhum texto íntimo do Diário é exibido aqui.</p></> : <p className="text-sm text-ink-soft mt-4">Ainda não há um ciclo anterior enviado com retorno estruturado.</p>}</div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-forest-700">3. Proposta da IA · editável pelo Admin</p><h3 className="font-serif text-2xl text-forest-900 mt-1">Revise exatamente a estrutura que alimenta o Plano Vivo</h3></div><button type="button" onClick={() => void generate()} disabled={generating || loadingData || !readiness.ready || sent} className="admin-btn-primary disabled:opacity-50">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{generatedByAI ? 'Regerar com IA' : 'Gerar com IA'}</button></div>
          {sent && <div className="mt-4 rounded-xl border border-forest-200 bg-forest-50 p-3 text-xs text-forest-800">Este plano já foi enviado e está em modo de consulta. Para preservar o que o usuário já recebeu, não altere este ciclo aqui.</div>}
          {fallbackUsed && !generatedByAI && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>Fallback detectado. {aiError || 'A IA não devolveu um plano válido.'} Gere novamente ou edite substancialmente antes de enviar.</span></div>}
          <div className="grid lg:grid-cols-2 gap-4 mt-5"><Field label="Foco atual" value={care.main_focus ?? ''} onChange={v => setCare({ ...care, main_focus: v, monthly_priority: v })} disabled={sent} /><Area label="Por que este foco" value={care.why_this_focus ?? ''} onChange={v => setCare({ ...care, why_this_focus: v, main_care: v })} disabled={sent} rows={3} /></div>
          <div className="grid lg:grid-cols-3 gap-4 mt-4">{[0, 1, 2].map(i => { const p = priorities[i] ?? { priority: '', why_it_matters: '', small_actions: [] }; return <div key={i} className="rounded-2xl border border-line bg-paper-soft/50 p-4"><p className="text-[10px] uppercase tracking-wider font-semibold text-forest-600">Frente {i + 1}</p><Field label="Nome da frente" value={p.priority} onChange={v => setPriority(i, { priority: v })} disabled={sent} /><Area label="Por que importa" value={p.why_it_matters} onChange={v => setPriority(i, { why_it_matters: v })} disabled={sent} rows={3} /><Area label="Pequenas ações · uma por linha" value={(p.small_actions ?? []).join('\n')} onChange={v => setPriority(i, { small_actions: v.split('\n').map(x => x.trim()).filter(Boolean) })} disabled={sent} rows={4} /></div> })}</div>
          <div className="grid lg:grid-cols-3 gap-4 mt-4"><Area label="Microações extras · uma por linha" value={(care.suggested_micro_actions ?? []).join('\n')} onChange={v => setCare({ ...care, suggested_micro_actions: v.split('\n').map(x => x.trim()).filter(Boolean) })} disabled={sent} rows={4} /><Area label="Lembretes gentis · um por linha" value={(care.gentle_reminders ?? []).join('\n')} onChange={v => setCare({ ...care, gentle_reminders: v.split('\n').map(x => x.trim()).filter(Boolean) })} disabled={sent} rows={4} /><Area label="Mensagem final" value={care.final_message ?? ''} onChange={v => setCare({ ...care, final_message: v })} disabled={sent} rows={4} /></div>
          <Area label="Notas internas do Admin · não aparecem ao usuário" value={notes} onChange={setNotes} disabled={sent} rows={3} />
        </section>

        <section className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-forest-700">4. Prévia do usuário</p><h3 className="font-serif text-xl text-forest-900 mt-1">Confira o Plano Vivo antes de enviar</h3></div><button type="button" className="admin-btn-secondary" onClick={() => setPreview(v => !v)}><Eye className="w-4 h-4" />{preview ? 'Ocultar prévia' : 'Ver prévia'}</button></div>{preview && <UserPreview care={care} />}</section>

        <section className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap gap-3 justify-between items-center"><div><p className="text-xs font-semibold text-forest-700">5. Revisão e envio</p><p className="text-xs text-ink-soft mt-1">O envio registra a revisão humana. O usuário só vê planos com status enviado.</p></div>{!sent && <div className="flex flex-wrap gap-2">{!readiness.ready && <button type="button" className="admin-btn-secondary" disabled={saving !== null} onClick={() => void persist('skip')}><Leaf className="w-4 h-4" />Registrar contexto insuficiente</button>}<button type="button" className="admin-btn-secondary" disabled={saving !== null || !readiness.ready} onClick={() => void persist('draft')}>{saving === 'draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar para revisão</button><button type="button" className="admin-btn-primary" disabled={saving !== null || !readiness.ready} onClick={() => void persist('send')}>{saving === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Revisar e enviar</button></div>}</div></section>
      </div>
    </div>
  </div>
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-line bg-paper-soft/60 p-3"><p className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</p><p className="font-serif text-xl text-forest-900 mt-1">{value}</p></div>
}
function Signal({ label, values }: { label: string; values: string[] }) {
  return <div><span className="font-medium text-forest-800">{label}: </span>{values.length ? values.join(' · ') : '—'}</div>
}
function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return <label className="block mt-3"><span className="text-xs font-medium text-forest-800">{label}</span><input className="admin-input w-full mt-1 text-sm" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} /></label>
}
function Area({ label, value, onChange, disabled, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; rows?: number }) {
  return <label className="block mt-3"><span className="text-xs font-medium text-forest-800">{label}</span><textarea className="admin-input w-full mt-1 text-sm resize-y" rows={rows} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} /></label>
}
function UserPreview({ care }: { care: CarePlanContent }) {
  const priorities = care.three_care_priorities ?? []
  return <div className="mt-5 rounded-[28px] border border-forest-100 bg-[#f8f6ef] p-5 sm:p-7">
    <div className="rounded-[24px] bg-gradient-to-r from-[#f3f0df] via-[#edf1df] to-[#dbe6d0] p-5"><p className="text-[10px] uppercase tracking-widest font-semibold text-forest-700">Seu foco atual</p><h4 className="font-serif text-2xl text-forest-900 mt-2">{care.main_focus || 'Foco ainda não preenchido'}</h4><p className="text-sm text-ink-soft mt-2">{care.why_this_focus || 'A justificativa aparecerá aqui.'}</p></div>
    <div className="mt-5"><p className="font-serif text-xl text-forest-900">Para experimentar</p><p className="text-xs text-ink-soft mt-1">Três frentes de cuidado. Uma possibilidade de cada vez já é suficiente.</p><div className="grid md:grid-cols-3 gap-3 mt-3">{[0, 1, 2].map(i => { const p = priorities[i]; return <div key={i} className="rounded-2xl border border-line bg-white p-4"><p className="text-[10px] text-forest-600">Frente {i + 1}</p><p className="font-serif text-lg text-forest-900 mt-1">{p?.priority || 'Frente ainda não preenchida'}</p><p className="text-xs text-ink-soft mt-2">{p?.why_it_matters || 'A explicação aparecerá aqui.'}</p><div className="mt-3 space-y-2">{(p?.small_actions ?? []).filter(Boolean).map(a => <div key={a} className="rounded-xl bg-paper-soft p-3 text-xs text-forest-900 flex gap-2"><Check className="w-3.5 h-3.5 text-forest-500 shrink-0" />{a}</div>)}</div></div> })}</div></div>
    <div className="mt-5 rounded-2xl border border-line bg-white p-4 flex gap-3"><HeartHandshake className="w-5 h-5 text-forest-500 shrink-0" /><div><p className="text-sm font-medium text-forest-900">Sem meta ou sequência</p><p className="text-xs text-ink-soft mt-1">O usuário escolhe o que quer incluir, adapta quando precisar e informa como cada ação funcionou.</p></div></div>
  </div>
}
