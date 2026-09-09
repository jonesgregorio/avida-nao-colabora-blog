import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, CheckCircle2, HeartHandshake, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AdminLivingCarePlanWorkspace from './AdminLivingCarePlanWorkspace'

type Dashboard = {
  month_reference?: string
  total?: number
  ready?: number
  insufficient_activity?: number
  pending_review?: number
  sent?: number
  failed?: number
  actions?: {
    active?: number
    paused?: number
    removed?: number
    helped?: number
    neutral?: number
    could_not?: number
    adapt_requests?: number
    not_for_me?: number
  }
}

function monthRef(offset: number) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function label(ref: string) {
  const [y, m] = ref.split('-').map(Number)
  const text = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function AdminSelfCareHub() {
  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => monthRef(i + 1)), [])
  const [month, setMonth] = useState(months[0])
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: raw, error: rpcError } = await supabase.rpc('admin_care_plan_dashboard', { p_month: month })
    if (rpcError) {
      setError(rpcError.message)
      setData(null)
    } else {
      setData((raw ?? {}) as Dashboard)
    }
    setLoading(false)
  }, [month])

  useEffect(() => { void load() }, [load])

  const actions = data?.actions ?? {}
  const feedbackTotal = (actions.helped ?? 0) + (actions.neutral ?? 0) + (actions.could_not ?? 0) + (actions.adapt_requests ?? 0) + (actions.not_for_me ?? 0)
  const helpedRate = feedbackTotal ? Math.round(((actions.helped ?? 0) / feedbackTotal) * 100) : null

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-paper-soft p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[.14em] font-semibold text-forest-600">Plano vivo · visão operacional</p>
            <h2 className="font-serif text-2xl text-forest-900 mt-1">O plano está sendo útil ou só entregue?</h2>
            <p className="text-sm text-ink-soft mt-1 max-w-3xl">Acompanhe se houve contexto suficiente para personalização, quantos planos chegaram ao usuário e como as ações escolhidas estão funcionando. Os números abaixo são agregados e não exibem texto íntimo do Diário.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={month} onChange={e => setMonth(e.target.value)} className="admin-input text-sm">
              {months.map(m => <option key={m} value={m}>{label(m)}</option>)}
            </select>
            <button type="button" onClick={() => void load()} className="admin-btn-secondary" aria-label="Atualizar resumo">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-sm text-ink-soft"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando leitura operacional…</div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>Não foi possível carregar os indicadores do plano: {error}</span></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-5">
              <Metric icon={Sparkles} value={data?.ready ?? 0} label="Com contexto suficiente" />
              <Metric icon={AlertCircle} value={data?.insufficient_activity ?? 0} label="Sem contexto suficiente" />
              <Metric icon={Activity} value={data?.pending_review ?? 0} label="Em revisão" />
              <Metric icon={CheckCircle2} value={data?.sent ?? 0} label="Enviados" />
              <Metric icon={HeartHandshake} value={actions.active ?? 0} label="Ações ativas" />
              <Metric icon={RefreshCw} value={actions.adapt_requests ?? 0} label="Pedidos de adaptação" />
            </div>

            <div className="grid lg:grid-cols-3 gap-3 mt-4">
              <Insight title="Personalização disponível" value={`${data?.ready ?? 0} de ${data?.total ?? 0}`} text="Ciclos em que havia dados distribuídos o suficiente para produzir algo específico, em vez de um plano genérico." />
              <Insight title="Ações que ajudaram" value={helpedRate === null ? 'Ainda sem retorno' : `${helpedRate}%`} text={feedbackTotal ? `${actions.helped ?? 0} retorno(s) positivo(s) entre ${feedbackTotal} percepções registradas.` : 'O indicador aparece quando usuários começam a responder às ações do plano.'} />
              <Insight title="Sinais para a próxima geração" value={`${(actions.not_for_me ?? 0) + (actions.could_not ?? 0) + (actions.adapt_requests ?? 0)}`} text="Soma de ações que não combinaram, não foram possíveis ou pediram adaptação. Esse retorno deve pesar no próximo plano." />
            </div>

            {(data?.insufficient_activity ?? 0) > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>{data?.insufficient_activity} ciclo(s) sem atividade suficiente.</strong> Nesses casos, o usuário não recebe recomendações genéricas: vê uma explicação leve do motivo e instruções de como criar mais contexto naturalmente no próximo ciclo.
              </div>
            )}
          </>
        )}
      </section>

      <AdminLivingCarePlanWorkspace />
    </div>
  )
}

function Metric({ icon: Icon, value, label }: { icon: typeof Activity; value: number; label: string }) {
  return <div className="rounded-2xl border border-line bg-white p-4"><Icon className="w-4 h-4 text-forest-500" /><p className="font-serif text-2xl text-forest-900 mt-2">{value}</p><p className="text-xs text-ink-soft mt-1">{label}</p></div>
}
function Insight({ title, value, text }: { title: string; value: string; text: string }) {
  return <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs font-medium text-forest-700">{title}</p><p className="font-serif text-xl text-forest-900 mt-1">{value}</p><p className="text-xs text-ink-soft mt-2 leading-relaxed">{text}</p></div>
}
