import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Loader2, Cpu, Download, PlayCircle, Search, X, FilterX } from 'lucide-react'
import { providerLabel } from '../../lib/aiContent'

interface UserHit {
  user_id: string
  email: string | null
  full_name: string | null
  plan: string | null
  subscription_status: string | null
}

const PLAN_LABEL: Record<string, string> = { free: 'Gratuito', essential: 'Essencial', plus: 'Plus', therapeutic: 'Plus', 'therapeutic-plus': 'Plus' }

interface Log {
  id: string
  content_type: string
  provider: string
  status: string
  error_msg: string | null
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  article: 'Artigo', article_cta: 'CTA de artigo', article_title: 'Título',
  article_summary: 'Resumo', article_seo: 'SEO', article_diary_question: 'Pergunta diário',
  questionnaire: 'Questionário', trail: 'Conteúdo legado', notification: 'Notificação',
  support_template: 'Suporte', social_proof: 'Prova social', meditation: 'Pausa emocional',
  emotional_exercise: 'Exercício', self_care_plan: 'Autocuidado',
  professional_comment: 'Comentário prof.', monthly_guidance: 'Orientação',
  plan_description: 'Descrição de plano', scheduled_content: 'Conteúdo programado',
  automated_content: 'Conteúdo automático', health_check: 'Teste de IA', generic: 'Geral',
  weekly_report: 'Relatório semanal', monthly_deep_report: 'Relatório mensal',
  emotional_map_explanation: 'Mapa emocional',
}
const typeLabel = (t: string) => TYPE_LABELS[t] ?? t

const EMOTIONAL_TYPES = new Set(['weekly_report', 'monthly_deep_report', 'self_care_plan', 'monthly_guidance', 'emotional_map_explanation'])
type Category = 'todos' | 'emocional' | 'editorial'
const categoryOf = (t: string): 'emocional' | 'editorial' => EMOTIONAL_TYPES.has(t) ? 'emocional' : 'editorial'

function providerBadge(p: string) {
  if (p === 'fallback') return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-stone-200 text-stone-700">Sem IA (fallback)</span>
  const isGemini = /gemini/i.test(p)
  const cls = isGemini ? 'bg-blue-100 text-blue-700' : /groq/i.test(p) ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${cls}`}>{providerLabel(p)}</span>
}

function statusLabel(status: string) {
  if (status === 'success') return 'Sucesso'
  if (status === 'fallback') return 'Fallback'
  return 'Erro'
}

function dateInRange(createdAt: string, from: string, to: string) {
  const value = Date.parse(createdAt)
  if (!Number.isFinite(value)) return false
  if (from) {
    const start = Date.parse(`${from}T00:00:00`)
    if (Number.isFinite(start) && value < start) return false
  }
  if (to) {
    const end = Date.parse(`${to}T23:59:59.999`)
    if (Number.isFinite(end) && value > end) return false
  }
  return true
}

export default function AdminAIUsage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [diagBusy, setDiagBusy] = useState(false)
  const [diagMsg, setDiagMsg] = useState<{ text: string; err?: boolean } | null>(null)
  const [diagMode, setDiagMode] = useState<'all' | 'weekly' | 'monthly'>('all')
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<UserHit[]>([])
  const [userSearching, setUserSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserHit | null>(null)

  // Etapa 7: filtros da Central de IA são independentes da busca de usuário
  // usada pelo diagnóstico emocional logo abaixo.
  const [category, setCategory] = useState<Category>('todos')
  const [logQuery, setLogQuery] = useState('')
  const [contentTypeFilter, setContentTypeFilter] = useState('todos')
  const [providerFilter, setProviderFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  async function load() {
    setLoading(true); setErr('')
    const { data, error } = await supabase
      .from('ai_generation_logs')
      .select('id, content_type, provider, status, error_msg, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) setErr(error.message)
    setLogs((data as Log[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function buscarUsuario() {
    const term = userQuery.trim()
    if (term.length < 3) { setUserResults([]); return }
    setUserSearching(true)
    const { data } = await supabase.from('profiles')
      .select('user_id, email, full_name, plan, subscription_status')
      .or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
      .limit(8)
    setUserResults((data as UserHit[]) ?? [])
    setUserSearching(false)
  }

  async function gerarDiagnostico() {
    setDiagBusy(true); setDiagMsg(null)
    try {
      let uid = selectedUser?.user_id
      if (!uid) {
        const { data: userData } = await supabase.auth.getUser()
        uid = userData.user?.id
      }
      if (!uid) throw new Error('Sessão inválida — faça login novamente.')
      const { data, error } = await supabase.functions.invoke('run-emotional-automations', {
        body: { userId: uid, mode: diagMode },
      })
      const res = data as { ok?: boolean; results?: string[]; error?: string } | null
      const msg = error?.message ?? res?.error
      if (msg) throw new Error(msg)
      const results = res?.results ?? []
      const alvo = selectedUser ? (selectedUser.email || selectedUser.full_name || 'usuário selecionado') : 'sua conta'
      setDiagMsg({
        text: results.length
          ? `Executado para ${alvo}: ${results.join(', ')}. Confira o resultado na lista abaixo (Atualizar).`
          : `Executado, mas nada foi gerado para ${alvo} — sem registros elegíveis no período (semana/mês atual), plano insuficiente para o modo escolhido, ou já existe um relatório/plano gerado para este ciclo.`,
      })
      load()
    } catch (e) {
      setDiagMsg({ text: 'Erro ao gerar: ' + (e instanceof Error ? e.message : 'desconhecido'), err: true })
    } finally {
      setDiagBusy(false)
    }
  }

  const contentTypes = [...new Set(logs.map(log => log.content_type).filter(Boolean))]
    .sort((a, b) => typeLabel(a).localeCompare(typeLabel(b), 'pt-BR'))
  const providerOptions = [...new Set(logs.map(log => log.provider).filter(Boolean))]
    .sort((a, b) => providerLabel(a).localeCompare(providerLabel(b), 'pt-BR'))

  // Uma única lista alimenta tabela, cartões e CSV. Assim os números sempre
  // correspondem exatamente aos filtros visíveis no Admin.
  const normalizedQuery = logQuery.trim().toLocaleLowerCase('pt-BR')
  const visibleLogs = logs.filter(log => {
    if (category !== 'todos' && categoryOf(log.content_type) !== category) return false
    if (contentTypeFilter !== 'todos' && log.content_type !== contentTypeFilter) return false
    if (providerFilter !== 'todos' && log.provider !== providerFilter) return false
    if (statusFilter !== 'todos' && log.status !== statusFilter) return false
    if (!dateInRange(log.created_at, dateFrom, dateTo)) return false
    if (normalizedQuery) {
      const haystack = [
        log.id, log.content_type, typeLabel(log.content_type), log.provider,
        providerLabel(log.provider), log.status, statusLabel(log.status), log.error_msg ?? '',
      ].join(' ').toLocaleLowerCase('pt-BR')
      if (!haystack.includes(normalizedQuery)) return false
    }
    return true
  })

  const hasDetailedFilters = !!(
    logQuery.trim() || contentTypeFilter !== 'todos' || providerFilter !== 'todos' ||
    statusFilter !== 'todos' || dateFrom || dateTo
  )
  function clearDetailedFilters() {
    setLogQuery('')
    setContentTypeFilter('todos')
    setProviderFilter('todos')
    setStatusFilter('todos')
    setDateFrom('')
    setDateTo('')
  }

  const ok = visibleLogs.filter(l => l.status === 'success')
  const byProvider = new Map<string, number>()
  ok.forEach(l => byProvider.set(l.provider, (byProvider.get(l.provider) ?? 0) + 1))
  const providers = [...byProvider.entries()].sort((a, b) => b[1] - a[1])
  const fallbackCount = visibleLogs.filter(l => l.status === 'fallback').length
  const fails = visibleLogs.filter(l => l.status !== 'success' && l.status !== 'fallback').length
  const aiAttempts = ok.length + fallbackCount
  const fallbackRate = aiAttempts > 0 ? Math.round((fallbackCount / aiAttempts) * 100) : 0
  const FALLBACK_ALERT_THRESHOLD = 30

  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  function exportCSV() {
    const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines: string[] = []
    const push = (arr: (string | number)[]) => lines.push(arr.map(esc).join(','))

    push(['Relatório de Uso de IA'])
    push(['Gerado em', new Date().toLocaleString('pt-BR')])
    push(['Registros no relatório', visibleLogs.length])
    lines.push('')

    push(['RESUMO POR PROVEDOR', 'Gerações (sucesso)', '% do total'])
    providers.forEach(([p, n]) => push([providerLabel(p), n, `${Math.round((n / Math.max(1, ok.length)) * 100)}%`]))
    if (fallbackCount > 0) push(['Fallback (rede de segurança, sem IA)', fallbackCount, `${fallbackRate}%`])
    if (fails > 0) push(['Erros técnicos (tentativas com falha)', fails, ''])
    lines.push('')

    push(['GERAÇÕES', 'Quando', 'Tipo', 'IA usada', 'Status', 'Erro'])
    visibleLogs.forEach(l => push([
      '', new Date(l.created_at).toLocaleString('pt-BR'), typeLabel(l.content_type),
      providerLabel(l.provider), statusLabel(l.status), l.error_msg ?? '',
    ]))

    const bom = String.fromCharCode(0xFEFF)
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `uso-ia-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectCls = 'border border-line rounded-xl bg-white text-sm px-3 py-2 text-forest-900 focus:outline-none focus:ring-2 focus:ring-stone-300'

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900 flex items-center gap-2"><Cpu className="w-6 h-6 text-forest-600" /> Central de IA</h1>
          <p className="text-sm text-ink-soft mt-1">Uma visão única das gerações editoriais e emocionais, com provedor, status e histórico para auditoria.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          <button onClick={exportCSV} disabled={loading || visibleLogs.length === 0} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">
            <Download className="w-4 h-4" /> Extrair relatório
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4" aria-label="Categoria das gerações">
        {([['todos', 'Tudo'], ['emocional', 'Emocional'], ['editorial', 'Editorial']] as [Category, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategory(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${category === key ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-forest-800 border-line hover:border-forest-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="bg-white border border-line rounded-2xl p-4 mb-6" aria-label="Filtros da Central de IA">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-sm font-medium text-forest-900">Filtrar gerações</p>
            <p className="text-xs text-ink-soft mt-0.5">{visibleLogs.length} de {logs.length} registros recentes.</p>
          </div>
          {hasDetailedFilters && (
            <button type="button" onClick={clearDetailedFilters} className="inline-flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-900">
              <FilterX className="w-3.5 h-3.5" /> Limpar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <label className="lg:col-span-2">
            <span className="block text-xs text-stone-500 mb-1">Buscar nos logs</span>
            <span className="relative block">
              <Search className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={logQuery}
                onChange={e => setLogQuery(e.target.value)}
                placeholder="Tipo, provedor, status ou erro"
                className="w-full pl-9 pr-3 py-2 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </span>
          </label>
          <label>
            <span className="block text-xs text-stone-500 mb-1">Tipo de conteúdo</span>
            <select value={contentTypeFilter} onChange={e => setContentTypeFilter(e.target.value)} className={`${selectCls} w-full`}>
              <option value="todos">Todos os tipos</option>
              {contentTypes.map(type => <option key={type} value={type}>{typeLabel(type)}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs text-stone-500 mb-1">Provedor</span>
            <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)} className={`${selectCls} w-full`}>
              <option value="todos">Todos os provedores</option>
              {providerOptions.map(provider => <option key={provider} value={provider}>{provider === 'fallback' ? 'Sem IA (fallback)' : providerLabel(provider)}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-xs text-stone-500 mb-1">Status</span>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${selectCls} w-full`}>
              <option value="todos">Todos os status</option>
              <option value="success">Sucesso</option>
              <option value="fallback">Fallback</option>
              <option value="error">Erro</option>
            </select>
          </label>
          <label>
            <span className="block text-xs text-stone-500 mb-1">Data inicial</span>
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} className={`${selectCls} w-full`} />
          </label>
          <label>
            <span className="block text-xs text-stone-500 mb-1">Data final</span>
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className={`${selectCls} w-full`} />
          </label>
        </div>
      </section>

      <div className="bg-white border border-line rounded-2xl p-5 mb-6">
        <p className="text-sm font-medium text-forest-900">Diagnóstico da IA emocional</p>
        <p className="text-xs text-ink-soft mt-0.5 mb-3">Gera relatório semanal/mensal e plano de autocuidado agora, para ver o motivo real de um eventual fallback sem esperar o cron diário. Semanal exige Essencial ou Plus; mensal e plano de autocuidado exigem Plus.</p>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={userQuery}
              onChange={e => { setUserQuery(e.target.value); setSelectedUser(null) }}
              onKeyDown={e => { if (e.key === 'Enter') buscarUsuario() }}
              placeholder="Buscar usuário por e-mail ou nome (ou deixe em branco para gerar na sua própria conta)"
              className="w-full pl-9 pr-3 py-2 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
          </div>
          <button onClick={buscarUsuario} disabled={userSearching || userQuery.trim().length < 3} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300 disabled:opacity-50">
            {userSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
          </button>
          <select value={diagMode} onChange={e => setDiagMode(e.target.value as typeof diagMode)} className={selectCls}>
            <option value="all">Semanal + mensal + autocuidado</option>
            <option value="weekly">Só semanal</option>
            <option value="monthly">Só mensal (inclui autocuidado)</option>
          </select>
        </div>

        {userResults.length > 0 && !selectedUser && (
          <div className="border border-line rounded-xl divide-y divide-line mb-3 max-h-56 overflow-y-auto">
            {userResults.map(u => (
              <button key={u.user_id} onClick={() => { setSelectedUser(u); setUserResults([]) }} className="w-full text-left px-3 py-2 text-sm hover:bg-mint flex items-center justify-between gap-2">
                <span>{u.full_name || u.email || u.user_id}<span className="text-ink-soft"> · {u.email}</span></span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-mint text-forest-700 shrink-0">{PLAN_LABEL[u.plan ?? 'free'] ?? u.plan}</span>
              </button>
            ))}
          </div>
        )}
        {userQuery.trim().length >= 3 && userResults.length === 0 && !userSearching && !selectedUser && (
          <p className="text-xs text-ink-soft mb-3">Nenhum usuário encontrado — clique em Buscar após digitar.</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {selectedUser ? (
            <span className="inline-flex items-center gap-2 bg-mint text-forest-800 text-sm px-3 py-1.5 rounded-xl">
              Alvo: {selectedUser.full_name || selectedUser.email} ({PLAN_LABEL[selectedUser.plan ?? 'free'] ?? selectedUser.plan})
              <button onClick={() => { setSelectedUser(null); setUserQuery('') }} className="hover:text-forest-900" aria-label="Remover usuário selecionado"><X className="w-3.5 h-3.5" /></button>
            </span>
          ) : (
            <span className="text-sm text-ink-soft">Alvo: sua própria conta (nenhum usuário selecionado)</span>
          )}
          <button onClick={gerarDiagnostico} disabled={diagBusy} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50 shrink-0">
            {diagBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />} Gerar agora
          </button>
        </div>
        {diagMsg && <p className={`w-full text-sm mt-3 ${diagMsg.err ? 'text-red-600' : 'text-forest-700'}`}>{diagMsg.text}</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {providers.length === 0 && !loading ? (
          <div className="col-span-full bg-white border border-line rounded-2xl p-5 text-sm text-ink-soft">Nenhuma geração registrada neste filtro.</div>
        ) : providers.map(([p, n]) => (
          <div key={p} className="bg-white border border-line rounded-2xl p-5">
            <div className="mb-2">{providerBadge(p)}</div>
            <p className="font-serif text-3xl text-forest-900">{n}</p>
            <p className="text-sm text-ink-soft mt-1">gerações ({Math.round((n / Math.max(1, ok.length)) * 100)}% do total)</p>
          </div>
        ))}
        {fallbackCount > 0 && (
          <div className={`bg-white border rounded-2xl p-5 ${fallbackRate >= FALLBACK_ALERT_THRESHOLD ? 'border-amber-300' : 'border-line'}`}>
            <div className="mb-2"><span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-stone-200 text-stone-700">Fallback</span></div>
            <p className="font-serif text-3xl text-forest-900">{fallbackCount}</p>
            <p className="text-sm text-ink-soft mt-1">{fallbackRate}% das tentativas filtradas — rede de segurança, sem IA de verdade</p>
          </div>
        )}
        {fails > 0 && (
          <div className="bg-white border border-line rounded-2xl p-5">
            <div className="mb-2"><span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Erros</span></div>
            <p className="font-serif text-3xl text-forest-900">{fails}</p>
            <p className="text-sm text-ink-soft mt-1">tentativas com erro técnico no filtro atual</p>
          </div>
        )}
      </div>

      {fallbackRate >= FALLBACK_ALERT_THRESHOLD && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-6 text-sm text-amber-900">
          <strong>{fallbackRate}%</strong> das tentativas filtradas caíram no fallback determinístico em vez de usar IA de verdade. Vale checar se as chaves de IA estão configuradas e com cota disponível.
        </div>
      )}

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-3">
          <h2 className="font-serif text-lg text-forest-900">Gerações recentes</h2>
          <span className="text-xs text-ink-soft">{visibleLogs.length} registro(s)</span>
        </div>
        {err && <p className="px-5 py-3 text-sm text-red-600">Erro ao carregar: {err}</p>}
        {loading ? (
          <p className="px-5 py-6 text-sm text-ink-soft flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
        ) : visibleLogs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-soft">Sem registros para os filtros atuais.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-line">
                <tr>
                  <th className="text-left px-4 py-2 text-stone-500 font-medium">Quando</th>
                  <th className="text-left px-4 py-2 text-stone-500 font-medium">Tipo</th>
                  <th className="text-left px-4 py-2 text-stone-500 font-medium">IA usada</th>
                  <th className="text-left px-4 py-2 text-stone-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibleLogs.map(l => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 text-ink-soft whitespace-nowrap">{fmt(l.created_at)}</td>
                    <td className="px-4 py-2 text-forest-900">{typeLabel(l.content_type)}</td>
                    <td className="px-4 py-2">{providerBadge(l.provider)}</td>
                    <td className="px-4 py-2">
                      {l.status === 'success'
                        ? <span className="text-forest-700">✓ sucesso</span>
                        : l.status === 'fallback'
                          ? <span className="text-stone-600" title={l.error_msg ?? undefined}>↺ fallback</span>
                          : <span className="text-red-600" title={l.error_msg ?? undefined}>✕ erro</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
