import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, Mail, Clock3, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Summary = {
  registered: number
  activated: number
  tracked_multi_day: number
  tracked_one_day: number
  tracking_missing: number
  eligible_d7: number
  retained_d7: number
}

export default function AdminReactivation() {
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const response = await supabase.rpc('admin_retention_summary')
    if (response.error) setError(response.error.message)
    else setData(response.data as Summary)
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const cards = [
    ['Contas registradas', data?.registered],
    ['Com registro de diário', data?.activated],
    ['Atividade em vários dias', data?.tracked_multi_day],
    ['Sem navegação rastreada', data?.tracking_missing],
  ]

  return <div className="p-4 sm:p-6 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="admin-kicker">Relacionamento</p>
        <h2 className="font-serif text-2xl text-forest-900">Retenção e Reativação</h2>
        <p className="text-sm text-ink-soft mt-1">Acompanhamento agregado sem acesso ao conteúdo emocional dos registros.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} className="admin-btn-secondary">
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
      </button>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(([label, value]) => <div key={String(label)} className="admin-card p-4">
        <p className="text-xs text-ink-soft">{label}</p>
        <p className="font-serif text-2xl text-forest-900 mt-2">{loading ? '…' : value ?? '—'}</p>
      </div>)}
    </div>
    <section className="admin-card p-4 space-y-2">
      <h3 className="font-serif text-xl text-forest-900">Retenção no sétimo dia (D7)</h3>
      <p className="text-2xl font-semibold text-forest-900">{data ? `${data.retained_d7} / ${data.eligible_d7}` : '—'}</p>
      <p className="text-xs text-ink-soft">Contas com visita rastreada no sétimo dia após o cadastro, entre contas com pelo menos sete dias. A ausência de rastreamento pode subestimar o retorno real.</p>
    </section>
    <section className="admin-card p-4 space-y-4">
      <h3 className="font-serif text-xl text-forest-900">Automação de reativação</h3>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-paper-soft p-3"><Clock3 className="w-4 h-4 mb-2 text-forest-700" />Agendamento: diariamente às 10h15 (Brasília)</div>
        <div className="rounded-xl bg-paper-soft p-3"><ShieldCheck className="w-4 h-4 mb-2 text-forest-700" />Somente usuários com consentimento explícito</div>
        <div className="rounded-xl bg-paper-soft p-3"><Mail className="w-4 h-4 mb-2 text-forest-700" />Limite técnico atual: até 20 tentativas por execução</div>
      </div>
      <div className="flex gap-2 text-sm text-ink-soft"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        O painel ainda não consulta o estado da chave de envio, o histórico de entregas nem a quantidade de candidatos. Nenhum envio pode ser ativado por esta tela. Não interprete estes indicadores como confirmação de envio.
      </div>
    </section>
  </div>
}
