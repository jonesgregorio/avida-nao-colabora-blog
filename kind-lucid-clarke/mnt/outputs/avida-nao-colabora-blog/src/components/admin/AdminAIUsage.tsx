import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Loader2, Cpu, Download, PlayCircle, Search, X } from 'lucide-react'
import { providerLabel } from '../../lib/aiContent'

interface UserHit {
  user_id: string
  email: string | null
  full_name: string | null
  plan: string | null
  subscription_status: string | null
}

const PLAN_LABEL: Record<string, string> = { free: 'Gratuito', essential: 'Essencial', plus: 'Plus', therapeutic: 'Plus', 'therapeutic-plus': 'Plus' }

// Histórico de uso de IA — lê ai_generation_logs (RLS: só admin, migration 026).
// Mostra, por geração, QUAL provedor (Gemini/Groq) foi usado, o tipo e o status.
// Responde à pergunta "qual IA estou usando?" com dados reais, não dedução.

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
}
const typeLabel = (t: string) => TYPE_LABELS[t] ?? t

function providerBadge(p: string) {
  // "fallback" (§17): a IA não respondeu e o texto determinístico assumiu —
  // diferente de um erro técnico, então tem cor e rótulo próprios em vez de
  // aparecer como se o Gemini tivesse gerado o conteúdo.
  if (p === 'fallback') return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-stone-200 text-stone-700">Sem IA (fallback)</span>
  const isGemini = /gemini/i.test(p)
  const cls = isGemini ? 'bg-blue-100 text-blue-700' : /groq/i.test(p) ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${cls}`}>{providerLabel(p)}</span>
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

  // Busca usuário por e-mail/nome para escolher QUEM vai receber a geração de
  // teste — nem todo usuário é elegível (semanal exige Essencial+, mensal e
  // plano de autocuidado exigem Plus), então mostra o plano de cada resultado.
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

  // Diagnóstico sob demanda: não existia forma de gerar relatório/plano de
  // autocuidado fora do cron diário. Roda run-emotional-automations agora —
  // por padrão na própria conta do admin, ou num usuário elegível escolhido
  // pela busca acima — para que o erro real de cada provedor apareça aqui
  // embaixo sem esperar o próximo ciclo. Precisa de dados elegíveis (registros
  // de diário no período) para de fato tentar a IA — senão a tarefa é ignorada.
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

  // Resumo dos últimos registros: quantas gerações por provedor (só sucessos
  // de IA de verdade — fallback determinístico não é um provedor).
  const ok = logs.filter(l => l.status === 'success')
  const byProvider = new Map<string, number>()
  ok.forEach(l => byProvider.set(l.provider, (byProvider.get(l.provider) ?? 0) + 1))
  const providers = [...byProvider.entries()].sort((a, b) => b[1] - a[1])
  // §17: fallback é rede de segurança (a IA não respondeu, texto determinístico
  // assumiu), diferente de erro técnico (429/timeout/5xx) — métricas separadas
  // em vez de uma única contagem de "falhas" que confundia as duas coisas.
  const fallbackCount = logs.filter(l => l.status === 'fallback').length
  const fails = logs.filter(l => l.status !== 'success' && l.status !== 'fallback').length
  const aiAttempts = ok.length + fallbackCount
  const fallbackRate = aiAttempts > 0 ? Math.round((fallbackCount / aiAttempts) * 100) : 0
  // Limiar de alerta (§17): acima disso, a rede de segurança virou o caminho
  // principal em vez de exceção — vale investigar chaves/cota dos provedores.
  const FALLBACK_ALERT_THRESHOLD = 30

  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  // Exporta o relatório (resumo + gerações) em CSV que o Excel abre direto.
  function exportCSV() {
    const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines: string[] = []
    const push = (arr: (string | number)[]) => lines.push(arr.map(esc).join(','))

    push(['Relatório de Uso de IA'])
    push(['Gerado em', new Date().toLocaleString('pt-BR')])
    push(['Registros no relatório', logs.length])
    lines.push('')

    push(['RESUMO POR PROVEDOR', 'Gerações (sucesso)', '% do total'])
    providers.forEach(([p, n]) => push([providerLabel(p), n, `${Math.round((n / Math.max(1, ok.length)) * 100)}%`]))
    if (fallbackCount > 0) push(['Fallback (rede de segurança, sem IA)', fallbackCount, `${fallbackRate}%`])
    if (fails > 0) push(['Erros técnicos (tentativas com falha)', fails, ''])
    lines.push('')

    push(['GERAÇÕES', 'Quando', 'Tipo', 'IA usada', 'Status', 'Erro'])
    logs.forEach(l => push([
      '', new Date(l.created_at).toLocaleString('pt-BR'), typeLabel(l.content_type),
      providerLabel(l.provider), l.status === 'success' ? 'sucesso' : l.status === 'fallback' ? 'fallback' : 'erro', l.error_msg ?? '',
    ]))

    // BOM (via charCode p/ não usar espaço irregular no fonte) => acentos no Excel.
    const bom = String.fromCharCode(0xFEFF)
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `uso-ia-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900 flex items-center gap-2"><Cpu className="w-6 h-6 text-forest-600" /> Uso de IA</h1>
          <p className="text-sm text-ink-soft mt-1">Qual IA (Gemini/Groq) gerou cada conteúdo. O app sempre tenta o Gemini primeiro e cai no Groq só quando o Gemini está indisponível/limitado.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          <button onClick={exportCSV} disabled={loading || logs.length === 0} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">
            <Download className="w-4 h-4" /> Extrair relatório
          </button>
        </div>
      </div>

      {/* Diagnóstico sob demanda: gera relatório/plano de autocuidado agora
          — na própria conta do admin ou num usuário elegível escolhido por
          busca — para revelar o erro real de cada provedor de IA sem esperar
          o cron diário. Elegibilidade: semanal exige Essencial+; mensal e
          plano de autocuidado exigem Plus. */}
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
          <select value={diagMode} onChange={e => setDiagMode(e.target.value as typeof diagMode)} className="border border-line rounded-xl text-sm px-3 py-2">
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
              <button onClick={() => { setSelectedUser(null); setUserQuery('') }} className="hover:text-forest-900"><X className="w-3.5 h-3.5" /></button>
            </span>
          ) : (
            <span className="text-sm text-ink-soft">Alvo: sua própria conta (nenhum usuário selecionado)</span>
          )}
          <button onClick={gerarDiagnostico} disabled={diagBusy} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50 shrink-0">
            {diagBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />} Gerar agora
          </button>
        </div>
        {diagMsg && (
          <p className={`w-full text-sm mt-3 ${diagMsg.err ? 'text-red-600' : 'text-forest-700'}`}>{diagMsg.text}</p>
        )}
      </div>

      {/* Resumo por provedor */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {providers.length === 0 && !loading ? (
          <div className="col-span-full bg-white border border-line rounded-2xl p-5 text-sm text-ink-soft">Nenhuma geração registrada ainda.</div>
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
            <p className="text-sm text-ink-soft mt-1">{fallbackRate}% das tentativas de IA emocional — rede de segurança, sem IA de verdade</p>
          </div>
        )}
        {fails > 0 && (
          <div className="bg-white border border-line rounded-2xl p-5">
            <div className="mb-2"><span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Erros</span></div>
            <p className="font-serif text-3xl text-forest-900">{fails}</p>
            <p className="text-sm text-ink-soft mt-1">tentativas com erro técnico (fora o fallback)</p>
          </div>
        )}
      </div>

      {/* §17: alerta quando o fallback deixou de ser exceção e virou o caminho
          principal das automações emocionais — vale checar cota/chaves dos
          provedores em vez de deixar passar despercebido. */}
      {fallbackRate >= FALLBACK_ALERT_THRESHOLD && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-6 text-sm text-amber-900">
          <strong>{fallbackRate}%</strong> das gerações de IA emocional (relatórios, plano de autocuidado, mapa) recentes caíram no fallback determinístico em vez de usar IA de verdade. Vale checar se as chaves de IA (Gemini/Groq/OpenAI) estão configuradas e com cota disponível.
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-line"><h2 className="font-serif text-lg text-forest-900">Gerações recentes</h2></div>
        {err && <p className="px-5 py-3 text-sm text-red-600">Erro ao carregar: {err}</p>}
        {loading ? (
          <p className="px-5 py-6 text-sm text-ink-soft flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
        ) : logs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-soft">Sem registros. Assim que você gerar algum conteúdo com IA, aparece aqui.</p>
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
                {logs.map(l => (
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
