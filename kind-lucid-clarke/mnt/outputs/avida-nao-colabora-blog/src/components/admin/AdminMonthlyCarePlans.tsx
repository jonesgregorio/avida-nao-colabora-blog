import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Leaf, Loader2, Sparkles, Send, X, Search, RefreshCw, Ban, Save } from 'lucide-react'
import {
  computeEmotionalAnalysis, type DiaryRowLite, type EmotionalAnalysis, MOOD_EMOJI,
} from '../../lib/emotionalAnalytics'
import {
  buildRecordsSummary, generateCarePlanAI, resolveRecommendedContent,
  type CareSummary, type CarePlanContent, type ResolvedContent,
} from '../../lib/careePlanAI'
import {
  ymd, parseYmd, activationYmd, getReportAvailabilityDate,
  formatPeriodShort, formatDateBR, monthTitle,
} from '../../lib/reportPeriods'
import { emailSelfCarePlanForUser } from '../../lib/emailTriggers'
import { createUserNotification } from '../../lib/notifications'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface EligibleUser {
  user_id: string
  full_name: string | null
  email: string | null
  plan: string
  plan_activated_at: string | null
  subscription_status: string | null
  created_at: string
}
interface CarePlanRow {
  id: string
  user_id: string
  month_reference: string
  period_start: string
  period_end: string
  available_at: string
  status: string
  ai_summary: string | null
  ai_summary_json: CareSummary | null
  care_plan: CarePlanContent | null
  records_summary: Record<string, unknown> | null
  recommended_content_ids: string[] | null
  admin_notes: string | null
  sent_at: string | null
  updated_at: string
}

const STATUS_LABEL: Record<string, string> = {
  pending_generation: 'Pendente de geração', generating: 'Gerando', draft: 'Rascunho',
  pending_review: 'Pendente de revisão', approved: 'Aprovado', sent: 'Enviado',
  failed: 'Falhou', skipped: 'Ignorado',
}
const STATUS_CLS: Record<string, string> = {
  pending_generation: 'bg-amber-100 text-amber-800', generating: 'bg-blue-100 text-blue-800',
  draft: 'bg-stone-100 text-stone-700', pending_review: 'bg-violet-100 text-violet-800',
  approved: 'bg-teal-100 text-teal-800', sent: 'bg-forest-100 text-forest-800',
  failed: 'bg-red-100 text-red-700', skipped: 'bg-stone-100 text-stone-500',
}

function normPlus(plan: string | null | undefined): boolean {
  return ['plus', 'therapeutic', 'therapeutic-plus'].includes(String(plan))
}

// Período do mês de referência, clampado à ativação (§3/§4).
function periodForMonth(monthRefStart: string, activation: string | null) {
  const d = parseYmd(monthRefStart)
  const start0 = ymd(new Date(d.getFullYear(), d.getMonth(), 1, 12))
  const end = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))
  const act = activationYmd(activation)
  const activatedAfter = !!act && act > end
  const clamped = !!act && act > start0 && act <= end
  return {
    start: clamped ? act! : start0,
    end,
    availableAt: getReportAvailabilityDate(end),
    activatedAfter,
  }
}

// Lista dos últimos N meses FECHADOS (mais recente primeiro).
function recentClosedMonths(n = 6): { ref: string; label: string; availableAt: string }[] {
  const now = new Date()
  const out: { ref: string; label: string; availableAt: string }[] = []
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 12)
    const ref = ymd(new Date(d.getFullYear(), d.getMonth(), 1, 12))
    const end = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))
    out.push({ ref, label: monthTitle(ref), availableAt: getReportAvailabilityDate(end) })
  }
  return out
}

function daysSince(dateYmd: string): number {
  const today = parseYmd(ymd(new Date()))
  const target = parseYmd(dateYmd)
  return Math.max(0, Math.round((today.getTime() - target.getTime()) / 86400_000))
}
// §12: 0 = disponível hoje; 1-3 pendente; >=4 atrasado.
function pendencyLabel(days: number): { text: string; late: boolean } {
  if (days <= 0) return { text: 'Disponível hoje', late: false }
  if (days <= 3) return { text: `Pendente há ${days} ${days === 1 ? 'dia' : 'dias'}`, late: false }
  return { text: `Atrasado há ${days} dias`, late: true }
}

// Abas da fila (§10) — agrupam os status por etapa do trabalho.
type TabKey = 'aberto' | 'revisao' | 'envio' | 'atrasados' | 'enviados' | 'ignorados' | 'todos'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'aberto', label: 'Em aberto' },
  { key: 'revisao', label: 'Em revisão' },
  { key: 'envio', label: 'Prontos para envio' },
  { key: 'atrasados', label: 'Atrasados' },
  { key: 'enviados', label: 'Enviados' },
  { key: 'ignorados', label: 'Ignorados' },
  { key: 'todos', label: 'Todos' },
]
function inTab(tab: TabKey, status: string, late: boolean): boolean {
  switch (tab) {
    case 'todos': return true
    case 'aberto': return status === 'pending_generation' || status === 'generating'
    case 'revisao': return status === 'draft' || status === 'pending_review'
    case 'envio': return status === 'approved'
    case 'atrasados': return status !== 'sent' && status !== 'skipped' && late
    case 'enviados': return status === 'sent'
    case 'ignorados': return status === 'skipped'
    default: return true
  }
}

export default function AdminMonthlyCarePlans() {
  const [eligible, setEligible] = useState<EligibleUser[]>([])
  const [plans, setPlans] = useState<CarePlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const [tab, setTab] = useState<TabKey>('aberto')
  const [search, setSearch] = useState('')
  const months = useMemo(() => recentClosedMonths(6), [])
  const [monthRef, setMonthRef] = useState(months[0]?.ref ?? '')
  const [openRow, setOpenRow] = useState<{ user: EligibleUser; period: ReturnType<typeof periodForMonth>; plan: CarePlanRow | null } | null>(null)
  const ensuredRef = useRef<Set<string>>(new Set())

  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: elig, error: e1 }, { data: pl }] = await Promise.all([
      supabase.rpc('admin_eligible_plus_users'),
      supabase.from('monthly_care_plans').select('*').order('updated_at', { ascending: false }).limit(500),
    ])
    if (e1) showToast('Erro ao carregar elegíveis: ' + e1.message, true)
    setEligible(((elig ?? []) as EligibleUser[]).filter(u => normPlus(u.plan)))
    setPlans((pl ?? []) as CarePlanRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Fallback da fila (§17): cria pending_generation para elegíveis sem linha no
  // mês selecionado (dedupe pelo UNIQUE user_id+month_reference).
  useEffect(() => {
    if (loading || !monthRef || ensuredRef.current.has(monthRef)) return
    const existing = new Set(plans.filter(p => p.month_reference === monthRef).map(p => p.user_id))
    const missing = eligible
      .map(u => ({ u, per: periodForMonth(monthRef, u.plan_activated_at) }))
      .filter(({ u, per }) => !per.activatedAfter && daysSince(per.availableAt) >= 0 && !existing.has(u.user_id))
    ensuredRef.current.add(monthRef)
    if (missing.length === 0) return
    ;(async () => {
      const rows = missing.map(({ u, per }) => ({
        user_id: u.user_id, month_reference: monthRef,
        period_start: per.start, period_end: per.end, available_at: per.availableAt,
        status: 'pending_generation',
      }))
      const { error } = await supabase.from('monthly_care_plans').upsert(rows, { onConflict: 'user_id,month_reference', ignoreDuplicates: true })
      if (!error) load()
    })()
  }, [loading, monthRef, eligible, plans, load])

  // Base: elegíveis para o mês + busca (sem o filtro de aba).
  const baseRows = useMemo(() => {
    const planByUser = new Map(plans.filter(p => p.month_reference === monthRef).map(p => [p.user_id, p]))
    return eligible
      .map(u => ({ user: u, period: periodForMonth(monthRef, u.plan_activated_at), plan: planByUser.get(u.user_id) ?? null }))
      .filter(r => !r.period.activatedAfter)
      .filter(r => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (r.user.full_name ?? '').toLowerCase().includes(q) || (r.user.email ?? '').toLowerCase().includes(q)
      })
      .sort((a, b) => daysSince(b.period.availableAt) - daysSince(a.period.availableAt))
  }, [eligible, plans, monthRef, search])

  // Contagem por aba (respeita mês + busca).
  const tabCounts = useMemo(() => {
    const c: Record<TabKey, number> = { aberto: 0, revisao: 0, envio: 0, atrasados: 0, enviados: 0, ignorados: 0, todos: 0 }
    for (const r of baseRows) {
      const st = r.plan?.status ?? 'pending_generation'
      const late = pendencyLabel(daysSince(r.period.availableAt)).late
      for (const t of TABS) if (inTab(t.key, st, late)) c[t.key]++
    }
    return c
  }, [baseRows])

  // Linhas visíveis: base filtrada pela aba ativa.
  const rows = useMemo(
    () => baseRows.filter(r => inTab(tab, r.plan?.status ?? 'pending_generation', pendencyLabel(daysSince(r.period.availableAt)).late)),
    [baseRows, tab],
  )

  // Cards de resumo (§10.1).
  const metrics = useMemo(() => {
    const monthPlans = plans.filter(p => p.month_reference === monthRef)
    const byStatus = (s: string) => monthPlans.filter(p => p.status === s).length
    const overdue = baseRows.filter(r => {
      const st = r.plan?.status
      return st !== 'sent' && st !== 'skipped' && pendencyLabel(daysSince(r.period.availableAt)).late
    }).length
    return [
      { n: byStatus('pending_generation'), label: 'Pendentes de geração' },
      { n: byStatus('draft') + byStatus('pending_review'), label: 'Em revisão' },
      { n: byStatus('approved'), label: 'Pendentes de envio' },
      { n: byStatus('sent'), label: 'Enviados no mês' },
      { n: overdue, label: 'Atrasados' },
      { n: baseRows.length, label: 'Total Plus elegíveis' },
    ]
  }, [plans, monthRef, baseRows])

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Planos de Autocuidado</h1>
          <p className="text-sm text-ink-soft mt-1">Fila mensal dos usuários Plus. Gere com IA, revise e envie — a revisão humana é obrigatória.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 border border-line text-forest-800 px-3 py-2 rounded-xl text-sm hover:bg-mint/40">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      <div className="border border-[#eeb7a7] bg-[#fff5f1] text-[#783426] rounded-xl px-4 py-3 text-sm mb-5">
        Revisão humana obrigatória antes de enviar qualquer plano gerado por IA. A IA nunca envia sozinha.
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {metrics.map(m => (
          <div key={m.label} className="bg-white border border-line rounded-2xl p-4">
            <p className="font-serif text-2xl text-forest-900">{loading ? '—' : m.n}</p>
            <p className="text-xs text-ink-soft mt-1 leading-snug">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros: mês + busca */}
      <div className="flex flex-wrap gap-3 mb-3 items-center">
        <select value={monthRef} onChange={e => setMonthRef(e.target.value)} className="px-3 py-2 border border-line rounded-lg text-sm capitalize">
          {months.map(m => <option key={m.ref} value={m.ref} className="capitalize">{m.label}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" className="w-full pl-9 pr-3 py-2 border border-line rounded-lg text-sm" />
        </div>
      </div>

      {/* Abas por etapa do trabalho */}
      <div className="flex flex-wrap gap-2 mb-4 border-b border-line">
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg -mb-px border-b-2 transition-colors ${
                active ? 'border-forest-700 text-forest-900 font-medium' : 'border-transparent text-ink-soft hover:text-forest-800'
              }`}
            >
              {t.label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${active ? 'bg-forest-100 text-forest-800' : 'bg-stone-100 text-stone-500'}`}>{tabCounts[t.key]}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm py-8">Carregando fila...</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Leaf className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{baseRows.length === 0 ? 'Nenhum usuário Plus elegível para este mês.' : 'Nenhum plano nesta aba.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-line rounded-2xl bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft border-b border-line">
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium">Disponível desde</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Pendência</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const st = r.plan?.status ?? 'pending_generation'
                const pend = pendencyLabel(daysSince(r.period.availableAt))
                const isSentOrSkip = st === 'sent' || st === 'skipped'
                return (
                  <tr key={r.user.user_id} className="border-b border-line/60 hover:bg-mint/20">
                    <td className="px-4 py-3">
                      <p className="font-medium text-forest-900">{r.user.full_name || '—'}</p>
                      <p className="text-xs text-ink-soft">{r.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{formatPeriodShort(r.period)}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{formatDateBR(r.period.availableAt)}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[st]}`}>{STATUS_LABEL[st]}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isSentOrSkip ? <span className="text-xs text-stone-400">—</span>
                        : <span className={`text-xs ${pend.late ? 'text-red-600 font-medium' : 'text-ink-soft'}`}>{pend.text}</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setOpenRow({ user: r.user, period: r.period, plan: r.plan })} className="text-xs font-medium text-forest-700 border border-forest-200 px-3 py-1.5 rounded-lg hover:bg-mint/50">
                        {isSentOrSkip ? 'Ver' : 'Abrir'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {openRow && (
        <CarePlanDrawer
          user={openRow.user}
          period={openRow.period}
          monthRef={monthRef}
          plan={openRow.plan}
          onClose={() => setOpenRow(null)}
          onSaved={() => { setOpenRow(null); load() }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// ── Drawer de detalhe / edição / envio ────────────────────────────────────────
function emptySummary(): CareSummary {
  return { general_overview: '', main_emotions: [], recurring_triggers: [], energy_anxiety_relation: '', attention_days: [], improvement_moments: [], patterns: [], attention_points: [] }
}
function emptyPlan(): CarePlanContent {
  return { monthly_priority: '', main_care: '', recommended_practice: '', attention_point: '', small_commitment: '', checkin_suggestion: '', reflection_questions: [], final_message: '' }
}
const lines = (s: string) => s.split('\n').map(t => t.trim()).filter(Boolean)

function CarePlanDrawer({ user, period, monthRef, plan, onClose, onSaved, showToast }: {
  user: EligibleUser
  period: { start: string; end: string; availableAt: string }
  monthRef: string
  plan: CarePlanRow | null
  onClose: () => void
  onSaved: () => void
  showToast: (m: string, e?: boolean) => void
}) {
  const [analysis, setAnalysis] = useState<EmotionalAnalysis | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState<null | 'draft' | 'send' | 'skip'>(null)
  // Merge com defaults: o banco guarda '{}' (jsonb) por padrão, que é truthy —
  // sem o merge, arrays ficariam undefined e o .join() derrubaria a tela.
  const [summary, setSummary] = useState<CareSummary>({ ...emptySummary(), ...(plan?.ai_summary_json ?? {}) })
  const [care, setCare] = useState<CarePlanContent>({ ...emptyPlan(), ...(plan?.care_plan ?? {}) })
  const [content, setContent] = useState<ResolvedContent[]>([])
  const [adminNotes, setAdminNotes] = useState(plan?.admin_notes ?? '')
  const status = plan?.status ?? 'pending_generation'
  const readOnly = status === 'sent'

  // Carrega os dados analíticos do mês (RPC sem texto sensível) e monta a análise.
  useEffect(() => {
    let active = true
    ;(async () => {
      setLoadingData(true)
      const { data, error } = await supabase.rpc('admin_monthly_care_source', {
        p_user: user.user_id, p_start: period.start, p_end: period.end,
      })
      if (!active) return
      if (error) { showToast('Erro ao ler dados do mês: ' + error.message, true); setLoadingData(false); return }
      const rows: DiaryRowLite[] = ((data ?? []) as Record<string, unknown>[]).map(d => ({
        mood: d.mood as string, mood_score: d.mood_score as number,
        energy: d.energy as number, anxiety_level: d.anxiety_level as number,
        sleep_quality: d.sleep_quality as number, self_esteem: d.self_esteem as number,
        stress_level: d.stress_level as number,
        emotional_tags: d.emotional_tags as string[], entry_type: d.entry_type as string,
        created_at: d.created_at as string, date: d.entry_date as string,
      }))
      setAnalysis(computeEmotionalAnalysis(rows))
      setLoadingData(false)
    })()
    return () => { active = false }
  }, [user.user_id, period.start, period.end, showToast])

  // Resolve conteúdos recomendados quando há tags salvas.
  useEffect(() => {
    const tags = [...summary.recurring_triggers, ...summary.main_emotions].filter(Boolean)
    if (!tags.length) return
    let active = true
    resolveRecommendedContent(tags, 'plus', 4).then(r => { if (active) setContent(r) }).catch(() => {})
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.recurring_triggers.join(','), summary.main_emotions.join(',')])

  async function runAI() {
    if (!analysis) return
    setGenerating(true)
    try {
      const rs = buildRecordsSummary(analysis, monthTitle(monthRef), formatPeriodShort(period))
      const result = await generateCarePlanAI(analysis, rs)
      setSummary(result.summary)
      setCare(result.care_plan)
      const resolved = await resolveRecommendedContent(result.recommended_content_tags, 'plus', 4)
      setContent(resolved)
      showToast(result.generatedByAI ? 'Rascunho gerado com IA. Revise antes de enviar.' : 'Rascunho gerado (poucos dados — texto de incentivo). Revise.')
    } catch {
      showToast('Não foi possível gerar agora. Tente novamente.', true)
    } finally {
      setGenerating(false)
    }
  }

  async function persist(next: 'draft' | 'send' | 'skip') {
    setSaving(next)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const adminId = auth.user?.id ?? null
      const rs = analysis ? buildRecordsSummary(analysis, monthTitle(monthRef), formatPeriodShort(period)) : {}
      const base: Record<string, unknown> = {
        user_id: user.user_id, month_reference: monthRef,
        period_start: period.start, period_end: period.end, available_at: period.availableAt,
        ai_summary: summary.general_overview || null,
        ai_summary_json: summary, care_plan: care, records_summary: rs,
        recommended_content_ids: content.map(c => c.id),
        admin_notes: adminNotes || null,
        generated_at: new Date().toISOString(), generated_by_ai: true,
        updated_at: new Date().toISOString(),
      }
      if (next === 'skip') {
        base.status = 'skipped'
      } else if (next === 'send') {
        base.status = 'sent'
        base.reviewed_by = adminId; base.reviewed_at = new Date().toISOString()
        base.sent_by = adminId; base.sent_at = new Date().toISOString()
      } else {
        base.status = 'pending_review'
      }

      const { data: saved, error } = await supabase
        .from('monthly_care_plans')
        .upsert(base, { onConflict: 'user_id,month_reference' })
        .select('id')
        .single()
      if (error) { showToast('Erro ao salvar: ' + error.message, true); setSaving(null); return }

      if (next === 'send') {
        const planId = (saved as { id?: string } | null)?.id ?? ''
        // Notificação in-app pela função central (tipo + destino canônicos).
        await createUserNotification({
          userId: user.user_id,
          type: 'self_care_review',
          title: 'Seu Plano de Autocuidado do mês está disponível',
          message: 'Ele foi preparado com base nos seus registros do último mês. Acesse na sua área do usuário.',
          destination: 'self-care',
        })
        if (planId) void emailSelfCarePlanForUser(user.user_id, planId)
      }
      showToast(next === 'send' ? 'Plano enviado ao usuário!' : next === 'skip' ? 'Marcado como ignorado.' : 'Rascunho salvo.')
      onSaved()
    } catch (e) {
      showToast('Erro: ' + (e as Error).message, true)
    } finally {
      setSaving(null)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest-300'

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-paper h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-paper border-b border-line px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-serif text-xl text-forest-900">{user.full_name || user.email}</h2>
            <p className="text-xs text-ink-soft capitalize">{monthTitle(monthRef)} · {formatPeriodShort(period)} · {STATUS_LABEL[status]}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-mint/40 rounded-lg"><X className="w-5 h-5 text-ink-soft" /></button>
        </div>

        <div className="p-5 space-y-6">
          {/* Dados do mês (§13.1) */}
          <section className="bg-white border border-line rounded-2xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Dados do mês</h3>
            {loadingData ? <p className="text-sm text-stone-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
              : !analysis || analysis.totalEntries === 0 ? (
                <p className="text-sm text-amber-700">Sem registros suficientes neste período. Você pode gerar um plano de incentivo ou marcar como ignorado.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <Stat label="Check-ins" value={analysis.checkinCount} />
                  <Stat label="Diários" value={analysis.diaryCount} />
                  <Stat label="Energia média" value={analysis.avg.energy || '—'} unit={analysis.avg.energy ? '/5' : ''} />
                  <Stat label="Ansiedade média" value={analysis.avg.anxiety || '—'} unit={analysis.avg.anxiety ? '/5' : ''} />
                  <div className="col-span-2 sm:col-span-4">
                    <p className="text-xs text-ink-soft mb-1">Emoções predominantes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.topEmotions.slice(0, 5).map(e => <span key={e.label} className="text-xs bg-mint text-forest-700 px-2 py-0.5 rounded-full">{MOOD_EMOJI[e.label] ?? ''} {e.label} ×{e.count}</span>)}
                      {analysis.topEmotions.length === 0 && <span className="text-xs text-stone-400">—</span>}
                    </div>
                  </div>
                  {analysis.triggers.length > 0 && (
                    <div className="col-span-2 sm:col-span-4">
                      <p className="text-xs text-ink-soft mb-1">Gatilhos recorrentes</p>
                      <p className="text-sm text-stone-700">{analysis.triggers.slice(0, 6).map(t => `${t.tag} (${t.count})`).join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
          </section>

          {!readOnly && (
            <button onClick={runAI} disabled={generating || loadingData} className="w-full flex items-center justify-center gap-2 bg-forest-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-forest-800 disabled:opacity-50">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Gerando resumo e plano…' : 'Gerar resumo e plano com IA'}
            </button>
          )}

          {/* Resumo mensal (§7) */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Resumo mensal dos registros</h3>
            <Area label="Visão geral do mês" value={summary.general_overview} onChange={v => setSummary({ ...summary, general_overview: v })} ro={readOnly} cls={inputCls} />
            <Area label="Relação energia × ansiedade" value={summary.energy_anxiety_relation} onChange={v => setSummary({ ...summary, energy_anxiety_relation: v })} ro={readOnly} cls={inputCls} rows={2} />
            <ListArea label="Principais emoções" arr={summary.main_emotions} onChange={a => setSummary({ ...summary, main_emotions: a })} ro={readOnly} cls={inputCls} />
            <ListArea label="Gatilhos recorrentes" arr={summary.recurring_triggers} onChange={a => setSummary({ ...summary, recurring_triggers: a })} ro={readOnly} cls={inputCls} />
            <ListArea label="Padrões percebidos" arr={summary.patterns} onChange={a => setSummary({ ...summary, patterns: a })} ro={readOnly} cls={inputCls} />
            <ListArea label="Pontos que merecem atenção" arr={summary.attention_points} onChange={a => setSummary({ ...summary, attention_points: a })} ro={readOnly} cls={inputCls} />
          </section>

          {/* Plano de autocuidado (§8) */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Plano de Autocuidado sugerido</h3>
            <Area label="Prioridade do mês" value={care.monthly_priority} onChange={v => setCare({ ...care, monthly_priority: v })} ro={readOnly} cls={inputCls} rows={2} />
            <Area label="Cuidado principal" value={care.main_care} onChange={v => setCare({ ...care, main_care: v })} ro={readOnly} cls={inputCls} rows={2} />
            <Area label="Prática recomendada" value={care.recommended_practice} onChange={v => setCare({ ...care, recommended_practice: v })} ro={readOnly} cls={inputCls} rows={2} />
            <Area label="Ponto de atenção" value={care.attention_point} onChange={v => setCare({ ...care, attention_point: v })} ro={readOnly} cls={inputCls} rows={2} />
            <Area label="Pequeno compromisso possível" value={care.small_commitment} onChange={v => setCare({ ...care, small_commitment: v })} ro={readOnly} cls={inputCls} rows={2} />
            <Area label="Sugestão de check-in" value={care.checkin_suggestion} onChange={v => setCare({ ...care, checkin_suggestion: v })} ro={readOnly} cls={inputCls} rows={2} />
            <ListArea label="Perguntas para reflexão" arr={care.reflection_questions} onChange={a => setCare({ ...care, reflection_questions: a })} ro={readOnly} cls={inputCls} />
            <Area label="Mensagem final acolhedora" value={care.final_message} onChange={v => setCare({ ...care, final_message: v })} ro={readOnly} cls={inputCls} rows={2} />
          </section>

          {/* Conteúdos recomendados (§8.6/§20) */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Conteúdos guiados recomendados</h3>
            {content.length === 0 ? (
              <p className="text-sm text-stone-400">Não encontramos conteúdos específicos para este plano agora.</p>
            ) : (
              <ul className="space-y-2">
                {content.map(c => (
                  <li key={c.id} className="border border-line rounded-lg p-3 text-sm">
                    <p className="font-medium text-forest-900">{c.title}</p>
                    <p className="text-xs text-ink-soft">{c.category} — {c.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!readOnly && (
            <section>
              <label className="text-xs text-stone-500 block mb-1">Notas internas do admin (não vão para o usuário)</label>
              <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2} className={inputCls} />
            </section>
          )}
        </div>

        {/* Ações fixas */}
        {!readOnly && (
          <div className="sticky bottom-0 bg-paper border-t border-line px-5 py-3 flex flex-wrap gap-2 justify-end">
            <button onClick={() => persist('skip')} disabled={!!saving} className="flex items-center gap-1.5 text-sm text-stone-600 border border-line px-3 py-2 rounded-lg hover:bg-stone-50 disabled:opacity-50">
              {saving === 'skip' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Ignorar
            </button>
            <button onClick={() => persist('draft')} disabled={!!saving} className="flex items-center gap-1.5 text-sm text-forest-800 border border-forest-200 px-3 py-2 rounded-lg hover:bg-mint/50 disabled:opacity-50">
              {saving === 'draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar rascunho
            </button>
            <button onClick={() => persist('send')} disabled={!!saving || !care.monthly_priority?.trim()} className="flex items-center gap-1.5 text-sm bg-forest-900 text-white px-4 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50">
              {saving === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar plano
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return <div className="bg-mint/40 rounded-lg px-3 py-2"><p className="text-lg font-serif text-forest-900">{value}{unit}</p><p className="text-[11px] text-ink-soft">{label}</p></div>
}
function Area({ label, value, onChange, ro, cls, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; ro: boolean; cls: string; rows?: number }) {
  return (
    <div>
      <label className="text-xs text-stone-500 block mb-1">{label}</label>
      <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} readOnly={ro} rows={rows} className={cls} />
    </div>
  )
}
function ListArea({ label, arr, onChange, ro, cls }: { label: string; arr: string[]; onChange: (a: string[]) => void; ro: boolean; cls: string }) {
  const safe = arr ?? []
  return (
    <div>
      <label className="text-xs text-stone-500 block mb-1">{label} <span className="text-stone-400">(um por linha)</span></label>
      <textarea value={safe.join('\n')} onChange={e => onChange(lines(e.target.value))} readOnly={ro} rows={Math.max(2, safe.length)} className={cls} />
    </div>
  )
}
