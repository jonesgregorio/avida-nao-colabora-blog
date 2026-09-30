import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Clock3, ExternalLink, Filter, RefreshCw, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { AdminView } from './types'

type Bucket = 'all' | 'overdue' | 'today' | 'due_3d' | 'later' | 'no_due'
type Severity = 'all' | 'normal' | 'high' | 'critical'
type ActionStatus = 'all' | 'pending' | 'in_progress' | 'review' | 'failed'
type Plan = 'all' | 'free' | 'essential' | 'plus'
type Assignee = 'all' | 'assigned' | 'unassigned'

interface ActionItem {
  area: string
  id: string
  user_id: string | null
  user_name?: string | null
  title: string
  created_at: string
  due_at: string | null
  bucket: Exclude<Bucket, 'all'>
  severity: Exclude<Severity, 'all'>
  status?: Exclude<ActionStatus, 'all'>
  plan?: Exclude<Plan, 'all'> | null
  assignee_id?: string | null
  destination: AdminView
}
interface ResponsePayload { total?: number; limit?: number; offset?: number; items?: ActionItem[] }

const PAGE_SIZE = 20
const AREA_OPTIONS = [
  ['all', 'Todas as áreas'], ['support', 'Suporte'], ['guidance', 'Orientações'], ['care', 'Autocuidado'],
  ['deliveries', 'Entregas'], ['reports', 'Relatórios'], ['cancellations', 'Cancelamentos'],
  ['incidents', 'Incidentes'], ['editorial', 'Editorial'],
] as const
const BUCKET_OPTIONS: Array<[Bucket, string]> = [
  ['all', 'Todos os prazos'], ['overdue', 'Atrasadas'], ['today', 'Vencem hoje'],
  ['due_3d', 'Próximos 3 dias'], ['later', 'Depois de 3 dias'], ['no_due', 'Sem prazo'],
]
const SEVERITY_OPTIONS: Array<[Severity, string]> = [
  ['all', 'Todas as prioridades'], ['critical', 'Crítica'], ['high', 'Alta'], ['normal', 'Normal'],
]
const STATUS_OPTIONS: Array<[ActionStatus, string]> = [
  ['all', 'Todos os status'], ['pending', 'Pendente'], ['in_progress', 'Em andamento'],
  ['review', 'Aguardando revisão'], ['failed', 'Falha'],
]
const PLAN_OPTIONS: Array<[Plan, string]> = [
  ['all', 'Todos os planos'], ['free', 'Gratuito'], ['essential', 'Essencial'], ['plus', 'Plus'],
]
const ASSIGNEE_OPTIONS: Array<[Assignee, string]> = [
  ['all', 'Todos os responsáveis'], ['assigned', 'Com responsável'], ['unassigned', 'Sem responsável'],
]
const AREA_LABEL: Record<string, string> = {
  support: 'Suporte', guidance: 'Orientações', care: 'Autocuidado', deliveries: 'Entregas',
  reports: 'Relatórios', cancellations: 'Cancelamentos', incidents: 'Incidentes', editorial: 'Editorial',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', in_progress: 'Em andamento', review: 'Aguardando revisão', failed: 'Falha',
}
const PLAN_LABEL: Record<string, string> = { free: 'Gratuito', essential: 'Essencial', plus: 'Plus' }

function dueLabel(iso: string | null): string {
  if (!iso) return 'Sem prazo definido'
  const diff = new Date(iso).getTime() - Date.now()
  const hours = Math.ceil(Math.abs(diff) / 3600000)
  if (diff < 0) return hours < 24 ? `Atrasada há ${hours}h` : `Atrasada há ${Math.ceil(hours / 24)}d`
  if (hours <= 24) return `Faltam ${hours}h`
  return `Faltam ${Math.ceil(hours / 24)}d`
}

export default function AdminHumanActionCenter({ onNavigate }: { onNavigate: (view: AdminView) => void }) {
  const [area, setArea] = useState('all')
  const [bucket, setBucket] = useState<Bucket>('all')
  const [severity, setSeverity] = useState<Severity>('all')
  const [status, setStatus] = useState<ActionStatus>('all')
  const [plan, setPlan] = useState<Plan>('all')
  const [assignee, setAssignee] = useState<Assignee>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [payload, setPayload] = useState<ResponsePayload>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error: err } = await supabase.rpc('admin_action_center_items_filtered', {
      p_area: area,
      p_bucket: bucket,
      p_severity: severity,
      p_status: status,
      p_plan: plan,
      p_search: search || null,
      p_assignee: assignee,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    })
    if (err) { setError(err.message); setPayload({ items: [], total: 0 }) }
    else setPayload((data ?? {}) as ResponsePayload)
    setLoading(false)
  }, [area, assignee, bucket, page, plan, search, severity, status])

  useEffect(() => { void load() }, [load])

  const total = payload.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = payload.items ?? []
  const range = useMemo(() => total === 0 ? '0' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}`, [page, total])
  const hasFilters = area !== 'all' || bucket !== 'all' || severity !== 'all' || status !== 'all' || plan !== 'all' || assignee !== 'all' || Boolean(search)

  function clearFilters() {
    setArea('all'); setBucket('all'); setSeverity('all'); setStatus('all'); setPlan('all'); setAssignee('all')
    setSearchInput(''); setSearch(''); setPage(1)
  }

  return (
    <div className="mb-5 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-600">Fila única</p>
          <h3 className="font-serif text-xl text-forest-900">Ações que precisam de você</h3>
          <p className="mt-1 text-xs text-stone-500">Somente trabalho humano obrigatório. Rascunhos sem prazo e processos já automáticos ficam fora desta lista.</p>
        </div>
        <button onClick={() => void load()} className="inline-flex self-start items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs text-stone-500 hover:text-forest-800 xl:self-auto" aria-label="Atualizar ações"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-stone-50/60 p-3">
        <form className="flex flex-col gap-2 lg:flex-row" onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1) }}>
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Buscar usuário ou pendência..." className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-xs text-stone-700 outline-none focus:border-forest-300" />
          </label>
          <button type="submit" className="rounded-lg bg-forest-900 px-4 py-2 text-xs font-medium text-white hover:bg-forest-800">Buscar</button>
          {hasFilters && <button type="button" onClick={clearFilters} className="inline-flex items-center justify-center gap-1 rounded-lg border border-line bg-white px-3 py-2 text-xs text-stone-500 hover:text-forest-800"><X className="h-3.5 w-3.5" /> Limpar filtros</button>}
        </form>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <label className="relative">
            <Filter className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
            <select value={area} onChange={e => { setArea(e.target.value); setPage(1) }} className="w-full rounded-lg border border-line bg-white py-2 pl-8 pr-7 text-xs text-stone-600">
              {AREA_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <select value={bucket} onChange={e => { setBucket(e.target.value as Bucket); setPage(1) }} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-stone-600">
            {BUCKET_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={severity} onChange={e => { setSeverity(e.target.value as Severity); setPage(1) }} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-stone-600">
            {SEVERITY_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={status} onChange={e => { setStatus(e.target.value as ActionStatus); setPage(1) }} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-stone-600">
            {STATUS_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={plan} onChange={e => { setPlan(e.target.value as Plan); setPage(1) }} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-stone-600">
            {PLAN_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={assignee} onChange={e => { setAssignee(e.target.value as Assignee); setPage(1) }} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-stone-600">
            {ASSIGNEE_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">Não foi possível carregar a fila: {error}</div> :
      loading ? <div className="mt-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-stone-100" />)}</div> :
      items.length === 0 ? <div className="mt-4 rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-500">Nenhuma ação humana neste filtro.</div> : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-stone-50 text-stone-500"><tr>{['Área','Pendência / usuário','Prazo','Prioridade','Ação'].map(h => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{items.map(item => {
              const overdue = item.bucket === 'overdue'
              const critical = item.severity === 'critical'
              return <tr key={`${item.area}-${item.id}`} className={overdue ? 'bg-red-50/35' : ''}>
                <td className="px-3 py-3"><span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-600">{AREA_LABEL[item.area] ?? item.area}</span></td>
                <td className="max-w-md px-3 py-3">
                  <p className="font-medium text-forest-900">{item.title}</p>
                  {item.user_name && <p className="mt-0.5 text-[11px] text-stone-600">{item.user_name}</p>}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {item.status && <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">{STATUS_LABEL[item.status] ?? item.status}</span>}
                    {item.plan && <span className="rounded-full bg-mint px-1.5 py-0.5 text-[10px] text-forest-700">{PLAN_LABEL[item.plan] ?? item.plan}</span>}
                    {item.assignee_id ? <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">Com responsável</span> : <span className="rounded-full bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-400">Sem responsável</span>}
                  </div>
                  <p className="mt-1 text-[10px] text-stone-400">Entrou em {new Date(item.created_at).toLocaleString('pt-BR')}</p>
                </td>
                <td className="px-3 py-3"><div className={`inline-flex items-center gap-1 font-medium ${overdue ? 'text-red-700' : item.bucket === 'today' ? 'text-amber-700' : 'text-stone-600'}`}>{overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{dueLabel(item.due_at)}</div>{item.due_at && <p className="mt-0.5 text-[10px] text-stone-400">{new Date(item.due_at).toLocaleString('pt-BR')}</p>}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${critical ? 'bg-red-100 text-red-700' : item.severity === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-mint text-forest-700'}`}>{critical ? 'Crítica' : item.severity === 'high' ? 'Alta' : 'Normal'}</span></td>
                <td className="px-3 py-3"><button onClick={() => onNavigate(item.destination)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 font-medium text-forest-700 hover:border-forest-300">Abrir <ExternalLink className="h-3 w-3" /></button></td>
              </tr>
            })}</tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-stone-500">
        <span>{range} de {total} · 20 por página</span>
        <div className="flex items-center gap-1"><button disabled={page<=1} onClick={() => setPage(p => Math.max(1,p-1))} className="rounded-lg border border-line p-1.5 disabled:opacity-30" aria-label="Página anterior"><ChevronLeft className="h-3.5 w-3.5" /></button><span className="px-2">{page}/{pages}</span><button disabled={page>=pages} onClick={() => setPage(p => Math.min(pages,p+1))} className="rounded-lg border border-line p-1.5 disabled:opacity-30" aria-label="Próxima página"><ChevronRight className="h-3.5 w-3.5" /></button></div>
      </div>
    </div>
  )
}
