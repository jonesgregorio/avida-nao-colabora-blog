import { Fragment, useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Shield, RefreshCw, ChevronDown } from 'lucide-react'

interface AdminLog {
  id: string
  admin_id: string
  admin_name?: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

interface AuditFilters {
  admins: { id: string; name: string }[]
  modules: string[]
  actions: string[]
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-amber-100 text-amber-700',
  publish: 'bg-mint text-forest-800',
  config: 'bg-stone-200 text-stone-700',
}

const PAGE = 50

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterOpts, setFilterOpts] = useState<AuditFilters>({ admins: [], modules: [], actions: [] })

  // Filtros
  const [fAdmin, setFAdmin] = useState('')
  const [fModule, setFModule] = useState('')
  const [fAction, setFAction] = useState('')
  const [fTarget, setFTarget] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data, error } = await supabase.rpc('admin_audit_query', {
      p_admin: fAdmin || null,
      p_module: fModule || null,
      p_action: fAction || null,
      p_target: fTarget.trim() || null,
      p_from: fFrom ? new Date(fFrom).toISOString() : null,
      p_to: fTo ? new Date(fTo + 'T23:59:59').toISOString() : null,
      p_limit: PAGE,
      p_offset: page * PAGE,
    })

    if (error) {
      if (/admin_audit_query|does not exist|schema cache/i.test(error.message)) {
        // Degrada: leitura direta (sem filtros server-side) até o deploy desta etapa.
        const { data: rows } = await supabase
          .from('admin_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)
        const list = (rows ?? []) as AdminLog[]
        const ids = [...new Set(list.map(l => l.admin_id).filter(Boolean))]
        if (ids.length) {
          const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids)
          const nameById = new Map((profs ?? []).map(p => [p.user_id as string, (p.full_name as string | null) ?? '']))
          list.forEach(l => { l.admin_name = nameById.get(l.admin_id) ?? '' })
        }
        setLogs(list); setTotal(list.length)
        setFilterOpts({
          admins: [...new Map(list.map(l => [l.admin_id, { id: l.admin_id, name: l.admin_name ?? '' }])).values()],
          modules: [...new Set(list.map(l => l.target_type).filter(Boolean) as string[])].sort(),
          actions: [...new Set(list.map(l => l.action).filter(Boolean))].sort(),
        })
      } else {
        setErr(error.message)
        setLogs([])
      }
      setLoading(false)
      return
    }

    const payload = (data ?? {}) as {
      rows?: AdminLog[]; total?: number
      filters?: { admins?: { id: string; name: string }[]; modules?: string[]; actions?: string[] }
    }
    setLogs(payload.rows ?? [])
    setTotal(payload.total ?? 0)
    if (payload.filters) {
      setFilterOpts({
        admins: (payload.filters.admins ?? []).filter(a => a.id),
        modules: payload.filters.modules ?? [],
        actions: payload.filters.actions ?? [],
      })
    }
    setLoading(false)
  }, [fAdmin, fModule, fAction, fTarget, fFrom, fTo, page])

  useEffect(() => { load() }, [load])

  // Ao mudar um filtro, volta para a primeira página.
  function onFilter(setter: (v: string) => void) {
    return (v: string) => { setPage(0); setter(v) }
  }

  function clearFilters() {
    setPage(0); setFAdmin(''); setFModule(''); setFAction(''); setFTarget(''); setFFrom(''); setFTo('')
  }

  const hasFilters = fAdmin || fModule || fAction || fTarget || fFrom || fTo
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const selClass = 'px-2.5 py-2 border border-line rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300'

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Auditoria administrativa</h1>
          <p className="text-sm text-ink-soft mt-0.5">
            Toda ação de administrador fica registrada aqui. Estes registros não podem ser editados nem apagados.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-ink hover:border-forest-300">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={fAdmin} onChange={e => onFilter(setFAdmin)(e.target.value)} className={selClass}>
          <option value="">Todos os administradores</option>
          {filterOpts.admins.map(a => (
            <option key={a.id} value={a.id}>{a.name || a.id.slice(0, 8)}</option>
          ))}
        </select>
        <select value={fModule} onChange={e => onFilter(setFModule)(e.target.value)} className={selClass}>
          <option value="">Todos os módulos</option>
          {filterOpts.modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fAction} onChange={e => onFilter(setFAction)(e.target.value)} className={selClass}>
          <option value="">Todas as ações</option>
          {filterOpts.actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          value={fTarget}
          onChange={e => onFilter(setFTarget)(e.target.value)}
          placeholder="Registro afetado / detalhe…"
          className="px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 min-w-[200px]"
        />
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          de <input type="date" value={fFrom} onChange={e => onFilter(setFFrom)(e.target.value)} className={selClass} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          até <input type="date" value={fTo} onChange={e => onFilter(setFTo)(e.target.value)} className={selClass} />
        </label>
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-forest-700 underline px-2">Limpar filtros</button>
        )}
      </div>

      {err && <p className="text-sm text-red-600 mb-3">Erro ao carregar: {err}</p>}

      {loading ? (
        <p className="text-ink-soft text-sm">Carregando…</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-ink-soft">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{hasFilters ? 'Nenhum registro para esses filtros.' : 'Nenhum registro de auditoria ainda.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-soft border-b border-line">
              <tr>
                <th className="text-left px-4 py-3 text-ink-soft font-medium text-xs">Data/Hora</th>
                <th className="text-left px-4 py-3 text-ink-soft font-medium text-xs">Administrador</th>
                <th className="text-left px-4 py-3 text-ink-soft font-medium text-xs">Ação</th>
                <th className="text-left px-4 py-3 text-ink-soft font-medium text-xs hidden md:table-cell">Módulo</th>
                <th className="text-left px-4 py-3 text-ink-soft font-medium text-xs hidden md:table-cell">Registro</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logs.map(log => {
                const changes = (log.details?.changes ?? null) as Record<string, { de: unknown; para: unknown }> | null
                const isOpen = expanded === log.id
                return (
                  <Fragment key={log.id}>
                    <tr
                      className="hover:bg-paper-soft cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : log.id)}
                    >
                      <td className="px-4 py-3 text-xs text-ink-soft whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink">{log.admin_name || log.admin_id?.slice(0, 8) || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.action] || 'bg-stone-100 text-ink'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-soft hidden md:table-cell capitalize">{log.target_type || '—'}</td>
                      <td className="px-4 py-3 text-xs text-ink-soft hidden md:table-cell">
                        {log.target_id ? `#${log.target_id.slice(0, 8)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronDown className={`w-4 h-4 text-stone-400 inline transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-paper-soft">
                        <td colSpan={6} className="px-4 py-3">
                          {changes && Object.keys(changes).length > 0 ? (
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-ink-soft">O que mudou</p>
                              {Object.entries(changes).map(([k, v]) => (
                                <div key={k} className="text-xs flex flex-wrap items-baseline gap-1.5">
                                  <span className="font-medium text-ink">{k}:</span>
                                  <span className="text-red-600 line-through">{fmtValue(v.de)}</span>
                                  <span className="text-stone-400">→</span>
                                  <span className="text-forest-700">{fmtValue(v.para)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <pre className="text-xs text-ink-soft whitespace-pre-wrap break-all">
                              {log.details ? JSON.stringify(log.details, null, 2) : 'Sem detalhes adicionais.'}
                            </pre>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between mt-4 text-xs text-ink-soft">
        <span>{total} registro(s){hasFilters ? ' (filtrados)' : ''}.</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 border border-line rounded-lg disabled:opacity-40 hover:border-forest-300"
            >Anterior</button>
            <span>Página {page + 1} de {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="px-2.5 py-1 border border-line rounded-lg disabled:opacity-40 hover:border-forest-300"
            >Próxima</button>
          </div>
        )}
      </div>
    </div>
  )
}
