import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Activity, Search, RefreshCw, Download, Loader2, Users, CheckCircle2, PenLine, ClipboardList, BookOpen, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'

// Engajamento por usuário — 100% server-side (RPCs get_user_engagement_page /
// get_user_engagement_summary, migration 20260908200000). Busca, filtros,
// ordenação e paginação NÃO acontecem mais no navegador.
//
// Thresholds do bucket (definidos no SQL, iguais aos históricos):
//   ativo ≤ 3 dias · esfriando 4–13 · inativo 14+ · nunca = sem atividade.

interface Row {
  user_id: string
  full_name: string | null
  email: string | null
  plan: string
  role: string
  created_at: string
  last_seen_at: string | null
  last_checkin: string | null
  last_diary: string | null
  last_questionnaire: string | null
  last_content: string | null
  last_activity: string | null
  checkins_30d: number
  diaries_30d: number
  questionnaires_30d: number
  contents_30d: number
  checkins_total: number
  diaries_total: number
  bucket: Bucket
  total_count: number
}

interface Summary { total: number; ativo: number; esfriando: number; inativo: number; nunca: number }

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', plus: 'Plus',
  therapeutic: 'Plus', 'therapeutic-plus': 'Plus',
}
const PLAN_COLORS: Record<string, string> = {
  free: 'bg-stone-100 text-stone-600',
  essential: 'bg-blue-100 text-blue-700',
  plus: 'bg-mint text-forest-800',
}
const planLabel = (p: string) => PLAN_LABELS[p] ?? p

const DAY = 86400000
const PAGE_SIZE = 50
function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function agoLabel(d: number | null): string {
  if (d === null) return 'nunca'
  if (d <= 0) return 'hoje'
  if (d === 1) return 'ontem'
  return `há ${d} dias`
}

type Bucket = 'ativo' | 'esfriando' | 'inativo' | 'nunca'
const BUCKET_META: Record<Bucket, { label: string; cls: string; dot: string; row: string; bar: string }> = {
  ativo:     { label: 'Ativo',           cls: 'bg-forest-100 text-forest-800', dot: 'bg-forest-500', row: 'bg-mint/25',     bar: 'border-l-forest-500' },
  esfriando: { label: 'Esfriando',       cls: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400',  row: 'bg-amber-50/60', bar: 'border-l-amber-400' },
  inativo:   { label: 'Inativo',         cls: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    row: 'bg-red-50/60',   bar: 'border-l-red-400' },
  nunca:     { label: 'Nunca interagiu', cls: 'bg-stone-100 text-stone-500',   dot: 'bg-stone-300',  row: '',               bar: 'border-l-stone-300' },
}

const SORTS = [
  { id: 'last_activity', label: 'Última atividade' },
  { id: 'created_at', label: 'Cadastro' },
  { id: 'full_name', label: 'Nome' },
  { id: 'checkins_30d', label: 'Check-ins (30d)' },
  { id: 'diaries_30d', label: 'Diários (30d)' },
]

export default function AdminEngagement() {
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, ativo: 0, esfriando: 0, inativo: 0, nunca: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [err, setErr] = useState('')

  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | Bucket>('todos')
  const [planFilter, setPlanFilter] = useState('todos')
  const [hideAdmins, setHideAdmins] = useState(true)
  const [sort, setSort] = useState('last_activity')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')

  // Debounce da busca (aplica sozinho após parar de digitar).
  const debounceRef = useRef<number | null>(null)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => { setAppliedSearch(search); setPage(0) }, 350)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [search])

  const filterArgs = useMemo(() => ({
    p_search: appliedSearch || null,
    p_plan: planFilter === 'todos' ? null : planFilter,
    p_bucket: statusFilter === 'todos' ? null : statusFilter,
    p_hide_admins: hideAdmins,
  }), [appliedSearch, planFilter, statusFilter, hideAdmins])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const [pageRes, sumRes] = await Promise.all([
      supabase.rpc('get_user_engagement_page', {
        ...filterArgs, p_sort: sort, p_dir: dir, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE,
      }),
      supabase.rpc('get_user_engagement_summary', {
        p_search: filterArgs.p_search, p_plan: filterArgs.p_plan, p_hide_admins: filterArgs.p_hide_admins,
      }),
    ])
    if (pageRes.error) { setErr(pageRes.error.message); setRows([]); setLoading(false); return }
    const list = (pageRes.data as Row[]) ?? []
    setRows(list)
    setTotal(list[0]?.total_count ?? 0)
    if (!sumRes.error && sumRes.data) setSummary(sumRes.data as Summary)
    setLoading(false)
  }, [filterArgs, sort, dir, page])

  useEffect(() => { void load() }, [load])

  async function exportCSV() {
    setExporting(true)
    try {
      const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const header = [
        'Nome', 'E-mail', 'Plano', 'Status', 'Dias sem interagir', 'Última atividade',
        'Último acesso', 'Último check-in', 'Último diário', 'Último questionário', 'Último conteúdo',
        'Check-ins 30d', 'Diários 30d', 'Questionários 30d', 'Conteúdos 30d', 'Check-ins total', 'Diários total',
      ]
      const all: Row[] = []
      for (let offset = 0; offset < 20000; offset += 200) {
        const { data, error } = await supabase.rpc('get_user_engagement_page', {
          ...filterArgs, p_sort: sort, p_dir: dir, p_limit: 200, p_offset: offset,
        })
        if (error) { setErr(error.message); break }
        const chunk = (data as Row[]) ?? []
        all.push(...chunk)
        if (chunk.length < 200) break
      }
      const lines = all.map(r => {
        const dias = daysSince(r.last_activity)
        return [
          r.full_name ?? '', r.email ?? '', planLabel(r.plan), BUCKET_META[r.bucket].label,
          dias === null ? 'nunca' : dias,
          fmtDate(r.last_activity), fmtDate(r.last_seen_at), fmtDate(r.last_checkin), fmtDate(r.last_diary),
          fmtDate(r.last_questionnaire), fmtDate(r.last_content),
          r.checkins_30d, r.diaries_30d, r.questionnaires_30d, r.contents_30d, r.checkins_total, r.diaries_total,
        ]
      })
      const bom = String.fromCharCode(0xFEFF)
      const blob = new Blob([bom + [header, ...lines].map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `engajamento-${new Date().toISOString().slice(0, 10)}.csv`
      a.click(); URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const cards: { key: Bucket; label: string; n: number; tone: string }[] = [
    { key: 'ativo', label: 'Ativos (≤3 dias)', n: summary.ativo, tone: 'text-forest-700' },
    { key: 'esfriando', label: 'Esfriando (4–13 dias)', n: summary.esfriando, tone: 'text-amber-600' },
    { key: 'inativo', label: 'Inativos (14+ dias)', n: summary.inativo, tone: 'text-red-600' },
    { key: 'nunca', label: 'Nunca interagiram', n: summary.nunca, tone: 'text-stone-500' },
  ]

  function setStatus(next: 'todos' | Bucket) { setStatusFilter(next); setPage(0) }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900 flex items-center gap-2"><Activity className="w-6 h-6 text-forest-600" /> Engajamento</h1>
          <p className="text-sm text-ink-soft mt-1">Quem está ativo, onde cada pessoa interage e há quantos dias quem sumiu não registra. Atividade = check-in, diário, questionário ou acesso ao site.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          <button onClick={() => void exportCSV()} disabled={loading || exporting || total === 0} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Extrair relatório
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {cards.map(c => {
          const active = statusFilter === c.key
          return (
            <button key={c.key} onClick={() => setStatus(active ? 'todos' : c.key)}
              className={`text-left bg-white border rounded-2xl p-4 transition-all ${active ? 'border-forest-400 ring-1 ring-forest-200' : 'border-line hover:border-forest-200'}`}>
              <p className={`font-serif text-3xl ${c.tone}`}>{loading ? '—' : c.n.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-ink-soft mt-1 leading-snug">{c.label}</p>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail…"
            className="w-full pl-9 pr-3 py-2.5 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-300" />
        </div>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(0) }} className="text-sm px-3 py-2.5 border border-line rounded-xl bg-white">
          <option value="todos">Todos os planos</option>
          <option value="free">Gratuito</option>
          <option value="essential">Essencial</option>
          <option value="plus">Plus</option>
        </select>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(0) }} className="text-sm px-3 py-2.5 border border-line rounded-xl bg-white">
          {SORTS.map(s => <option key={s.id} value={s.id}>Ordenar: {s.label}</option>)}
        </select>
        <button onClick={() => { setDir(d => (d === 'asc' ? 'desc' : 'asc')); setPage(0) }} className="inline-flex items-center gap-1 text-xs border border-line bg-white px-2.5 py-2.5 rounded-xl hover:border-forest-300">
          <ArrowUpDown className="w-3.5 h-3.5" /> {dir === 'asc' ? 'crescente' : 'decrescente'}
        </button>
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-soft px-2 cursor-pointer">
          <input type="checkbox" checked={hideAdmins} onChange={e => { setHideAdmins(e.target.checked); setPage(0) }} className="w-4 h-4 rounded border-stone-300 text-forest-700" />
          Ocultar admins
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <span className="text-xs text-ink-soft mr-1">Filtrar:</span>
        {([
          ['todos', 'Todos', summary.total],
          ['ativo', 'Ativos', summary.ativo],
          ['esfriando', 'Esfriando', summary.esfriando],
          ['inativo', 'Inativos', summary.inativo],
          ['nunca', 'Não interagem', summary.nunca],
        ] as const).map(([key, label, n]) => {
          const active = statusFilter === key
          return (
            <button key={key} onClick={() => setStatus(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${active ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-ink-soft hover:border-forest-300 hover:text-forest-900'}`}>
              {key !== 'todos' && <span className={`w-2 h-2 rounded-full ${BUCKET_META[key].dot}`} />}
              {label}
              <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-stone-100 text-stone-500'}`}>{n.toLocaleString('pt-BR')}</span>
            </button>
          )
        })}
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        {err && <p className="px-5 py-3 text-sm text-red-600">Erro ao carregar: {err}</p>}
        {loading ? (
          <p className="px-5 py-8 text-sm text-ink-soft flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando engajamento…</p>
        ) : rows.length === 0 ? (
          <div className="px-5 py-14 text-center text-stone-400">
            <Users className="w-9 h-9 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum usuário com os filtros aplicados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-line">
                <tr>
                  <th className="text-left px-4 py-2.5 text-stone-500 font-medium">Usuário</th>
                  <th className="text-left px-4 py-2.5 text-stone-500 font-medium">Plano</th>
                  <th className="text-left px-4 py-2.5 text-stone-500 font-medium">Onde interage (30 dias)</th>
                  <th className="text-left px-4 py-2.5 text-stone-500 font-medium">Última atividade</th>
                  <th className="text-left px-4 py-2.5 text-stone-500 font-medium">Dias sem interagir</th>
                  <th className="text-left px-4 py-2.5 text-stone-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map(r => {
                  const dias = daysSince(r.last_activity)
                  const chips: { icon: typeof CheckCircle2; label: string; n: number }[] = [
                    { icon: CheckCircle2, label: 'Check-in', n: r.checkins_30d },
                    { icon: PenLine, label: 'Diário', n: r.diaries_30d },
                    { icon: ClipboardList, label: 'Questionário', n: r.questionnaires_30d },
                    { icon: BookOpen, label: 'Conteúdo', n: r.contents_30d },
                  ].filter(c => c.n > 0)
                  const meta = BUCKET_META[r.bucket] ?? BUCKET_META.nunca
                  return (
                    <tr key={r.user_id} className={`align-top ${meta.row}`}>
                      <td className={`px-4 py-3 border-l-4 ${meta.bar}`}>
                        <p className="font-medium text-forest-900">{r.full_name || '—'}</p>
                        <p className="text-xs text-stone-400">{r.email ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[r.plan] ?? 'bg-stone-100 text-stone-600'}`}>{planLabel(r.plan)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {chips.length === 0 ? (
                          <span className="text-xs text-stone-400">— sem registros em 30 dias</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {chips.map(c => (
                              <span key={c.label} className="inline-flex items-center gap-1 text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                                <c.icon className="w-3 h-3" /> {c.label} {c.n}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-forest-900">{fmtDate(r.last_activity)}</span>
                        <span className="block text-[11px] text-stone-400">{agoLabel(dias)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-serif text-lg ${r.bucket === 'inativo' ? 'text-red-600' : r.bucket === 'esfriando' ? 'text-amber-600' : 'text-forest-900'}`}>
                          {dias === null ? '—' : dias}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />{meta.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 text-xs text-stone-400 border-t border-line">
            <span>{total.toLocaleString('pt-BR')} usuário(s) · página {page + 1} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="inline-flex items-center gap-1 border border-line rounded-lg px-2 py-1 disabled:opacity-40 hover:border-forest-300">
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </button>
              <button onClick={() => setPage(p => (p + 1 < totalPages ? p + 1 : p))} disabled={page + 1 >= totalPages} className="inline-flex items-center gap-1 border border-line rounded-lg px-2 py-1 disabled:opacity-40 hover:border-forest-300">
                Próxima <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
