import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  MessageSquare, CheckCircle, Clock, Send, Loader2, Filter, Sparkles,
  ChevronLeft, Search, Users, Calendar, Bookmark, RefreshCw, LifeBuoy,
} from 'lucide-react'
import { generateWithFailover } from '../../lib/aiContent'
import { emailGuidanceAnsweredForUser } from '../../lib/emailTriggers'
import { detectRisk } from '../../lib/contentRecommendation'
import { buildProfessionalGuidancePrompt } from '../../lib/aiPrompts/emotionalPrompts'
import type { EmotionalSummary } from '../../lib/emotionalAnalytics'
import { GUIDANCE_RESPONSE_SLA_DAYS, guidanceResponseDueDate, guidanceDaysUntilDue } from '../../lib/monthlyGuidanceResponse'

interface GuidanceLetter {
  title?: string; user_request_summary?: string; emotional_context_summary?: string; gentle_guidance?: string
  practical_next_steps?: string[]; connection_with_self_care_plan?: string; suggested_reflection_question?: string
  final_message_draft?: string; professional_review_notes?: string[]; safety_flags?: string[]; data_quality_notice?: string
  review_badge?: string
}
interface GuidanceRequest {
  id: string
  user_id: string
  month_key: string
  message: string
  context: string | null
  expected_help: string | null
  response: string | null
  status: string
  responded_at: string | null
  created_at: string
  ai_draft_json?: { draft?: string; generated_at?: string; prompt_type?: string; final_response?: GuidanceLetter } | null
  final_response_json?: GuidanceLetter | null
  user?: { full_name?: string; email?: string; plan?: string }
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', plus: 'Plus',
  therapeutic: 'Plus', 'therapeutic-plus': 'Plus',
}
const PLAN_COLORS: Record<string, string> = {
  free: 'bg-stone-100 text-stone-500',
  essential: 'bg-blue-100 text-blue-700',
  plus: 'bg-mint text-forest-800',
  therapeutic: 'bg-mint text-forest-800',
  'therapeutic-plus': 'bg-mint text-forest-800',
}

const inputCls = 'w-full px-3.5 py-2.5 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-300 focus:border-forest-300'
const draftKey = (id: string) => `avnc-guidance-draft-${id}`

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}
function monthEnd(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month, 0).toISOString().slice(0, 10)
}
function getMonthOptions() {
  const opts: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return opts
}
function initialsOf(name?: string, email?: string) {
  const base = (name || email || 'U').trim()
  return (base.split(/\s+/).map(w => w[0]).slice(0, 2).join('') || 'U').toUpperCase()
}
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000)
}
function sentAtLabel(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

function isRisky(r: GuidanceRequest): boolean {
  return detectRisk(r.message) || detectRisk(r.context)
}
function RiskBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
      <LifeBuoy className="w-3 h-3" /> Sinal de risco
    </span>
  )
}

const RESPONSE_SLA_DAYS = GUIDANCE_RESPONSE_SLA_DAYS
const responseDueDate = guidanceResponseDueDate
const daysUntilDue = guidanceDaysUntilDue
function dueShort(iso: string): string {
  return responseDueDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

type SummaryRecord = Record<string, unknown>
const asList = (value: unknown): { tag: string; count: number }[] => Array.isArray(value)
  ? value.map(item => typeof item === 'string' ? { tag: item, count: 1 } : item as { tag?: unknown; count?: unknown })
    .filter(item => typeof item.tag === 'string')
    .map(item => ({ tag: String(item.tag), count: Number(item.count) || 1 }))
  : []
const asEmotions = (value: unknown) => asList(value).map(item => ({ label: item.tag, count: item.count, emoji: '•' }))

function summaryFromStoredData(monthKey: string, plan: string | undefined, source: SummaryRecord | null): EmotionalSummary {
  const total = Number(source?.totalEntries ?? source?.total_entries ?? 0) || 0
  const activeDays = Number(source?.activeDays ?? source?.active_days ?? 0) || 0
  const quality = total >= 5 && activeDays >= 3 ? 'high' : total >= 3 ? 'medium' : 'low'
  return {
    period_start: `${monthKey}-01`, period_end: monthEnd(monthKey),
    plan: plan === 'plus' || plan === 'therapeutic' || plan === 'therapeutic-plus' ? 'plus' : 'essential',
    total_entries: total,
    total_checkins: Number(source?.checkinCount ?? source?.checkin_count ?? 0) || 0,
    total_main_diaries: Number(source?.diaryCount ?? source?.diary_count ?? 0) || 0,
    total_addons: 0, active_days: activeDays,
    dominant_emotions: asEmotions(source?.topEmotions ?? source?.top_emotions),
    emotional_markers: asList(source?.emotionalMarkers ?? source?.emotional_markers),
    contexts: asList(source?.contexts), needs: asList(source?.needs),
    care_actions: asList(source?.careActions ?? source?.care_actions),
    real_triggers: asList(source?.realTriggers ?? source?.real_triggers),
    averages: {
      mood: Number(source?.avgMood ?? source?.avg_mood ?? 0) || 0,
      energy: Number(source?.avgEnergy ?? source?.avg_energy ?? 0) || 0,
      anxiety: Number(source?.avgAnxiety ?? source?.avg_anxiety ?? 0) || 0,
      sleep: Number(source?.avgSleep ?? source?.avg_sleep ?? 0) || 0,
      selfEsteem: Number(source?.avgSelfEsteem ?? source?.avg_self_esteem ?? 0) || 0,
      stress: Number(source?.avgStress ?? source?.avg_stress ?? 0) || 0,
    },
    data_quality: {
      has_enough_data: quality !== 'low', total_entries: total, active_days: activeDays,
      confidence_level: quality,
      message: quality === 'low' ? 'Há poucos registros agregados neste período; evite conclusões amplas.' : 'Há dados agregados suficientes para uma leitura cuidadosa.',
    },
  }
}

function extractDraft(raw: string): string {
  try {
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '') as { draft?: unknown }
    if (typeof json.draft === 'string' && json.draft.trim()) return json.draft.trim()
  } catch { /* fallback: resposta não estruturada do provedor */ }
  return raw.trim()
}
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.map(text).filter(Boolean).slice(0, 3) : [] }
function letterFromText(value: string): GuidanceLetter { return { title: 'Sua orientação mensal', gentle_guidance: value, final_message_draft: 'Vá no seu tempo; você não precisa resolver tudo agora.' } }
function extractLetter(raw: string): GuidanceLetter {
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '') as Record<string, unknown>
    const letter: GuidanceLetter = {
      title: text(parsed.title) || 'Sua orientação mensal', user_request_summary: text(parsed.user_request_summary), emotional_context_summary: text(parsed.emotional_context_summary), gentle_guidance: text(parsed.gentle_guidance), practical_next_steps: strings(parsed.practical_next_steps), connection_with_self_care_plan: text(parsed.connection_with_self_care_plan), suggested_reflection_question: text(parsed.suggested_reflection_question), final_message_draft: text(parsed.final_message_draft), professional_review_notes: strings(parsed.professional_review_notes), safety_flags: strings(parsed.safety_flags), data_quality_notice: text(parsed.data_quality_notice),
    }
    return letter.gentle_guidance || letter.final_message_draft ? letter : letterFromText(extractDraft(raw))
  } catch { return letterFromText(extractDraft(raw)) }
}

export default function AdminGuidanceRequests() {
  const [requests, setRequests] = useState<GuidanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'answered' | 'closed'>('all')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<GuidanceRequest | null>(null)
  const [response, setResponse] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [letter, setLetter] = useState<GuidanceLetter | null>(null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('monthly_guidance_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    const list = (rows ?? []) as GuidanceRequest[]
    const ids = [...new Set(list.map(r => r.user_id).filter(Boolean))]
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles').select('user_id, full_name, email, plan').in('user_id', ids)
      const byId = new Map((profs ?? []).map((p: { user_id: string; full_name?: string; email?: string; plan?: string }) => [p.user_id, p]))
      list.forEach(r => {
        const p = byId.get(r.user_id)
        r.user = p ? { full_name: p.full_name ?? undefined, email: p.email ?? undefined, plan: p.plan ?? undefined } : undefined
      })
    }
    setRequests(list)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = requests
    .filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (planFilter !== 'all' && r.user?.plan !== planFilter) return false
      if (monthFilter !== 'all' && r.month_key !== monthFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${r.user?.full_name ?? ''} ${r.user?.email ?? ''} ${r.message}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      const ao = a.status === 'open' ? 0 : 1
      const bo = b.status === 'open' ? 0 : 1
      if (ao !== bo) return ao - bo
      if (ao === 0) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const openReqs = requests.filter(r => r.status === 'open')
  const openCount = openReqs.length
  const nowD = new Date()
  const answeredThisMonth = requests.filter(r =>
    r.status === 'answered' && r.responded_at &&
    new Date(r.responded_at).getMonth() === nowD.getMonth() &&
    new Date(r.responded_at).getFullYear() === nowD.getFullYear()).length
  const oldestOpenDays = openReqs.length
    ? Math.max(...openReqs.map(r => daysSince(r.created_at)))
    : 0

  const statusCounts = {
    all: requests.length,
    open: openCount,
    answered: requests.filter(r => r.status === 'answered').length,
    closed: requests.filter(r => r.status === 'closed').length,
  }

  const gMetrics = [
    { n: openCount, label: 'Aguardando resposta', Icon: Clock, tone: openCount > 0 ? 'text-amber-600' : 'text-forest-600' },
    { n: answeredThisMonth, label: 'Respondidas no mês', Icon: MessageSquare, tone: 'text-forest-600' },
    { n: oldestOpenDays, suffix: oldestOpenDays === 1 ? 'dia' : 'dias', label: 'Mais antiga aguardando', Icon: Calendar, tone: oldestOpenDays >= RESPONSE_SLA_DAYS ? 'text-red-600' : oldestOpenDays >= 5 ? 'text-amber-600' : 'text-forest-600' },
    { n: requests.length, label: 'Total no período', Icon: Users, tone: 'text-forest-600' },
  ]

  function openRequest(r: GuidanceRequest) {
    setSelected(r)
    let draft = ''
    try { draft = localStorage.getItem(draftKey(r.id)) ?? '' } catch { /* noop */ }
    setResponse(r.response ?? r.final_response_json?.gentle_guidance ?? r.ai_draft_json?.final_response?.gentle_guidance ?? r.ai_draft_json?.draft ?? draft)
    setSuggestion('')
    setAdminNotes('')
    setLetter(r.final_response_json ?? r.ai_draft_json?.final_response ?? null)
  }
  function backToList() {
    setSelected(null); setResponse(''); setSuggestion(''); setAdminNotes(''); setLetter(null)
  }
  function finalLetterFor(value: string): GuidanceLetter {
    return letter ? { ...letter, gentle_guidance: value } : letterFromText(value)
  }
  function updateLetterField<K extends keyof GuidanceLetter>(field: K, value: GuidanceLetter[K]) {
    setLetter(current => ({ ...(current ?? letterFromText(response)), [field]: value }))
    if (field === 'gentle_guidance') setResponse(String(value ?? ''))
  }
  function updateLetterList(field: 'practical_next_steps' | 'professional_review_notes', value: string) {
    updateLetterField(field, value.split('\n').map(v => v.trim()).filter(Boolean))
  }

  async function generateDraft() {
    if (!selected) return
    setGenerating(true)
    try {
      const monthReference = `${selected.month_key}-01`
      const [{ data: carePlan }, { data: monthlyReport }, { data: previousGuidance }] = await Promise.all([
        supabase.from('monthly_care_plans').select('records_summary,care_plan,ai_summary_json').eq('user_id', selected.user_id)
          .eq('month_reference', monthReference).maybeSingle(),
        supabase.from('reports').select('content,summary,period_start,period_end').eq('user_id', selected.user_id)
          .eq('report_type', 'monthly').gte('period_start', monthReference).order('period_start', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('monthly_guidance_requests').select('response,month_key').eq('user_id', selected.user_id)
          .neq('id', selected.id).not('response', 'is', null).order('month_key', { ascending: false }).limit(3),
      ])
      const report = monthlyReport as { content?: SummaryRecord; summary?: string; period_start?: string; period_end?: string } | null
      const care = carePlan as { records_summary?: SummaryRecord; care_plan?: SummaryRecord; ai_summary_json?: SummaryRecord } | null
      const combined: SummaryRecord = {
        ...(care?.records_summary ?? {}),
        ...(report?.content ?? {}),
        period_start: report?.period_start ?? monthReference,
        period_end: report?.period_end ?? monthEnd(selected.month_key),
        monthly_report_summary: report?.summary ?? null,
        self_care_plan: care?.care_plan ?? null,
        previous_guidance_count: previousGuidance?.length ?? 0,
      }
      const summary = summaryFromStoredData(selected.month_key, selected.user?.plan, combined)
      const raw = await generateWithFailover(buildProfessionalGuidancePrompt(
        summary,
        selected,
        adminNotes,
        {
          monthly_report_summary: combined.monthly_report_summary,
          self_care_plan: combined.self_care_plan,
        },
      ))
      const nextLetter = extractLetter(raw)
      const generatedText = nextLetter.gentle_guidance || nextLetter.final_message_draft || extractDraft(raw)
      const generatedAt = new Date().toISOString()
      const draft = { draft: generatedText, final_response: nextLetter, generated_at: generatedAt, prompt_type: 'professional_guidance' }
      const { error: draftError } = await supabase.from('monthly_guidance_requests')
        .update({ ai_draft_json: draft, updated_at: generatedAt })
        .eq('id', selected.id)
      if (draftError) throw draftError
      setSelected(current => current ? { ...current, ai_draft_json: draft } : current)
      setLetter(nextLetter)
      setSuggestion(generatedText)
      setResponse(prev => prev.trim() ? prev : generatedText)
      showToast('Rascunho gerado. Revise e ajuste antes de enviar.')
    } catch (e) {
      showToast('Não foi possível gerar agora: ' + (e as Error).message, true)
    } finally {
      setGenerating(false)
    }
  }

  async function saveDraft() {
    if (!selected) return
    const savedAt = new Date().toISOString()
    const draft = response.trim() ? { draft: response.trim(), final_response: finalLetterFor(response.trim()), generated_at: savedAt, prompt_type: 'professional_guidance' } : {}
    const { error } = await supabase.from('monthly_guidance_requests')
      .update({ ai_draft_json: draft, updated_at: savedAt })
      .eq('id', selected.id)
    if (error) { showToast('Não foi possível salvar o rascunho: ' + error.message, true); return }
    try {
      if (response.trim()) localStorage.setItem(draftKey(selected.id), response)
      else localStorage.removeItem(draftKey(selected.id))
    } catch { /* noop */ }
    showToast('Rascunho salvo para revisão no Admin.')
  }

  async function respond() {
    if (!selected || !response.trim()) return
    setSaving(true)
    const respondedAt = new Date().toISOString()
    const finalLetter: GuidanceLetter = { ...finalLetterFor(response.trim()), review_badge: 'Orientação revisada' }
    const { error } = await supabase
      .from('monthly_guidance_requests')
      .update({ response: response.trim(), ai_draft_json: { draft: response.trim(), final_response: finalLetter, generated_at: respondedAt, prompt_type: 'professional_guidance' }, final_response_json: finalLetter, status: 'answered', responded_at: respondedAt, updated_at: respondedAt })
      .eq('id', selected.id)
    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }
    void emailGuidanceAnsweredForUser(selected.user_id, selected.id, respondedAt)
    try { localStorage.removeItem(draftKey(selected.id)) } catch { /* noop */ }
    showToast('Resposta revisada enviada e usuário notificado!')
    setSaving(false)
    backToList()
    load()
  }

  const monthOptions = getMonthOptions()
  const answered = !!selected?.response

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {toast && <Toast toast={toast} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {gMetrics.map(m => (
          <div key={m.label} className="bg-white border border-line rounded-2xl p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-mint/60 flex items-center justify-center flex-shrink-0">
              <m.Icon className={`w-5 h-5 ${m.tone}`} />
            </span>
            <div className="min-w-0">
              <p className="font-serif text-2xl text-forest-900 leading-none">
                {loading ? '—' : m.n}
                {'suffix' in m && m.suffix && <span className="text-sm font-sans text-ink-soft ml-1">{m.suffix}</span>}
              </p>
              <p className="text-xs text-ink-soft mt-1 leading-snug">{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] gap-4 items-start">
        <div className={`bg-white border border-line rounded-2xl p-3 ${selected ? 'hidden lg:block' : 'block'}`}>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou mensagem…"
              className="w-full pl-9 pr-3 py-2.5 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3 items-center">
            {(['all', 'open', 'answered', 'closed'] as const).map(f => {
              const label = f === 'all' ? 'Todas' : f === 'open' ? 'Aguardando' : f === 'answered' ? 'Respondidas' : 'Fechadas'
              const active = statusFilter === f
              return (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${active ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-ink-soft hover:border-forest-300 hover:text-forest-900'}`}
                >
                  {label}
                  <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-stone-100 text-stone-500'}`}>{statusCounts[f]}</span>
                </button>
              )
            })}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${showFilters ? 'bg-mint text-forest-800 border-forest-200' : 'bg-white border-line text-ink-soft hover:border-forest-300'}`}
            >
              <Filter className="w-3.5 h-3.5" />
              {(planFilter !== 'all' || monthFilter !== 'all') && <span className="w-1.5 h-1.5 bg-forest-600 rounded-full" />}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-3 mb-3 bg-stone-50 border border-line rounded-xl p-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Plano</label>
                <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="text-sm px-2 py-1.5 border border-line rounded-lg bg-white">
                  <option value="all">Todos os planos</option>
                  {[...new Set(Object.values(PLAN_LABELS))].map(v => {
                    const key = Object.entries(PLAN_LABELS).find(([, lbl]) => lbl === v)?.[0] ?? v
                    return <option key={v} value={key}>{v}</option>
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Mês</label>
                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="text-sm px-2 py-1.5 border border-line rounded-lg bg-white capitalize">
                  <option value="all">Todos os meses</option>
                  {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
              </div>
              {(planFilter !== 'all' || monthFilter !== 'all') && (
                <div className="flex items-end">
                  <button onClick={() => { setPlanFilter('all'); setMonthFilter('all') }} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1.5">Limpar</button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-stone-400">
              <MessageSquare className="w-9 h-9 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma solicitação encontrada.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-22rem)] overflow-y-auto pr-0.5">
              {filtered.map(r => {
                const waiting = r.status === 'open'
                const isSel = selected?.id === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => openRequest(r)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${isSel ? 'border-forest-400 bg-mint/40 ring-1 ring-forest-200' : waiting ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300' : 'border-line bg-white hover:border-stone-300'}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-xs font-semibold text-forest-700 flex-shrink-0 mt-0.5">
                        {initialsOf(r.user?.full_name, r.user?.email)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-forest-900 text-sm">{r.user?.full_name ?? 'Usuário'}</p>
                          {r.user?.plan && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[r.user.plan] ?? 'bg-stone-100'}`}>{PLAN_LABELS[r.user.plan] ?? r.user.plan}</span>}
                          {isRisky(r) && <RiskBadge />}
                          <span className="text-xs text-stone-300">·</span>
                          <span className="text-xs text-stone-400 capitalize">{monthLabel(r.month_key)}</span>
                        </div>
                        <p className="text-sm text-stone-600 line-clamp-2 mt-1">{r.message}</p>
                        {waiting && <div className="mt-1.5"><DeadlineBadge createdAt={r.created_at} /></div>}
                      </div>
                      <div className="flex-shrink-0"><StatusBadge status={r.status} /></div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <p className="text-center text-xs text-stone-400 pt-3">{filtered.length} {filtered.length === 1 ? 'solicitação' : 'solicitações'}</p>
          )}
        </div>

        <div className={`bg-white border border-line rounded-2xl p-5 sm:p-6 ${selected ? 'block' : 'hidden lg:block'}`}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center text-center py-20 text-stone-400">
              <MessageSquare className="w-10 h-10 opacity-30 mb-3" />
              <p className="text-sm">Selecione uma solicitação para revisar e responder.</p>
            </div>
          ) : (
            <>
              <button onClick={backToList} className="lg:hidden inline-flex items-center gap-1 text-sm text-stone-500 hover:text-forest-800 mb-4">
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>

              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-900">Revisão humana obrigatória</p>
                  <p className="text-xs text-amber-800 mt-0.5">A IA pode preparar o bloco 3, mas nada é enviado automaticamente. Revise o bloco 4 e use “Enviar resposta” para concluir.</p>
                </div>
              </div>

              {answered ? (
                <div className="space-y-4">
                  <ReviewBlock number="1" title="Solicitação">
                    <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
                  </ReviewBlock>
                  <ReviewBlock number="2" title="Usuário">
                    <UserSummary request={selected} />
                  </ReviewBlock>
                  <ReviewBlock number="4" title="Resposta revisada">
                    <div className="bg-mint/50 border border-forest-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] px-2 py-1 rounded-full bg-white text-forest-700 font-medium">Orientação revisada</span>
                        {selected.responded_at && <span className="text-[11px] text-stone-400">{new Date(selected.responded_at).toLocaleDateString('pt-BR')}</span>}
                      </div>
                      <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{selected.response}</p>
                    </div>
                  </ReviewBlock>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px] gap-4 items-start">
                  <div className="space-y-4">
                    <ReviewBlock number="1" title="Solicitação">
                      <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
                      {selected.context && <Field label="O que já tentou" value={selected.context} />}
                      {selected.expected_help && <Field label="Tipo de ajuda esperada" value={selected.expected_help} />}
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <p className="text-xs text-stone-400">Enviada em {sentAtLabel(selected.created_at)}</p>
                        <DeadlineBadge createdAt={selected.created_at} />
                      </div>
                    </ReviewBlock>

                    <ReviewBlock number="2" title="Usuário">
                      <UserSummary request={selected} />
                    </ReviewBlock>

                    <ReviewBlock number="3" title="Rascunho sugerido">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[11px] px-2 py-1 rounded-full bg-stone-100 text-stone-600 font-medium">Rascunho da IA — não enviado</span>
                        <button
                          type="button"
                          onClick={generateDraft}
                          disabled={generating}
                          className="inline-flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-900 font-medium disabled:opacity-50"
                        >
                          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          {suggestion || letter ? 'Gerar outro rascunho' : 'Gerar rascunho com IA'}
                        </button>
                      </div>
                      <input
                        value={adminNotes}
                        onChange={e => setAdminNotes(e.target.value)}
                        placeholder="Anotações para a IA (opcional): pontos a reforçar, conteúdo a indicar…"
                        className={`${inputCls} mb-2`}
                      />
                      {(suggestion || letter?.gentle_guidance) ? (
                        <div className="bg-mint/30 border border-forest-100 rounded-xl p-4">
                          <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{suggestion || letter?.gentle_guidance}</p>
                          <button
                            type="button"
                            onClick={() => {
                              const value = suggestion || letter?.gentle_guidance || ''
                              setResponse(value)
                              if (letter) updateLetterField('gentle_guidance', value)
                            }}
                            className="mt-3 text-xs text-forest-700 hover:text-forest-900 font-medium underline"
                          >
                            Levar este texto para a resposta revisada
                          </button>
                        </div>
                      ) : (
                        <div className="bg-stone-50 border border-dashed border-line rounded-xl p-4 text-sm text-stone-400 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" /> Gere um rascunho apenas como apoio interno. A resposta final continua dependendo da revisão humana.
                        </div>
                      )}
                    </ReviewBlock>

                    <ReviewBlock number="4" title="Resposta revisada">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="text-xs text-stone-500">Esta é a versão que será enviada ao usuário.</p>
                        <span className="text-[11px] px-2 py-1 rounded-full bg-mint text-forest-700 font-medium">Revisão humana</span>
                      </div>
                      {letter ? (
                        <div className="space-y-3">
                          <GuidanceField label="O que você trouxe" value={letter.user_request_summary ?? ''} onChange={v => updateLetterField('user_request_summary', v)} rows={3} />
                          <GuidanceField label="O que seus registros ajudam a observar" value={letter.emotional_context_summary ?? ''} onChange={v => updateLetterField('emotional_context_summary', v)} rows={4} />
                          <GuidanceField label="Uma leitura cuidadosa" value={letter.gentle_guidance ?? response} onChange={v => updateLetterField('gentle_guidance', v)} rows={6} />
                          <GuidanceField label="Próximos passos possíveis" hint="Um por linha" value={(letter.practical_next_steps ?? []).join('\n')} onChange={v => updateLetterList('practical_next_steps', v)} rows={4} />
                          <GuidanceField label="Conexão com o plano de autocuidado" value={letter.connection_with_self_care_plan ?? ''} onChange={v => updateLetterField('connection_with_self_care_plan', v)} rows={3} />
                          <GuidanceField label="Pergunta para continuar no diário" value={letter.suggested_reflection_question ?? ''} onChange={v => updateLetterField('suggested_reflection_question', v)} rows={2} />
                          <GuidanceField label="Mensagem final" value={letter.final_message_draft ?? ''} onChange={v => updateLetterField('final_message_draft', v)} rows={3} />
                          {letter.data_quality_notice && <GuidanceField label="Nota sobre os dados" value={letter.data_quality_notice} onChange={v => updateLetterField('data_quality_notice', v)} rows={2} />}
                        </div>
                      ) : (
                        <textarea
                          value={response}
                          onChange={e => setResponse(e.target.value)}
                          rows={8}
                          placeholder="Revise ou escreva a resposta final aqui…"
                          className={inputCls}
                        />
                      )}

                      <div className="flex items-center gap-2 flex-wrap mt-3">
                        <button
                          type="button"
                          onClick={generateDraft}
                          disabled={generating}
                          className="inline-flex items-center gap-2 border border-line bg-white text-forest-800 text-sm font-medium px-4 py-2.5 rounded-xl hover:border-forest-300 transition-colors disabled:opacity-50"
                        >
                          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          {generating ? 'Gerando…' : 'Gerar outro rascunho'}
                        </button>
                        <button
                          type="button"
                          onClick={saveDraft}
                          disabled={!response.trim()}
                          className="inline-flex items-center gap-2 border border-line bg-white text-stone-600 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-stone-50 transition-colors disabled:opacity-40"
                        >
                          <Bookmark className="w-4 h-4" /> Salvar rascunho
                        </button>
                        <div className="flex-1" />
                        <button
                          onClick={respond}
                          disabled={saving || !response.trim()}
                          className="inline-flex items-center gap-2 bg-forest-700 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          {saving ? 'Enviando…' : 'Enviar resposta'}
                        </button>
                      </div>
                      <p className="text-[11px] text-stone-400 mt-2">Somente este botão envia. O usuário é notificado no app e por e-mail.</p>
                    </ReviewBlock>
                  </div>

                  <aside className="xl:sticky xl:top-4 rounded-2xl border border-line bg-stone-50 p-4" aria-label="Resumo da IA para revisão">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-forest-600" />
                      <h3 className="font-serif text-base text-forest-900">Resumo da IA para revisão</h3>
                    </div>
                    <p className="text-[11px] text-stone-500 mb-3">Apoio interno. Não é enviado ao usuário.</p>
                    {letter ? (
                      <div className="space-y-3 text-xs text-stone-600">
                        <AiSummaryField label="Contexto observado" value={letter.emotional_context_summary} />
                        <AiSummaryField label="Qualidade dos dados" value={letter.data_quality_notice} />
                        {(letter.professional_review_notes?.length ?? 0) > 0 && (
                          <div>
                            <p className="font-semibold text-stone-700 mb-1">Pontos para revisar</p>
                            <ul className="list-disc pl-4 space-y-1">{letter.professional_review_notes!.map(note => <li key={note}>{note}</li>)}</ul>
                          </div>
                        )}
                        {(letter.safety_flags?.length ?? 0) > 0 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                            <p className="font-semibold text-amber-800 mb-1">Sinais de segurança</p>
                            <ul className="list-disc pl-4 space-y-1 text-amber-800">{letter.safety_flags!.map(flag => <li key={flag}>{flag}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400">Gere um rascunho para ver aqui o contexto resumido, a qualidade dos dados e os pontos que merecem revisão.</p>
                    )}
                  </aside>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewBlock({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-forest-900 text-white text-xs font-semibold flex items-center justify-center">{number}</span>
        <h3 className="font-serif text-lg text-forest-900">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function UserSummary({ request }: { request: GuidanceRequest }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-sm font-semibold text-forest-700 flex-shrink-0">
        {initialsOf(request.user?.full_name, request.user?.email)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-forest-900">{request.user?.full_name ?? 'Usuário'}</p>
          {request.user?.plan && <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[request.user.plan] ?? 'bg-stone-100'}`}>{PLAN_LABELS[request.user.plan] ?? request.user.plan}</span>}
          <StatusBadge status={request.status} />
          {isRisky(request) && <RiskBadge />}
        </div>
        {request.user?.email && <p className="text-xs text-stone-400 mt-1 truncate">{request.user.email}</p>}
        <p className="text-xs text-stone-400 mt-1 capitalize">Ciclo: {monthLabel(request.month_key)}</p>
      </div>
    </div>
  )
}

function AiSummaryField({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return <div><p className="font-semibold text-stone-700 mb-1">{label}</p><p className="leading-relaxed">{value}</p></div>
}

function GuidanceField({ label, value, onChange, rows = 3, hint }: { label: string; value: string; onChange: (value: string) => void; rows?: number; hint?: string }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2 text-xs font-semibold text-forest-800 mb-1">
        <span>{label}</span>{hint && <span className="font-normal text-stone-400">{hint}</span>}
      </span>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} className={inputCls} />
    </label>
  )
}

function DeadlineBadge({ createdAt }: { createdAt: string }) {
  const left = daysUntilDue(createdAt)
  const due = dueShort(createdAt)
  let cls = 'bg-forest-100 text-forest-700'
  let label = `Responder até ${due} · ${left} dias`
  if (left < 0) {
    cls = 'bg-red-100 text-red-700'
    const n = Math.abs(left)
    label = `Atrasada há ${n} ${n === 1 ? 'dia' : 'dias'}`
  } else if (left === 0) {
    cls = 'bg-red-100 text-red-700'
    label = 'Vence hoje'
  } else if (left <= 2) {
    cls = 'bg-amber-100 text-amber-700'
    label = `Responder até ${due} · ${left} ${left === 1 ? 'dia' : 'dias'}`
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>
      <Calendar className="w-3 h-3" /> {label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'answered') return <span className="inline-flex items-center gap-1 text-[11px] bg-mint text-forest-800 px-2 py-0.5 rounded-full font-medium"><CheckCircle className="w-3 h-3" /> Respondida</span>
  if (status === 'closed') return <span className="text-[11px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">Fechada</span>
  return <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium"><Clock className="w-3 h-3" /> Aguardando revisão</span>
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2.5">
      <p className="text-[11px] text-stone-500 font-medium mb-0.5">{label}</p>
      <p className="text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  )
}

function Toast({ toast }: { toast: { msg: string; err?: boolean } }) {
  return (
    <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>
  )
}
