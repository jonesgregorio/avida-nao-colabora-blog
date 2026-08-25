import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Loader2, Zap } from 'lucide-react'

interface CronStatus {
  jobname: string
  active: boolean
  schedule: string
  last_status: string | null
  last_started_at: string | null
  last_duration_seconds: number | null
  last_error: string | null
}

// Nomes técnicos dos jobs (cron.job.jobname) → o que cada um realmente faz.
// Só rótulo/descrição; o status vem sempre de dados reais da RPC.
const JOB_INFO: Record<string, { label: string; description: string }> = {
  'run-content-automations': { label: 'Automações editoriais', description: 'Executa as regras ativas de geração de artigo (pacote semanal, pauta etc.).' },
  'publish-due-scheduled': { label: 'Publicação agendada', description: 'Publica artigos com status "scheduled" cujo horário já chegou.' },
  'run-lifecycle-emails': { label: 'E-mails de ciclo de vida', description: 'Lembretes de inatividade, avisos de relatório/orientação disponíveis.' },
  'run-emotional-automations': { label: 'Relatórios e autocuidado', description: 'Gera relatório semanal/mensal e plano de autocuidado por usuário elegível.' },
  'sync-monthly-personalization': { label: 'Personalização mensal', description: 'Alimenta a fila de personalização por IA no início de cada mês.' },
  'purge-analytics-events': { label: 'Retenção de analytics', description: 'Expurga eventos antigos de analytics — manutenção, sem geração de conteúdo.' },
  'notify-weekly-reports': { label: 'Notificação — relatório semanal', description: 'Avisa usuários Essencial+ que o relatório semanal ficou disponível.' },
  'notify-monthly-reports': { label: 'Notificação — relatório mensal', description: 'Avisa usuários Plus que o relatório mensal ficou disponível.' },
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function statusBadge(job: CronStatus) {
  if (!job.active) return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-stone-200 text-stone-700">Inativo</span>
  if (job.last_status === 'failed') return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Falhou</span>
  if (job.last_status === 'succeeded') return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-mint text-forest-700">OK</span>
  return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-stone-100 text-stone-600">Sem execução ainda</span>
}

export default function AdminAutomationsHealth() {
  const [jobs, setJobs] = useState<CronStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  async function load() {
    setLoading(true); setErr('')
    const { data, error } = await supabase.rpc('get_cron_automations_status')
    if (error) setErr(error.message)
    setJobs((data as CronStatus[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const failing = jobs.filter(j => j.active && j.last_status === 'failed').length

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900 flex items-center gap-2"><Zap className="w-6 h-6 text-forest-600" /> Automações</h1>
          <p className="text-sm text-ink-soft mt-1">Status ao vivo de todos os cron jobs — direto do banco, sem depender de olhar logs técnicos.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {failing > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 mb-6 text-sm text-red-800">
          <strong>{failing}</strong> automaç{failing === 1 ? 'ão' : 'ões'} com falha na última execução. Veja o motivo na coluna "Erro" abaixo.
        </div>
      )}

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-line"><h2 className="font-serif text-lg text-forest-900">Cron jobs</h2></div>
        {err && <p className="px-5 py-3 text-sm text-red-600">Erro ao carregar: {err}</p>}
        {loading ? (
          <p className="px-5 py-6 text-sm text-ink-soft flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
        ) : jobs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-soft">Nenhum cron job encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-line">
                <tr>
                  <th className="text-left px-4 py-2 text-stone-500 font-medium">Automação</th>
                  <th className="text-left px-4 py-2 text-stone-500 font-medium">Agendamento</th>
                  <th className="text-left px-4 py-2 text-stone-500 font-medium">Status</th>
                  <th className="text-left px-4 py-2 text-stone-500 font-medium">Última execução</th>
                  <th className="text-left px-4 py-2 text-stone-500 font-medium">Duração</th>
                  <th className="text-left px-4 py-2 text-stone-500 font-medium">Erro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {jobs.map(j => {
                  const info = JOB_INFO[j.jobname]
                  return (
                    <tr key={j.jobname}>
                      <td className="px-4 py-2">
                        <p className="text-forest-900 font-medium">{info?.label ?? j.jobname}</p>
                        <p className="text-xs text-ink-soft">{info?.description ?? j.jobname}</p>
                      </td>
                      <td className="px-4 py-2 text-ink-soft whitespace-nowrap font-mono text-xs">{j.schedule}</td>
                      <td className="px-4 py-2">{statusBadge(j)}</td>
                      <td className="px-4 py-2 text-ink-soft whitespace-nowrap">{fmt(j.last_started_at)}</td>
                      <td className="px-4 py-2 text-ink-soft whitespace-nowrap">{j.last_duration_seconds != null ? `${j.last_duration_seconds.toFixed(1)}s` : '—'}</td>
                      <td className="px-4 py-2 text-xs text-red-600 max-w-xs truncate" title={j.last_error ?? undefined}>{j.last_error ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
