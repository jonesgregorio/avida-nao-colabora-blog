import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { MessageSquare, CheckCircle, Clock, Send, Loader2, Filter } from 'lucide-react'
import AIContentAssistant from './AIContentAssistant'
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

const inputCls = "w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

function getMonthOptions() {
  const opts: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    opts.push(key)
  }
  return opts
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
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const [showAI, setShowAI] = useState(false)

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    // user_id referencia auth.users (não profiles), então o embed do PostgREST
    // (user:profiles) falha com 400 PGRST200. Buscamos os pedidos e resolvemos
    // os dados do usuário (nome, e-mail, plano) numa segunda consulta.
    const { data: rows } = await supabase
      .from('monthly_guidance_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    const list = (rows ?? []) as GuidanceRequest[]
    const ids = [...new Set(list.map(r => r.user_id).filter(Boolean))]
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, plan')
        .in('user_id', ids)
      const byId = new Map(
        (profs ?? []).map((p: { user_id: string; full_name?: string; email?: string; plan?: string }) => [p.user_id, p]),
      )
      list.forEach(r => {
        const p = byId.get(r.user_id)
        r.user = p ? { full_name: p.full_name ?? undefined, email: p.email ?? undefined, plan: p.plan ?? undefined } : undefined
      })
    }
    setRequests(list)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (planFilter !== 'all' && r.user?.plan !== planFilter) return false
    if (monthFilter !== 'all' && r.month_key !== monthFilter) return false
    return true
  })

  const openCount = requests.filter(r => r.status === 'open').length

  async function respond() {
    if (!selected || !response.trim()) return
    setSaving(true)
    const respondedAt = new Date().toISOString()
    const { error } = await supabase
      .from('monthly_guidance_requests')
      .update({
        response: response.trim(),
        status: 'answered',
        responded_at: respondedAt,
        updated_at: respondedAt,
      })
      .eq('id', selected.id)
    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }

    await supabase.from('notifications').insert({
      user_id: selected.user_id,
      title: 'Sua orientação foi respondida',
      body: `Sua orientação de ${monthLabel(selected.month_key)} foi respondida. Confira no Mapa Emocional.`,
      type: 'system',
      action_view: 'my-evolution',
      action_label: 'Ver orientação',
      is_read: false,
    })

    void emailGuidanceAnsweredForUser(selected.user_id, selected.id, respondedAt)

    showToast('Resposta enviada e usuário notificado!')
    setSaving(false)
    setSelected(null)
    setResponse('')
    load()
  }

  const monthOptions = getMonthOptions()

  // Métricas do mockup (#orientacao).
  const nowD = new Date()
  const answeredThisMonth = requests.filter(r =>
    r.status === 'answered' && r.responded_at &&
    new Date(r.responded_at).getMonth() === nowD.getMonth() &&
    new Date(r.responded_at).getFullYear() === nowD.getFullYear()).length
  const gMetrics = [
    { n: openCount, label: 'Aguardando resposta' },
    { n: 0, label: 'Vence hoje' },
    { n: 0, label: 'Em revisão' },
    { n: answeredThisMonth, label: 'Respondidas no mês' },
  ]

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>
          {toast.msg}
        </div>
      )}

      <div className="mb-5">
        <h1 className="font-serif text-3xl text-forest-900">Orientação profissional</h1>
        <p className="text-sm text-ink-soft mt-1">Responda mensagens mensais e revise comentários do plano Plus.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {gMetrics.map(m => (
          <div key={m.label} className="bg-white border border-line rounded-2xl p-5">
            <p className="font-serif text-3xl text-forest-900">{loading ? '—' : m.n}</p>
            <p className="text-sm text-ink-soft mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {(['all', 'open', 'answered', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === f ? 'bg-forest-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            {f === 'all' ? 'Todas' : f === 'open' ? 'Aguardando' : f === 'answered' ? 'Respondidas' : 'Fechadas'}
          </button>
        ))}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-mint text-forest-800' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
        >
          <Filter className="w-3.5 h-3.5" /> Filtros
          {(planFilter !== 'all' || monthFilter !== 'all') && (
            <span className="w-2 h-2 bg-forest-600 rounded-full" />
          )}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 bg-stone-50 border border-line rounded-xl p-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Plano</label>
            <select
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
              className="text-sm px-2 py-1.5 border border-line rounded-lg bg-white focus:outline-none"
            >
              <option value="all">Todos os planos</option>
              {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Mês</label>
            <select
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="text-sm px-2 py-1.5 border border-line rounded-lg bg-white focus:outline-none"
            >
              <option value="all">Todos os meses</option>
              {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
          {(planFilter !== 'all' || monthFilter !== 'all') && (
            <div className="flex items-end">
              <button
                onClick={() => { setPlanFilter('all'); setMonthFilter('all') }}
                className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1.5"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {selected ? (
        <div className="max-w-2xl space-y-5">
          <button onClick={() => { setSelected(null); setResponse('') }} className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1">
            ← Voltar
          </button>

          <div className="bg-white rounded-xl border border-line p-5 space-y-3">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold text-forest-900">{selected.user?.full_name ?? 'Usuário'}</p>
                {selected.user?.email && (
                  <p className="text-xs text-stone-400">{selected.user.email}</p>
                )}
                <p className="text-xs text-stone-400">{monthLabel(selected.month_key)} · {new Date(selected.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selected.user?.plan && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[selected.user.plan] ?? 'bg-stone-100'}`}>
                    {PLAN_LABELS[selected.user.plan] ?? selected.user.plan}
                  </span>
                )}
                <span className={`text-xs px-2 py-1 rounded-full ${selected.status === 'answered' ? 'bg-mint text-forest-800' : selected.status === 'closed' ? 'bg-stone-100 text-stone-500' : 'bg-amber-100 text-amber-700'}`}>
                  {selected.status === 'answered' ? 'Respondida' : selected.status === 'closed' ? 'Fechada' : 'Aguardando'}
                </span>
              </div>
            </div>

            <div className="space-y-3 bg-stone-50 rounded-lg p-4">
              <div>
                <p className="text-xs text-stone-500 font-medium mb-1">Sobre o que quer orientação</p>
                <p className="text-sm text-stone-700">{selected.message}</p>
              </div>
              {selected.context && (
                <div>
                  <p className="text-xs text-stone-500 font-medium mb-1">O que já tentou</p>
                  <p className="text-sm text-stone-600">{selected.context}</p>
                </div>
              )}
              {selected.expected_help && (
                <div>
                  <p className="text-xs text-stone-500 font-medium mb-1">Tipo de ajuda esperada</p>
                  <p className="text-sm text-stone-600">{selected.expected_help}</p>
                </div>
              )}
            </div>

            {selected.response ? (
              <div className="bg-mint border border-mint rounded-lg p-4">
                <p className="text-xs text-forest-700 font-medium mb-1">Resposta enviada</p>
                <p className="text-sm text-stone-700">{selected.response}</p>
                {selected.responded_at && (
                  <p className="text-xs text-stone-400 mt-2">{new Date(selected.responded_at).toLocaleDateString('pt-BR')}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-stone-600 font-medium">Resposta</label>
                  <button
                    type="button"
                    onClick={() => setShowAI(true)}
                    className="flex items-center gap-1 text-xs text-forest-800 bg-mint border border-forest-200 px-2.5 py-1 rounded-lg hover:bg-mint font-medium"
                  >
                    ✦ Rascunho com IA
                  </button>
                </div>
                {showAI && (
                  <AIContentAssistant
                    contentType="monthly_guidance"
                    contextTitle={selected.message}
                    defaultTone="acolhedor"
                    label="Gerar rascunho de resposta"
                    onInsert={text => { setResponse(text); setShowAI(false) }}
                    onClose={() => setShowAI(false)}
                  />
                )}
                <textarea
                  value={response}
                  onChange={e => setResponse(e.target.value)}
                  rows={6}
                  placeholder="Escreva sua resposta de orientação mensal..."
                  className={inputCls}
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={respond}
                    disabled={saving || !response.trim()}
                    className="flex items-center gap-2 bg-forest-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {saving ? 'Enviando...' : 'Enviar resposta + Notificar usuário'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {loading ? (
            <p className="text-stone-400 text-sm">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-stone-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma orientação encontrada com os filtros aplicados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => (
                <div
                  key={r.id}
                  className="bg-white rounded-xl border border-line p-4 hover:border-stone-300 cursor-pointer transition-colors"
                  onClick={() => { setSelected(r); setResponse(r.response ?? '') }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="font-medium text-forest-900 text-sm">{r.user?.full_name ?? 'Usuário'}</p>
                        {r.user?.plan && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[r.user.plan] ?? 'bg-stone-100'}`}>
                            {PLAN_LABELS[r.user.plan] ?? r.user.plan}
                          </span>
                        )}
                        <span className="text-xs text-stone-400">·</span>
                        <span className="text-xs text-stone-400">{monthLabel(r.month_key)}</span>
                      </div>
                      {r.user?.email && (
                        <p className="text-xs text-stone-400 mb-1">{r.user.email}</p>
                      )}
                      <p className="text-sm text-stone-600 line-clamp-2">{r.message}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {r.status === 'open' ? (
                        <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                          <Clock className="w-3 h-3" /> Aguardando
                        </span>
                      ) : r.status === 'answered' ? (
                        <span className="flex items-center gap-1 text-xs bg-mint text-forest-800 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Respondida
                        </span>
                      ) : (
                        <span className="text-xs bg-stone-100 text-stone-500 px-2 py-1 rounded-full">Fechada</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-stone-400 mt-2">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
