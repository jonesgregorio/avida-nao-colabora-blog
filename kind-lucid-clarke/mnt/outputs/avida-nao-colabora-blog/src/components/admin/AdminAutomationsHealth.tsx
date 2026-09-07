import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logAdminAction } from '../../lib/adminAudit'
import { RefreshCw, Loader2, Zap, ChevronDown, Play, Pause } from 'lucide-react'

interface CronStatus {
  jobname: string
  active: boolean
  schedule: string
  last_status: string | null
  last_started_at: string | null
  last_duration_seconds: number | null
  last_error: string | null
}

interface RunHistory {
  runs: { status: string; started_at: string; duration_seconds: number | null; error: string | null }[]
  summary_30: { total: number; succeeded: number; failed: number; last_error: string | null }
}

// Nomes técnicos dos jobs (cron.job.jobname) → o que cada um realmente faz.
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

// Frequência legível para os padrões usados no projeto.
function humanSchedule(cron: string): string {
  const map: Record<string, string> = {
    '*/10 * * * *': 'A cada 10 minutos',
    '0 * * * *': 'De hora em hora',
    '0 3 * * *': 'Todo dia, 3h',
    '20 3 * * *': 'Todo dia, 3h20',
    '30 3 * * *': 'Todo dia, 3h30',
    '0 11 * * 0': 'Domingo, 11h',
    '0 11 1 * *': 'Dia 1 do mês, 11h',
    '0 12 * * *': 'Todo dia, 12h',
    '0 3 1 * *': 'Dia 1 do mês, 3h',
  }
  return map[cron.trim()] ?? cron
}

function statusBadge(job: CronStatus) {
  if (!job.active) return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-stone-200 text-stone-700">Pausada</span>
  if (job.last_status === 'failed') return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Falhou</span>
  if (job.last_status === 'succeeded') return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-mint text-forest-700">OK</span>
  return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-stone-100 text-stone-600">Sem execução ainda</span>
}

export default function AdminAutomationsHealth() {
  const [jobs, setJobs] = useState<CronStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, RunHistory | 'loading' | 'error'>>({})
  const [toggling, setToggling] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    setLoading(true); setErr('')
    const { data, error } = await supabase.rpc('get_cron_automations_status')
    if (error) setErr(error.message)
    setJobs((data as CronStatus[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function toggleExpand(jobname: string) {
    if (expanded === jobname) { setExpanded(null); return }
    setExpanded(jobname)
    if (!history[jobname]) {
      setHistory(h => ({ ...h, [jobname]: 'loading' }))
      const { data, error } = await supabase.rpc('admin_cron_run_history', { p_jobname: jobname, p_limit: 15 })
      setHistory(h => ({ ...h, [jobname]: error ? 'error' : (data as RunHistory) }))
    }
  }

  async function toggleActive(job: CronStatus) {
    const next = !job.active
    const label = JOB_INFO[job.jobname]?.label ?? job.jobname
    if (!window.confirm(`${next ? 'Ativar' : 'Pausar'} a automação "${label}"? ${next ? 'Ela volta a rodar no próximo agendamento.' : 'Ela para de rodar até ser reativada.'}`)) return
    setToggling(job.jobname); setMsg(null)
    const { error } = await supabase.rpc('admin_set_cron_active', { p_jobname: job.jobname, p_active: next })
    if (error) {
      setMsg({ ok: false, text: 'Não foi possível alterar: ' + error.message })
    } else {
      void logAdminAction('config', next ? 'automation_resume' : 'automation_pause', job.jobname, { label })
      setMsg({ ok: true, text: `"${label}" ${next ? 'ativada' : 'pausada'}.` })
      setJobs(js => js.map(j => j.jobname === job.jobname ? { ...j, active: next } : j))
    }
    setToggling(null)
  }

  const failing = jobs.filter(j => j.active && j.last_status === 'failed').length
  const paused = jobs.filter(j => !j.active).length

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900 flex items-center gap-2"><Zap className="w-6 h-6 text-forest-600" /> Automações</h1>
          <p className="text-sm text-ink-soft mt-1">Todas as rotinas automáticas — status ao vivo, histórico de execução e controle de pausar/ativar.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {(failing > 0 || paused > 0) && (
        <div className="flex flex-wrap gap-3 mb-5">
          {failing > 0 && <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-2.5 text-sm text-red-800"><strong>{failing}</strong> com falha na última execução.</div>}
          {paused > 0 && <div className="bg-stone-100 border border-line rounded-xl px-4 py-2.5 text-sm text-stone-700"><strong>{paused}</strong> pausada(s).</div>}
        </div>
      )}
      {msg && <div className={`mb-4 text-sm px-3.5 py-2.5 rounded-xl ${msg.ok ? 'bg-mint/50 text-forest-800 border border-forest-100' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</div>}

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        {err && <p className="px-5 py-3 text-sm text-red-600">Erro ao carregar: {err}</p>}
        {loading ? (
          <p className="px-5 py-6 text-sm text-ink-soft flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
        ) : jobs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-soft">Nenhuma automação encontrada.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {jobs.map(j => {
              const info = JOB_INFO[j.jobname]
              const h = history[j.jobname]
              const isOpen = expanded === j.jobname
              return (
                <div key={j.jobname}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-[180px] flex-1">
                      <p className="text-forest-900 font-medium text-sm">{info?.label ?? j.jobname}</p>
                      <p className="text-xs text-ink-soft">{info?.description ?? j.jobname}</p>
                    </div>
                    <span className="text-xs text-ink-soft whitespace-nowrap">{humanSchedule(j.schedule)}</span>
                    {statusBadge(j)}
                    <span className="text-xs text-ink-soft whitespace-nowrap">{fmt(j.last_started_at)}</span>
                    <button
                      onClick={() => toggleActive(j)}
                      disabled={toggling === j.jobname}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${j.active ? 'border-line text-stone-600 hover:bg-stone-50' : 'border-forest-200 text-forest-700 hover:bg-mint/40'}`}
                    >
                      {toggling === j.jobname ? <Loader2 className="w-3 h-3 animate-spin" /> : j.active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      {j.active ? 'Pausar' : 'Ativar'}
                    </button>
                    <button onClick={() => toggleExpand(j.jobname)} className="p-1 text-stone-400 hover:text-stone-700" aria-label="Ver histórico">
                      <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="bg-stone-50 border-t border-line px-4 py-3">
                      {h === 'loading' ? (
                        <p className="text-xs text-stone-400 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Carregando histórico…</p>
                      ) : h === 'error' || !h ? (
                        <p className="text-xs text-stone-400">Histórico disponível após o deploy desta etapa.</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-4 text-xs mb-3">
                            <span className="text-stone-500">Últimas 30: <strong className="text-forest-900">{h.summary_30.succeeded} OK</strong> · <strong className={h.summary_30.failed > 0 ? 'text-red-600' : 'text-stone-500'}>{h.summary_30.failed} falha(s)</strong></span>
                            {h.summary_30.last_error && <span className="text-red-600 truncate max-w-md" title={h.summary_30.last_error}>último erro: {h.summary_30.last_error}</span>}
                          </div>
                          <div className="space-y-1">
                            {h.runs.length === 0 ? <p className="text-xs text-stone-400">Sem execuções registradas.</p> : h.runs.map((r, i) => (
                              <div key={i} className="flex items-center gap-3 text-xs">
                                <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'succeeded' ? 'bg-forest-500' : r.status === 'failed' ? 'bg-red-500' : 'bg-stone-300'}`} />
                                <span className="text-stone-500 w-32 flex-shrink-0">{fmt(r.started_at)}</span>
                                <span className="text-stone-400 w-14 flex-shrink-0">{r.duration_seconds != null ? `${r.duration_seconds.toFixed(1)}s` : '—'}</span>
                                <span className={`truncate ${r.status === 'failed' ? 'text-red-600' : 'text-stone-500'}`}>{r.status === 'failed' ? (r.error || 'falha') : r.status}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-stone-400">
        As <strong>regras editoriais</strong> (o que cada automação de artigo gera) ficam em Conteúdo &amp; IA → Automações. Reprocessar personalização vencida fica em Sistema → Filas e falhas.
      </p>
    </div>
  )
}
