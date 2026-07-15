import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { MessageSquare, CheckCircle, Clock, Send, Loader2, Filter, Sparkles, ChevronLeft, AlertCircle, Inbox } from 'lucide-react'
import { generateWithFailover } from '../../lib/aiContent'
import { emailGuidanceAnsweredForUser } from '../../lib/emailTriggers'

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

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
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
function timeAgo(iso: string) {
  const d = daysSince(iso)
  if (d <= 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  return new Date(iso).toLocaleDateString('pt-BR')
}

// Monta o prompt de rascunho: usa APENAS o pedido do usuário + as anotações da
// equipe. Linguagem acolhedora e nunca diagnóstica.
function buildGuidancePrompt(req: GuidanceRequest, notes: string): string {
  return [
    'Você ajuda uma equipe de bem-estar a escrever uma resposta de ORIENTAÇÃO POR MENSAGEM (apoio individual e NÃO emergencial) para uma pessoa usuária de um app de saúde emocional.',
    '',
    'REGRAS OBRIGATÓRIAS:',
    '- Escreva em português do Brasil, com tom acolhedor, humano e prático.',
    '- NUNCA diagnostique. Não use: "diagnóstico", "transtorno", "tratamento", "prescrição", "sessão", "consulta", "terapêutico", "psicanalista", "cura".',
    '- Use "seus registros sugerem", "vale observar", "pode ser útil perceber".',
    '- Baseie-se SOMENTE no que a pessoa escreveu e nas anotações da equipe. Não invente fatos.',
    '- Quando fizer sentido, lembre com delicadeza que esta orientação não substitui acompanhamento profissional e não é um canal de emergência.',
    '',
    `NOME DA PESSOA: ${req.user?.full_name || 'não informado'}`,
    '',
    'PEDIDO DA PESSOA:',
    req.message,
    req.context ? `O que já tentou: ${req.context}` : '',
    req.expected_help ? `Tipo de ajuda esperada: ${req.expected_help}` : '',
    '',
    notes.trim() ? `ANOTAÇÕES DA EQUIPE (incorpore com naturalidade os pontos abaixo):\n${notes.trim()}` : '(Sem anotações extras da equipe.)',
    '',
    'Escreva a resposta final pronta para revisão (2 a 5 parágrafos curtos), começando por um cumprimento acolhedor pelo nome quando houver. Sem markdown, sem títulos — apenas a mensagem.',
  ].filter(Boolean).join('\n')
}

export default function AdminGuidanceRequests() {
  const [requests, setRequests] = useState<GuidanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'answered' | 'closed'>('all')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<GuidanceRequest | null>(null)
  const [response, setResponse] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
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
      return true
    })
    // Aguardando primeiro (mais antigas no topo, FIFO); depois o resto (mais recentes).
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
    { n: openCount, label: 'Aguardando resposta', Icon: Clock, tone: openCount > 0 ? 'text-amber-600' : 'text-forest-900' },
    { n: oldestOpenDays, label: oldestOpenDays === 1 ? 'Dia aguardando (mais antiga)' : 'Dias aguardando (mais antiga)', Icon: AlertCircle, tone: oldestOpenDays >= 5 ? 'text-red-600' : 'text-forest-900' },
    { n: answeredThisMonth, label: 'Respondidas no mês', Icon: CheckCircle, tone: 'text-forest-900' },
    { n: requests.length, label: 'Total de orientações', Icon: Inbox, tone: 'text-forest-900' },
  ]

  function openRequest(r: GuidanceRequest) {
    setSelected(r); setResponse(r.response ?? ''); setAdminNotes('')
  }
  function backToList() {
    setSelected(null); setResponse(''); setAdminNotes('')
  }

  async function generateDraft() {
    if (!selected) return
    setGenerating(true)
    try {
      const text = await generateWithFailover(buildGuidancePrompt(selected, adminNotes))
      setResponse(text)
      showToast('Rascunho gerado. Revise e ajuste antes de enviar.')
    } catch (e) {
      showToast('Não foi possível gerar agora: ' + (e as Error).message, true)
    } finally {
      setGenerating(false)
    }
  }

  async function respond() {
    if (!selected || !response.trim()) return
    setSaving(true)
    const respondedAt = new Date().toISOString()
    const { error } = await supabase
      .from('monthly_guidance_requests')
      .update({ response: response.trim(), status: 'answered', responded_at: respondedAt, updated_at: respondedAt })
      .eq('id', selected.id)
    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }
    // Notificação in-app é criada pelo gatilho notify_guidance_answered (destino 'monthly-guidance').
    void emailGuidanceAnsweredForUser(selected.user_id, selected.id, respondedAt)
    showToast('Resposta enviada e usuário notificado!')
    setSaving(false)
    backToList()
    load()
  }

  const monthOptions = getMonthOptions()

  // ── Detalhe / resposta ──────────────────────────────────────────────────────
  if (selected) {
    const answered = !!selected.response
    return (
      <div className="max-w-3xl mx-auto px-6 py-6">
        {toast && <Toast toast={toast} />}
        <button onClick={backToList} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-forest-800 mb-5">
          <ChevronLeft className="w-4 h-4" /> Voltar para a lista
        </button>

        {/* Cabeçalho do pedido */}
        <div className="bg-white rounded-2xl border border-line p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-full bg-mint flex items-center justify-center text-sm font-semibold text-forest-700 flex-shrink-0">
              {initialsOf(selected.user?.full_name, selected.user?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-forest-900">{selected.user?.full_name ?? 'Usuário'}</p>
                {selected.user?.plan && <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[selected.user.plan] ?? 'bg-stone-100'}`}>{PLAN_LABELS[selected.user.plan] ?? selected.user.plan}</span>}
                <StatusBadge status={selected.status} />
              </div>
              {selected.user?.email && <p className="text-xs text-stone-400 mt-0.5">{selected.user.email}</p>}
              <p className="text-xs text-stone-400 mt-0.5 capitalize">{monthLabel(selected.month_key)} · enviado {timeAgo(selected.created_at)}</p>
            </div>
          </div>

          {/* Pedido do usuário */}
          <div className="mt-4 space-y-3 bg-stone-50 rounded-xl p-4">
            <Field label="Sobre o que quer orientação" value={selected.message} strong />
            {selected.context && <Field label="O que já tentou" value={selected.context} />}
            {selected.expected_help && <Field label="Tipo de ajuda esperada" value={selected.expected_help} />}
          </div>
        </div>

        {/* Resposta já enviada, ou composer */}
        {answered ? (
          <div className="bg-mint/50 border border-forest-100 rounded-2xl p-5 mt-4">
            <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1">Resposta enviada</p>
            <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{selected.response}</p>
            {selected.responded_at && <p className="text-xs text-stone-400 mt-3">Respondida em {new Date(selected.responded_at).toLocaleDateString('pt-BR')}</p>}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-line p-5 sm:p-6 mt-4 space-y-4">
            <h3 className="font-serif text-lg text-forest-900">Preparar resposta</h3>

            {/* Anotações → IA */}
            <div>
              <label className="text-sm font-medium text-stone-600 mb-1 block">Suas anotações para a resposta <span className="text-stone-400 font-normal">(opcional — a IA usa esses pontos)</span></label>
              <textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                rows={3}
                placeholder="Ex.: reforçar micro-pausas; sugerir check-in ao meio-dia; validar o cansaço; indicar o conteúdo sobre limites..."
                className={inputCls}
              />
              <button
                type="button"
                onClick={generateDraft}
                disabled={generating}
                className="mt-2 inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Gerando rascunho…' : 'Gerar resposta com IA'}
              </button>
              <p className="text-[11px] text-stone-400 mt-1.5">A IA cria um rascunho a partir do pedido da pessoa + suas anotações. Revise sempre antes de enviar.</p>
            </div>

            {/* Resposta editável */}
            <div>
              <label className="text-sm font-medium text-stone-600 mb-1 block">Resposta ao usuário</label>
              <textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                rows={9}
                placeholder="Escreva ou gere com IA a resposta de orientação. Você pode editar livremente antes de enviar."
                className={inputCls}
              />
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-stone-400">Ao enviar, o usuário é notificado no app e por e-mail (destino: Orientação).</p>
              <button
                onClick={respond}
                disabled={saving || !response.trim()}
                className="inline-flex items-center gap-2 bg-forest-700 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {saving ? 'Enviando…' : 'Enviar resposta'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Lista ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {toast && <Toast toast={toast} />}

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {gMetrics.map(m => (
          <div key={m.label} className="bg-white border border-line rounded-2xl p-4">
            <div className="flex items-center gap-2 text-ink-soft mb-1"><m.Icon className="w-4 h-4" /></div>
            <p className={`font-serif text-3xl ${m.tone}`}>{loading ? '—' : m.n}</p>
            <p className="text-xs text-ink-soft mt-1 leading-snug">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros de status com contagem */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {(['all', 'open', 'answered', 'closed'] as const).map(f => {
          const label = f === 'all' ? 'Todas' : f === 'open' ? 'Aguardando' : f === 'answered' ? 'Respondidas' : 'Fechadas'
          const active = statusFilter === f
          return (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${active ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-ink-soft hover:border-forest-300 hover:text-forest-900'}`}
            >
              {label}
              <span className={`text-[11px] px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-stone-100 text-stone-500'}`}>{statusCounts[f]}</span>
            </button>
          )
        })}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${showFilters ? 'bg-mint text-forest-800 border-forest-200' : 'bg-white border-line text-ink-soft hover:border-forest-300'}`}
        >
          <Filter className="w-3.5 h-3.5" /> Filtros
          {(planFilter !== 'all' || monthFilter !== 'all') && <span className="w-2 h-2 bg-forest-600 rounded-full" />}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 bg-stone-50 border border-line rounded-xl p-3">
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
              <button onClick={() => { setPlanFilter('all'); setMonthFilter('all') }} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1.5">Limpar filtros</button>
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-stone-100 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma orientação encontrada com os filtros aplicados.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(r => {
            const waiting = r.status === 'open'
            return (
              <button
                key={r.id}
                onClick={() => openRequest(r)}
                className={`w-full text-left bg-white rounded-2xl border p-4 transition-all hover:shadow-sm ${waiting ? 'border-amber-200 hover:border-amber-300' : 'border-line hover:border-stone-300'}`}
              >
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-xs font-semibold text-forest-700 flex-shrink-0 mt-0.5">
                    {initialsOf(r.user?.full_name, r.user?.email)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-forest-900 text-sm">{r.user?.full_name ?? 'Usuário'}</p>
                      {r.user?.plan && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[r.user.plan] ?? 'bg-stone-100'}`}>{PLAN_LABELS[r.user.plan] ?? r.user.plan}</span>}
                      <span className="text-xs text-stone-300">·</span>
                      <span className="text-xs text-stone-400 capitalize">{monthLabel(r.month_key)}</span>
                    </div>
                    {r.user?.email && <p className="text-xs text-stone-400">{r.user.email}</p>}
                    <p className="text-sm text-stone-600 line-clamp-2 mt-1">{r.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <StatusBadge status={r.status} />
                    <span className="text-[11px] text-stone-400 whitespace-nowrap">{timeAgo(r.created_at)}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'answered') return <span className="inline-flex items-center gap-1 text-[11px] bg-mint text-forest-800 px-2 py-0.5 rounded-full font-medium"><CheckCircle className="w-3 h-3" /> Respondida</span>
  if (status === 'closed') return <span className="text-[11px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">Fechada</span>
  return <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium"><Clock className="w-3 h-3" /> Aguardando</span>
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-stone-500 font-medium mb-0.5">{label}</p>
      <p className={`text-sm whitespace-pre-wrap leading-relaxed ${strong ? 'text-stone-800' : 'text-stone-600'}`}>{value}</p>
    </div>
  )
}

function Toast({ toast }: { toast: { msg: string; err?: boolean } }) {
  return (
    <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>
  )
}
