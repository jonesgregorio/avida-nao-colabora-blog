import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, Filter, Mail, RefreshCw, Search, Sparkles, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Row = {
  user_id: string
  full_name: string | null
  email: string | null
  plan: string | null
  created_at: string
  plan_activated_at: string | null
  last_seen_at: string | null
  checkins_total: number
  diaries_total: number
  last_onboarding_email: string | null
  last_onboarding_template: string | null
  onboarding_status: string
  total_count: number
}

type Summary = {
  total: number
  aguardando_checkin: number
  aguardando_diario: number
  conhecendo_plano: number
  concluido: number
}

const PAGE_SIZES = [10, 20, 50, 100]
const STATUS = [
  { value: 'todos', label: 'Todas as etapas' },
  { value: 'aguardando_checkin', label: 'Ainda sem primeiro Check-in' },
  { value: 'aguardando_diario', label: 'Check-in feito, Diário ainda não' },
  { value: 'conhecendo_plano', label: 'Conhecendo plano novo' },
  { value: 'concluido', label: 'Base do onboarding concluída' },
]
const PLANS = [
  { value: 'todos', label: 'Todos os planos' },
  { value: 'free', label: 'Gratuito' },
  { value: 'essential', label: 'Essencial' },
  { value: 'plus', label: 'Plus' },
]

const STATUS_LABEL: Record<string, string> = {
  aguardando_checkin: 'Sem primeiro Check-in',
  aguardando_diario: 'Conhecendo o Diário',
  conhecendo_plano: 'Conhecendo o plano',
  concluido: 'Base concluída',
}
const TEMPLATE_LABEL: Record<string, string> = {
  value_onboarding_first_checkin: 'Primeiro Check-in',
  value_onboarding_diary: 'Conhecer o Diário',
  value_onboarding_plan_return: 'Retorno ao plano',
}
const PLAN_LABEL: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', plus: 'Plus', therapeutic: 'Plus', 'therapeutic-plus': 'Plus',
}

function fmtDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
function csvCell(value: unknown) {
  let text = String(value ?? '')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export default function AdminOnboarding() {
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, aguardando_checkin: 0, aguardando_diario: 0, conhecendo_plano: 0, concluido: 0 })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [plan, setPlan] = useState('todos')
  const [status, setStatus] = useState('todos')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])
  useEffect(() => setPage(1), [debouncedSearch, plan, status, pageSize])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = {
      p_search: debouncedSearch || null,
      p_plan: plan === 'todos' ? null : plan,
      p_status: status === 'todos' ? null : status,
    }
    const [pageRes, summaryRes] = await Promise.all([
      supabase.rpc('admin_onboarding_page', { ...params, p_limit: pageSize, p_offset: (page - 1) * pageSize }),
      supabase.rpc('admin_onboarding_summary', params),
    ])
    if (pageRes.error || summaryRes.error) {
      setError(pageRes.error?.message || summaryRes.error?.message || 'Não foi possível carregar o onboarding.')
      setRows([])
      setLoading(false)
      return
    }
    setRows((pageRes.data ?? []) as Row[])
    setSummary((summaryRes.data ?? {}) as Summary)
    setLoading(false)
  }, [debouncedSearch, plan, status, pageSize, page])

  useEffect(() => { void load() }, [load])

  const total = Number(rows[0]?.total_count ?? 0)
  const pages = Math.max(1, Math.ceil(total / pageSize))
  useEffect(() => { if (page > pages) setPage(pages) }, [page, pages])

  const cards = useMemo(() => [
    { label: 'Em onboarding', value: summary.total ?? 0, icon: UserRound },
    { label: 'Sem primeiro Check-in', value: summary.aguardando_checkin ?? 0, icon: Sparkles },
    { label: 'Diário ainda não usado', value: summary.aguardando_diario ?? 0, icon: Mail },
    { label: 'Conhecendo plano novo', value: summary.conhecendo_plano ?? 0, icon: CheckCircle2 },
  ], [summary])

  async function exportCsv() {
    setExporting(true)
    setError('')
    const { data, error: exportError } = await supabase.rpc('admin_onboarding_page', {
      p_search: debouncedSearch || null,
      p_plan: plan === 'todos' ? null : plan,
      p_status: status === 'todos' ? null : status,
      p_limit: 5000,
      p_offset: 0,
    })
    if (exportError) {
      setError(exportError.message)
      setExporting(false)
      return
    }
    const exportRows = (data ?? []) as Row[]
    const header = ['Nome', 'E-mail', 'Plano', 'Etapa', 'Check-ins', 'Diários', 'Conta criada em', 'Plano ativado em', 'Último acesso', 'Último e-mail onboarding', 'Tipo do último e-mail']
    const body = exportRows.map(row => [
      row.full_name || '', row.email || '', PLAN_LABEL[row.plan || ''] || row.plan || '', STATUS_LABEL[row.onboarding_status] || row.onboarding_status,
      row.checkins_total, row.diaries_total, fmtDate(row.created_at), fmtDate(row.plan_activated_at), fmtDate(row.last_seen_at), fmtDate(row.last_onboarding_email),
      TEMPLATE_LABEL[row.last_onboarding_template || ''] || row.last_onboarding_template || '',
    ].map(csvCell).join(','))
    const blob = new Blob([`\uFEFF${header.map(csvCell).join(',')}\n${body.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `avnc-onboarding-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="admin-kicker">Jornada inicial</p>
          <h2 className="font-serif text-2xl text-forest-900">Onboarding</h2>
          <p className="text-sm text-ink-soft mt-1 max-w-3xl">Acompanhe quem ainda está conhecendo o espaço e o plano. As etapas usam apenas sinais de uso — nunca o texto do Diário ou respostas emocionais.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="admin-btn-secondary" disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
          <button type="button" onClick={() => void exportCsv()} className="admin-btn-secondary" disabled={exporting}><Download className="w-4 h-4" /> {exporting ? 'Gerando…' : 'Exportar CSV'}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(({ label, value, icon: Icon }) => <div key={label} className="admin-card p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs text-ink-soft">{label}</p><Icon className="w-4 h-4 text-forest-600" /></div><p className="font-serif text-2xl text-forest-900 mt-2">{value}</p></div>)}
      </div>

      <div className="admin-card p-4 flex flex-col lg:flex-row gap-3">
        <label className="relative flex-1 min-w-[220px]">
          <span className="sr-only">Buscar usuário</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" className="w-full rounded-xl border border-line bg-white pl-9 pr-3 py-2.5 text-sm" />
        </label>
        <label className="flex items-center gap-2"><Filter className="w-4 h-4 text-ink-soft" /><span className="sr-only">Plano</span><select value={plan} onChange={e => setPlan(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm">{PLANS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
        <label><span className="sr-only">Etapa</span><select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm">{STATUS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
        <label className="flex items-center gap-2 text-xs text-ink-soft whitespace-nowrap">Por página<select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="rounded-xl border border-line bg-white px-2.5 py-2 text-sm text-forest-900">{PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-paper-soft text-left text-xs text-ink-soft"><tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Plano</th><th className="px-4 py-3">Etapa</th><th className="px-4 py-3">Uso inicial</th><th className="px-4 py-3">Último e-mail</th><th className="px-4 py-3">Último acesso</th></tr></thead>
            <tbody className="divide-y divide-line">
              {loading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-soft">Carregando onboarding…</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-soft">Nenhum usuário encontrado com esses filtros.</td></tr> : rows.map(row => <tr key={row.user_id} className="align-top">
                <td className="px-4 py-3"><p className="font-medium text-forest-900">{row.full_name || 'Sem nome informado'}</p><p className="text-xs text-ink-soft mt-0.5">{row.email || '—'}</p><p className="text-[11px] text-ink-soft mt-1">Conta: {fmtDate(row.created_at)}</p></td>
                <td className="px-4 py-3"><span className="inline-flex rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-forest-800">{PLAN_LABEL[row.plan || ''] || row.plan || '—'}</span>{row.plan_activated_at && <p className="text-[11px] text-ink-soft mt-1.5">Ativado: {fmtDate(row.plan_activated_at)}</p>}</td>
                <td className="px-4 py-3"><span className="text-sm font-medium text-forest-800">{STATUS_LABEL[row.onboarding_status] || row.onboarding_status}</span></td>
                <td className="px-4 py-3"><p className="text-xs text-ink-soft"><strong className="text-forest-900">{row.checkins_total}</strong> Check-in(s)</p><p className="text-xs text-ink-soft mt-1"><strong className="text-forest-900">{row.diaries_total}</strong> registro(s) de Diário</p></td>
                <td className="px-4 py-3"><p className="text-xs text-forest-800">{TEMPLATE_LABEL[row.last_onboarding_template || ''] || 'Nenhum e-mail de onboarding'}</p><p className="text-[11px] text-ink-soft mt-1">{fmtDate(row.last_onboarding_email)}</p></td>
                <td className="px-4 py-3 text-xs text-ink-soft">{fmtDate(row.last_seen_at)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
          <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}` : '0 resultados'}</span>
          <div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="admin-btn-secondary !py-1.5 disabled:opacity-40">Anterior</button><span>Página {page} de {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))} className="admin-btn-secondary !py-1.5 disabled:opacity-40">Próxima</button></div>
        </div>
      </div>
    </div>
  )
}
