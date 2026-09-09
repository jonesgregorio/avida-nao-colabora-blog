import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, ArrowRight, Download, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { PLAN_LABELS } from '../../lib/planConstants'
import { isUuid, sanitizePgSearchTerm } from '../../lib/adminSearch'

interface Row {
  id: string
  user_id: string | null
  old_plan: string | null
  new_plan: string | null
  notes: string | null
  source: string | null
  change_type: string | null
  created_at: string
  name?: string
  email?: string
}

const label = (p: string | null | undefined) => (p && PLAN_LABELS[p]) || p || '—'
const PAGE_SIZE = 50
// change_type real da tabela (ver migration 039): upgrade / upgrade_intent /
// downgrade / downgrade_intent / cancel / reactivate / admin_change.
const TYPES = [
  { id: 'all', label: 'Todos os tipos' },
  { id: 'upgrade', label: 'Upgrades' },
  { id: 'downgrade', label: 'Downgrades' },
  { id: 'cancel', label: 'Cancelamentos' },
  { id: 'reactivate', label: 'Reativações' },
  { id: 'admin_change', label: 'Ajuste manual (admin)' },
  { id: 'stripe', label: 'Origem: Stripe' },
]

function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

interface Props { onOpenUser?: (userId: string) => void }

export default function AdminPlanChanges({ onOpenUser }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [err, setErr] = useState('')
  // filtros — TODOS aplicados só no clique em "Aplicar" (draft x applied).
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [applied, setApplied] = useState({ search: '', type: 'all', from: '', to: '' })
  const appliedSearch = applied.search

  // Resolve o texto de busca para uma restrição server-side de user_id.
  const resolveUserIds = useCallback(async (term: string): Promise<string[] | null> => {
    const raw = term.trim()
    if (!raw) return null
    if (isUuid(raw)) return [raw]
    const t = sanitizePgSearchTerm(raw)
    if (!t) return []
    const { data } = await supabase
      .from('profiles')
      .select('user_id')
      .or(`full_name.ilike.%${t}%,email.ilike.%${t}%`)
      .limit(500)
    return (data ?? []).map(p => p.user_id as string)
  }, [])

  const buildQuery = useCallback((userIds: string[] | null, forExport: boolean) => {
    let q = supabase
      .from('plan_change_history')
      .select('id, user_id, old_plan, new_plan, notes, source, change_type, created_at', forExport ? {} : { count: 'exact' })
      .order('created_at', { ascending: false })
    if (applied.type !== 'all') {
      if (applied.type === 'stripe') q = q.ilike('source', '%stripe%')
      else if (applied.type === 'upgrade') q = q.in('change_type', ['upgrade', 'upgrade_intent'])
      else if (applied.type === 'downgrade') q = q.in('change_type', ['downgrade', 'downgrade_intent'])
      else q = q.eq('change_type', applied.type)
    }
    if (applied.from) q = q.gte('created_at', `${applied.from}T00:00:00`)
    if (applied.to) q = q.lte('created_at', `${applied.to}T23:59:59`)
    if (userIds) q = q.in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
    return q
  }, [applied])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const userIds = await resolveUserIds(appliedSearch)
    const { data, error, count } = await buildQuery(userIds, false)
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (error) { setErr(error.message); setRows([]); setLoading(false); return }
    const list = (data ?? []) as Row[]
    const ids = [...new Set(list.map(r => r.user_id).filter(Boolean))] as string[]
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids)
      const byId = new Map((profs ?? []).map(p => [p.user_id as string, p]))
      list.forEach(r => { const p = r.user_id ? byId.get(r.user_id) : null; r.name = (p?.full_name as string) ?? ''; r.email = (p?.email as string) ?? '' })
    }
    setRows(list); setTotal(count ?? list.length); setLoading(false)
  }, [appliedSearch, buildQuery, page, resolveUserIds])

  useEffect(() => { void load() }, [load])

  function applyFilters() { setPage(0); setApplied({ search, type, from, to }) }
  function clearFilters() {
    setSearch(''); setType('all'); setFrom(''); setTo(''); setPage(0)
    setApplied({ search: '', type: 'all', from: '', to: '' })
  }
  const dirty = search !== applied.search || type !== applied.type || from !== applied.from || to !== applied.to

  async function exportCsv() {
    setExporting(true)
    try {
      const userIds = await resolveUserIds(appliedSearch)
      // Exporta TODO o recorte filtrado, em lotes, até acabar. Teto de segurança
      // alto e explícito (não um limite silencioso).
      const HARD_CAP = 200_000
      const BATCH = 1000
      const list: Row[] = []
      for (let offset = 0; offset < HARD_CAP; offset += BATCH) {
        const { data, error } = await buildQuery(userIds, true).range(offset, offset + BATCH - 1)
        if (error) { setErr(error.message); return }
        const chunk = (data ?? []) as Row[]
        list.push(...chunk)
        if (chunk.length < BATCH) break
      }
      if (list.length >= HARD_CAP) setErr(`Exportação limitada a ${HARD_CAP.toLocaleString('pt-BR')} linhas por segurança. Refine o filtro.`)
      const ids = [...new Set(list.map(r => r.user_id).filter(Boolean))] as string[]
      const byId = new Map<string, { full_name?: string; email?: string }>()
      for (let i = 0; i < ids.length; i += 300) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids.slice(i, i + 300))
        ;(profs ?? []).forEach(p => byId.set(p.user_id as string, p))
      }
      const header = ['data', 'user_id', 'nome', 'email', 'de', 'para', 'tipo', 'origem', 'motivo']
      const lines = list.map(r => {
        const p = r.user_id ? byId.get(r.user_id) : undefined
        return [r.created_at, r.user_id ?? '', p?.full_name ?? '', p?.email ?? '', label(r.old_plan), label(r.new_plan), r.change_type ?? '', r.source ?? '', r.notes ?? ''].map(csvCell).join(',')
      })
      const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `alteracoes-plano-${new Date().toISOString().slice(0, 10)}.csv`
      a.click(); URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = useMemo(
    () => applied.search || applied.type !== 'all' || applied.from || applied.to,
    [applied],
  )

  return (
    <div className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-serif text-xl text-forest-900">Alterações de plano</h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Upgrades, downgrades e ajustes manuais.{' '}
            {loading ? 'Carregando…' : `${total.toLocaleString('pt-BR')} registro(s)${hasFilters ? ' no filtro' : ''}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void exportCsv()} disabled={exporting || loading} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-lg text-sm hover:border-forest-300 disabled:opacity-50">
            <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} /> CSV
          </button>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-lg text-sm hover:border-forest-300">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-4 bg-white border border-line rounded-xl p-3">
        <label className="flex flex-col gap-1 text-xs text-ink-soft flex-1 min-w-[200px]">
          Buscar (nome, e-mail ou user_id)
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyFilters() }}
              placeholder="Jones, jones@…, ou UUID"
              className="w-full pl-8 pr-2 py-1.5 border border-line rounded-lg text-sm"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Tipo
          <select value={type} onChange={e => setType(e.target.value)} className="border border-line rounded-lg px-2 py-1.5 text-sm">
            {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          De
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-line rounded-lg px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Até
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-line rounded-lg px-2 py-1.5 text-sm" />
        </label>
        <button onClick={applyFilters} disabled={!dirty} className={`text-sm px-3 py-1.5 rounded-lg ${dirty ? 'bg-forest-900 text-white hover:bg-forest-800' : 'bg-stone-100 text-stone-400 cursor-default'}`}>
          {dirty ? 'Aplicar filtros' : 'Filtros aplicados'}
        </button>
        {hasFilters ? (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 text-sm text-stone-500 px-2 py-1.5 hover:text-forest-900">
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        ) : null}
      </div>

      {err && <p className="text-sm text-red-600 mb-3">Erro: {err}</p>}
      {loading ? (
        <p className="text-sm text-ink-soft">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-soft">Nenhuma alteração de plano {hasFilters ? 'para este filtro' : 'registrada ainda'}.</p>
      ) : (
        <>
          <div className="bg-white border border-line rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-paper-soft border-b border-line text-xs text-ink-soft">
                <tr>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Usuário</th>
                  <th className="text-left px-4 py-3">Mudança</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Motivo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-paper-soft">
                    <td className="px-4 py-3 text-xs text-ink-soft whitespace-nowrap">{new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="px-4 py-3 text-xs">{r.name || r.email || (r.user_id ? r.user_id.slice(0, 8) : '—')}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-flex items-center gap-1.5">{label(r.old_plan)} <ArrowRight className="w-3 h-3 text-stone-400" /> <strong className="text-forest-900">{label(r.new_plan)}</strong></span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{r.change_type || r.source || '—'}</td>
                    <td className="px-4 py-3 text-xs text-ink-soft max-w-xs truncate">{r.notes || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {onOpenUser && r.user_id && (
                        <button onClick={() => onOpenUser(r.user_id!)} className="text-xs text-forest-700 hover:text-forest-900 border border-line rounded-lg px-2 py-1 whitespace-nowrap">Ficha 360°</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3 text-xs text-ink-soft">
            <span>Página {page + 1} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="inline-flex items-center gap-1 border border-line rounded-lg px-2 py-1 disabled:opacity-40 hover:border-forest-300">
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </button>
              <button onClick={() => setPage(p => (p + 1 < totalPages ? p + 1 : p))} disabled={page + 1 >= totalPages} className="inline-flex items-center gap-1 border border-line rounded-lg px-2 py-1 disabled:opacity-40 hover:border-forest-300">
                Próxima <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
