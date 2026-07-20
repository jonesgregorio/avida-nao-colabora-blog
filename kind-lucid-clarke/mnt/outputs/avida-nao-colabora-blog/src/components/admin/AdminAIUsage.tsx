import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Loader2, Cpu } from 'lucide-react'
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
  questionnaire: 'Questionário', trail: 'Trilha', notification: 'Notificação',
  support_template: 'Suporte', social_proof: 'Prova social', meditation: 'Meditação',
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

  // Resumo dos últimos registros: quantas gerações por provedor (só sucessos).
  const ok = logs.filter(l => l.status === 'success')
  const byProvider = new Map<string, number>()
  ok.forEach(l => byProvider.set(l.provider, (byProvider.get(l.provider) ?? 0) + 1))
  const providers = [...byProvider.entries()].sort((a, b) => b[1] - a[1])
  const fails = logs.filter(l => l.status !== 'success').length

  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900 flex items-center gap-2"><Cpu className="w-6 h-6 text-forest-600" /> Uso de IA</h1>
          <p className="text-sm text-ink-soft mt-1">Qual IA (Gemini/Groq) gerou cada conteúdo. O app sempre tenta o Gemini primeiro e cai no Groq só quando o Gemini está indisponível/limitado.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
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
