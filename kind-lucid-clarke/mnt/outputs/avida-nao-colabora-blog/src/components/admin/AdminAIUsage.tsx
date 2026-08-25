import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Loader2, Cpu, Download, PlayCircle } from 'lucide-react'
import { providerLabel } from '../../lib/aiContent'

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

  // Diagnóstico sob demanda: não existia forma de gerar relatório/plano de
  // autocuidado fora do cron diário. Roda run-emotional-automations agora,
  // restrito à PRÓPRIA conta do admin (nunca dispara para outros usuários
  // reais), para que o erro real de cada provedor apareça aqui embaixo sem
  // esperar o próximo ciclo. Precisa de dados elegíveis (registros de diário
  // no período) para de fato tentar a IA — senão a tarefa é só ignorada.
  async function gerarDiagnostico() {
    setDiagBusy(true); setDiagMsg(null)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) throw new Error('Sessão inválida — faça login novamente.')
      const { data, error } = await supabase.functions.invoke('run-emotional-automations', {
        body: { userId: uid, mode: 'all' },
      })
      const res = data as { ok?: boolean; results?: string[]; error?: string } | null
      const msg = error?.message ?? res?.error
      if (msg) throw new Error(msg)
      const results = res?.results ?? []
      setDiagMsg({
        text: results.length
          ? `Executado: ${results.join(', ')}. Confira o resultado na lista abaixo (Atualizar).`
          : 'Executado, mas nada foi gerado — sua conta não tem registros elegíveis no período (semana/mês atual) ou já existe um relatório/plano gerado para este ciclo.',
      })
      load()
    } catch (e) {
      setDiagMsg({ text: 'Erro ao gerar: ' + (e instanceof Error ? e.message : 'desconhecido'), err: true })
    } finally {
      setDiagBusy(false)
    }
  }

  // Resumo dos últimos registros: quantas gerações por provedor (só sucessos).
  const ok = logs.filter(l => l.status === 'success')
  const byProvider = new Map<string, number>()
  ok.forEach(l => byProvider.set(l.provider, (byProvider.get(l.provider) ?? 0) + 1))
  const providers = [...byProvider.entries()].sort((a, b) => b[1] - a[1])
  const fails = logs.filter(l => l.status !== 'success').length

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
    if (fails > 0) push(['Falhas (tentativas com erro)', fails, ''])
    lines.push('')

    push(['GERAÇÕES', 'Quando', 'Tipo', 'IA usada', 'Status', 'Erro'])
    logs.forEach(l => push([
      '', new Date(l.created_at).toLocaleString('pt-BR'), typeLabel(l.content_type),
      providerLabel(l.provider), l.status === 'success' ? 'sucesso' : 'erro', l.error_msg ?? '',
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

      {/* Diagnóstico sob demanda: gera relatório/plano de autocuidado agora,
          só para a própria conta do admin, para revelar o erro real de cada
          provedor de IA sem esperar o cron diário. */}
      <div className="bg-white border border-line rounded-2xl p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-forest-900">Diagnóstico da IA emocional</p>
          <p className="text-xs text-ink-soft mt-0.5">Gera relatório semanal/mensal e plano de autocuidado agora, só para esta conta (admin), para ver o motivo real de um eventual fallback sem esperar o cron diário.</p>
        </div>
        <button onClick={gerarDiagnostico} disabled={diagBusy} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50 shrink-0">
          {diagBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />} Gerar agora (minha conta)
        </button>
        {diagMsg && (
          <p className={`w-full text-sm ${diagMsg.err ? 'text-red-600' : 'text-forest-700'}`}>{diagMsg.text}</p>
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
        {fails > 0 && (
          <div className="bg-white border border-line rounded-2xl p-5">
            <div className="mb-2"><span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Falhas</span></div>
            <p className="font-serif text-3xl text-forest-900">{fails}</p>
            <p className="text-sm text-ink-soft mt-1">tentativas com erro</p>
          </div>
        )}
      </div>

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
