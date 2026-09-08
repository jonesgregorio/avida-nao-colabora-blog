import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logAdminAction } from '../../lib/adminAudit'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'

interface QueuesData {
  generated_at?: string
  queues?: Record<string, number>
  failures_active?: Record<string, number>
  failures_24h?: Record<string, number>
  failures_total?: Record<string, number>
}

const QUEUE_ROWS: { key: string; label: string; alert?: boolean }[] = [
  { key: 'personalization_pending', label: 'Personalização aguardando geração' },
  { key: 'personalization_overdue', label: 'Personalização vencida (não gerada)', alert: true },
  { key: 'reports_building', label: 'Relatórios em processamento' },
  { key: 'care_plans_pending', label: 'Planos de autocuidado aguardando' },
  { key: 'notifications_draft', label: 'Notificações não enviadas' },
  { key: 'content_jobs_running', label: 'Jobs de conteúdo em execução' },
  { key: 'webhooks_stuck', label: 'Webhooks travados há +1h', alert: true },
]

const FAILURE_ROWS: { key: string; label: string }[] = [
  { key: 'reports_failed', label: 'Relatórios com falha' },
  { key: 'care_plans_failed', label: 'Planos de autocuidado com falha' },
  { key: 'emails_failed', label: 'E-mails com falha' },
  { key: 'ai_errors', label: 'Gerações de IA com erro' },
  { key: 'content_jobs_failed', label: 'Jobs de conteúdo com falha' },
  { key: 'webhooks_failed', label: 'Webhooks do Stripe com falha' },
]

function dotColor(value: number, alert = false): string {
  if (value <= 0) return 'bg-forest-500'
  return alert ? 'bg-red-500' : 'bg-amber-500'
}

export default function AdminQueuesFailures() {
  const [data, setData] = useState<QueuesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notAvailable, setNotAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requeueing, setRequeueing] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null); setNotAvailable(false)
    const { data: res, error: err } = await supabase.rpc('admin_queues_overview')
    if (err) {
      if (/admin_queues_overview|does not exist|schema cache/i.test(err.message)) setNotAvailable(true)
      else setError(err.message)
      setData(null)
    } else {
      setData((res ?? {}) as QueuesData)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function requeueOverdue() {
    const overdue = data?.queues?.personalization_overdue ?? 0
    if (!window.confirm(`Reprocessar ${overdue} tarefa(s) de personalização vencida(s)? Elas voltam para a fila de geração de rascunho — nada é enviado ao usuário.`)) return
    setRequeueing(true); setMsg(null)
    const { data: n, error: err } = await supabase.rpc('admin_requeue_overdue_personalization')
    if (err) {
      setMsg({ ok: false, text: 'Não foi possível reprocessar: ' + err.message })
    } else {
      const count = Number(n ?? 0)
      void logAdminAction('config', 'queue_reprocess', 'personalization_overdue', { requeued: count })
      setMsg({ ok: true, text: `${count} tarefa(s) devolvida(s) para a fila. O próximo ciclo automático vai processá-las.` })
      void load()
    }
    setRequeueing(false)
  }

  const activeFailures = data?.failures_active ?? data?.failures_24h ?? {}
  const totalActive = FAILURE_ROWS.reduce((sum, row) => sum + (activeFailures[row.key] ?? 0), 0)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-serif text-2xl text-forest-900">Filas e falhas</h2>
          <p className="text-sm text-ink-soft mt-0.5">O que ainda precisa de ação agora, separado do histórico recente.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 text-sm border border-line bg-white px-3.5 py-2 rounded-xl hover:border-forest-300 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {notAvailable ? (
        <p className="rounded-xl bg-stone-50 border border-line p-4 text-sm text-stone-500">
          A visão consolidada de filas fica disponível após a migration desta correção ser aplicada.
        </p>
      ) : error ? (
        <p className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">Não foi possível carregar: {error}</p>
      ) : (
        <div className="space-y-6">
          <section className="bg-white border border-line rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-forest-900 mb-3">Filas</h3>
            <div className="divide-y divide-line">
              {QUEUE_ROWS.map(row => {
                const v = data?.queues?.[row.key] ?? 0
                return (
                  <div key={row.key} className="flex items-center gap-3 py-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(v, row.alert)}`} />
                    <span className="flex-1 text-sm text-ink">{row.label}</span>
                    <span className={`text-sm font-semibold tabular-nums ${v > 0 ? 'text-forest-900' : 'text-stone-400'}`}>{loading ? '—' : v}</span>
                  </div>
                )
              })}
            </div>
            {(data?.queues?.personalization_overdue ?? 0) > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-800 flex-1">Há personalizações vencidas que ainda não geraram rascunho.</span>
                <button
                  onClick={requeueOverdue}
                  disabled={requeueing}
                  className="text-xs bg-forest-900 text-white px-3 py-1.5 rounded-lg hover:bg-forest-800 disabled:opacity-50"
                >
                  {requeueing ? 'Reprocessando…' : 'Reprocessar agora'}
                </button>
              </div>
            )}
            {msg && (
              <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${msg.ok ? 'bg-mint/50 text-forest-800 border border-forest-100' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {msg.text}
              </div>
            )}
          </section>

          <section className="bg-white border border-line rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-forest-900">Falhas ativas</h3>
              {!loading && (
                totalActive === 0
                  ? <span className="inline-flex items-center gap-1 text-xs text-forest-700"><CheckCircle2 className="w-3.5 h-3.5" /> nenhuma</span>
                  : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{totalActive}</span>
              )}
            </div>
            <div className="divide-y divide-line">
              {FAILURE_ROWS.map(row => {
                const active = activeFailures[row.key] ?? 0
                const recent = data?.failures_24h?.[row.key] ?? 0
                const total = data?.failures_total?.[row.key]
                return (
                  <div key={row.key} className="flex items-center gap-3 py-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active > 0 ? 'bg-red-500' : 'bg-forest-500'}`} />
                    <span className="flex-1 text-sm text-ink">{row.label}</span>
                    {recent > active && <span className="text-[11px] text-stone-400">{recent} ocorrência(s) em 24h</span>}
                    {total != null && total > recent && <span className="hidden sm:inline text-[11px] text-stone-400">{total} histórico(s)</span>}
                    <span className={`text-sm font-semibold tabular-nums ${active > 0 ? 'text-red-600' : 'text-stone-400'}`}>{loading ? '—' : active}</span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[11px] text-stone-400">
              IA e e-mail deixam de ser “ativos” quando uma tentativa posterior da mesma frente tem sucesso. O histórico de 24h continua visível como contexto, sem inflar a fila operacional.
            </p>
          </section>

          {data?.generated_at && (
            <p className="text-[11px] text-stone-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3" /> atualizado {new Date(data.generated_at).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}