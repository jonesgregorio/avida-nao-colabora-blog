import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { logAdminAction } from '../../lib/adminAudit'
import { PREDEFINED_TAGS } from './adminUsersModel'
import { Users, RefreshCw, Loader2, Tag, Bell, Save, ListFilter } from 'lucide-react'

type SegFilter = {
  plans?: string[]
  statuses?: string[]
  access?: string[]
  tags?: string[]
  tags_mode?: 'any' | 'all'
  signup_from?: string | null
  signup_to?: string | null
  inactive_days?: number | null
  active_within_days?: number | null
  subscription?: string | null
}

interface SampleRow { user_id: string; full_name: string | null; email: string | null; plan: string; account_status: string }
interface ListRow extends SampleRow { admin_tags: string[] | null; created_at: string; last_seen_at: string | null }
interface SavedSegment { id: string; name: string; description: string | null; filter: SegFilter }

const PLANS = [['free', 'Gratuito'], ['essential', 'Essencial'], ['plus', 'Plus']] as const
const STATUSES = [['active', 'Ativa'], ['blocked', 'Bloqueada'], ['suspended', 'Suspensa'], ['cancelled', 'Cancelada']] as const
const ACCESS = [
  ['discount', 'Com desconto'], ['unlimited', 'Acesso ilimitado'], ['admin', 'Administrador'],
  ['open_ticket', 'Suporte em aberto'], ['unread_notif', 'Notificação não lida'],
] as const
const SUBS = [['', 'Qualquer'], ['active', 'Assinatura ativa'], ['canceling', 'Cancelando no fim do ciclo'], ['none', 'Sem assinatura']] as const

const box = 'text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer select-none'
const on = 'bg-forest-600 text-white border-forest-600'
const off = 'bg-white text-stone-600 border-line hover:border-forest-300'

function csvEscape(v: string) { return `"${v.replace(/"/g, '""')}"` }

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

export default function AdminSegments() {
  const [filter, setFilter] = useState<SegFilter>({ tags_mode: 'any' })
  const [count, setCount] = useState<number | null>(null)
  const [sample, setSample] = useState<SampleRow[]>([])
  const [previewing, setPreviewing] = useState(false)
  const [notAvailable, setNotAvailable] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [listRows, setListRows] = useState<ListRow[] | null>(null)
  const [listLoading, setListLoading] = useState(false)

  const [saved, setSaved] = useState<SavedSegment[]>([])
  const [busy, setBusy] = useState(false)

  const toggle = (key: keyof SegFilter, value: string) => {
    setFilter(f => {
      const arr = new Set((f[key] as string[] | undefined) ?? [])
      if (arr.has(value)) arr.delete(value); else arr.add(value)
      return { ...f, [key]: [...arr] }
    })
  }
  const has = (key: keyof SegFilter, value: string) => ((filter[key] as string[] | undefined) ?? []).includes(value)

  const cleanFilter = useMemo<SegFilter>(() => {
    const f: SegFilter = {}
    if (filter.plans?.length) f.plans = filter.plans
    if (filter.statuses?.length) f.statuses = filter.statuses
    if (filter.access?.length) f.access = filter.access
    if (filter.tags?.length) { f.tags = filter.tags; f.tags_mode = filter.tags_mode ?? 'any' }
    if (filter.signup_from) f.signup_from = filter.signup_from
    if (filter.signup_to) f.signup_to = filter.signup_to
    if (filter.inactive_days != null) f.inactive_days = filter.inactive_days
    if (filter.active_within_days != null) f.active_within_days = filter.active_within_days
    if (filter.subscription) f.subscription = filter.subscription
    return f
  }, [filter])

  const isEmpty = Object.keys(cleanFilter).length === 0

  const runPreview = useCallback(async () => {
    setPreviewing(true); setErr(''); setListRows(null)
    const { data, error } = await supabase.rpc('admin_segment_preview', { p_filter: cleanFilter })
    if (error) {
      if ((error as { code?: string }).code === 'PGRST202') setNotAvailable(true)
      else setErr(error.message)
      setCount(null); setSample([])
    } else {
      const p = (data ?? {}) as { count?: number; sample?: SampleRow[] }
      setCount(p.count ?? 0); setSample(p.sample ?? [])
    }
    setPreviewing(false)
  }, [cleanFilter])

  useEffect(() => {
    const t = setTimeout(runPreview, 400)
    return () => clearTimeout(t)
  }, [runPreview])

  const loadSaved = useCallback(async () => {
    const { data, error } = await supabase.from('admin_segments').select('id, name, description, filter').order('created_at', { ascending: false })
    if (!error) setSaved((data ?? []) as SavedSegment[])
  }, [])
  useEffect(() => { loadSaved() }, [loadSaved])

  async function verLista() {
    setListLoading(true); setErr('')
    const { data, error } = await supabase.rpc('admin_segment_list', { p_filter: cleanFilter, p_limit: 1000, p_offset: 0 })
    if (error) setErr(error.message)
    else setListRows(((data ?? {}) as { rows?: ListRow[] }).rows ?? [])
    setListLoading(false)
  }

  function exportCsv() {
    const rows = listRows ?? []
    const cols: [string, (r: ListRow) => string][] = [
      ['Nome', r => r.full_name ?? ''], ['E-mail', r => r.email ?? ''], ['ID', r => r.user_id],
      ['Plano', r => r.plan], ['Status', r => r.account_status], ['Etiquetas', r => (r.admin_tags ?? []).join('; ')],
      ['Cadastro', r => new Date(r.created_at).toLocaleDateString('pt-BR')],
    ]
    const csv = '﻿' + [cols.map(c => csvEscape(c[0])).join(','), ...rows.map(r => cols.map(c => csvEscape(c[1](r))).join(','))].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `segmento-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // Confirmação forte: o admin digita a contagem exata.
  function confirmMass(action: string, n: number): boolean {
    const typed = window.prompt(`${action}\n\nIsto afeta ${n} usuário(s). Para confirmar, digite o número ${n}:`)
    return typed?.trim() === String(n)
  }

  async function aplicarEtiqueta() {
    if (!count) return
    const tag = window.prompt('Etiqueta a adicionar em todos os usuários do segmento:')?.trim()
    if (!tag) return
    if (!confirmMass(`Adicionar a etiqueta "${tag}"`, count)) return
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.rpc('admin_segment_apply_tag', { p_filter: cleanFilter, p_tag: tag })
    if (error) setMsg({ ok: false, text: 'Falha: ' + error.message })
    else {
      const n = (data as number) ?? 0
      void logAdminAction('config', 'segment_tag', tag, { affected: n, filter: cleanFilter })
      setMsg({ ok: true, text: `Etiqueta "${tag}" adicionada a ${n} usuário(s) (os que já tinham foram ignorados).` })
    }
    setBusy(false)
  }

  async function enviarNotificacao() {
    if (!count) return
    const title = window.prompt('Título da notificação:')?.trim()
    if (!title) return
    const body = window.prompt('Texto da notificação:')?.trim()
    if (!body) return
    if (!confirmMass(`Enviar notificação "${title}"`, count)) return
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.rpc('admin_segment_notify', {
      p_filter: cleanFilter, p_title: title, p_message: body, p_destination: 'notifications',
    })
    if (error) setMsg({ ok: false, text: 'Falha: ' + error.message })
    else {
      const n = (data as number) ?? 0
      void logAdminAction('config', 'segment_notify', title, { sent: n, filter: cleanFilter })
      setMsg({ ok: true, text: `Notificação enviada para ${n} usuário(s) (quem já recebeu igual nas últimas 24h foi ignorado).` })
    }
    setBusy(false)
  }

  async function salvarPublico() {
    const name = window.prompt('Nome do público salvo:')?.trim()
    if (!name) return
    const { error } = await supabase.from('admin_segments').insert({ name, filter: cleanFilter })
    if (error) setMsg({ ok: false, text: 'Falha ao salvar: ' + error.message })
    else {
      void logAdminAction('create', 'admin_segment', name, { filter: cleanFilter })
      setMsg({ ok: true, text: `Público "${name}" salvo.` })
      loadSaved()
    }
  }

  // Atualiza um público salvo com os critérios atuais do construtor.
  async function atualizarPublico(s: SavedSegment) {
    if (isEmpty) { setMsg({ ok: false, text: 'Defina critérios antes de atualizar.' }); return }
    if (!window.confirm(`Substituir os critérios de "${s.name}" pelos critérios atuais?`)) return
    const { error } = await supabase.from('admin_segments').update({ filter: cleanFilter, updated_at: new Date().toISOString() }).eq('id', s.id)
    if (error) { setMsg({ ok: false, text: 'Falha: ' + error.message }); return }
    void logAdminAction('update', 'admin_segment', s.id, { name: s.name, filter: cleanFilter })
    setMsg({ ok: true, text: `Público "${s.name}" atualizado.` })
    loadSaved()
  }

  async function excluirPublico(s: SavedSegment) {
    if (!window.confirm(`Excluir o público salvo "${s.name}"? Campanhas já enviadas não são afetadas.`)) return
    const { error } = await supabase.from('admin_segments').delete().eq('id', s.id)
    if (error) { setMsg({ ok: false, text: 'Falha: ' + error.message }); return }
    void logAdminAction('delete', 'admin_segment', s.id, { name: s.name })
    setMsg({ ok: true, text: `Público "${s.name}" excluído.` })
    loadSaved()
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900 flex items-center gap-2">
            <ListFilter className="w-6 h-6 text-forest-600" /> Segmentação de usuários
          </h1>
          <p className="text-sm text-ink-soft mt-1">
            Combine critérios para formar um público. A contagem aparece antes de qualquer ação, e toda ação em massa pede confirmação.
          </p>
        </div>
        <button onClick={runPreview} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300">
          <RefreshCw className={`w-4 h-4 ${previewing ? 'animate-spin' : ''}`} /> Recalcular
        </button>
      </div>

      {notAvailable && (
        <div className="mb-4 text-sm bg-amber-50 border border-amber-200 text-amber-800 px-3.5 py-2.5 rounded-xl">
          A segmentação avançada fica disponível após o deploy desta etapa.
        </div>
      )}
      {err && <div className="mb-4 text-sm bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl">{err}</div>}
      {msg && <div className={`mb-4 text-sm px-3.5 py-2.5 rounded-xl border ${msg.ok ? 'bg-mint/50 text-forest-800 border-forest-100' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg.text}</div>}

      <div className="grid md:grid-cols-[1fr_260px] gap-6">
        <div className="space-y-4 bg-white border border-line rounded-2xl p-5">
          <Section title="Plano">
            {PLANS.map(([k, l]) => (
              <span key={k} className={`${box} ${has('plans', k) ? on : off}`} onClick={() => toggle('plans', k)}>{l}</span>
            ))}
          </Section>
          <Section title="Situação da conta">
            {STATUSES.map(([k, l]) => (
              <span key={k} className={`${box} ${has('statuses', k) ? on : off}`} onClick={() => toggle('statuses', k)}>{l}</span>
            ))}
          </Section>
          <Section title="Sinais">
            {ACCESS.map(([k, l]) => (
              <span key={k} className={`${box} ${has('access', k) ? on : off}`} onClick={() => toggle('access', k)}>{l}</span>
            ))}
          </Section>
          <Section title="Etiquetas">
            {PREDEFINED_TAGS.map(t => (
              <span key={t} className={`${box} ${has('tags', t) ? on : off}`} onClick={() => toggle('tags', t)}>{t}</span>
            ))}
            {(filter.tags?.length ?? 0) > 1 && (
              <label className="text-xs text-stone-500 flex items-center gap-1 ml-1">
                <input type="checkbox" checked={filter.tags_mode === 'all'}
                  onChange={e => setFilter(f => ({ ...f, tags_mode: e.target.checked ? 'all' : 'any' }))} />
                exige todas
              </label>
            )}
          </Section>

          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <label className="text-xs text-stone-500 space-y-1">
              <span>Cadastro de</span>
              <input type="date" value={filter.signup_from ?? ''} onChange={e => setFilter(f => ({ ...f, signup_from: e.target.value || null }))} className="w-full px-2 py-1.5 border border-line rounded-lg text-sm" />
            </label>
            <label className="text-xs text-stone-500 space-y-1">
              <span>Cadastro até</span>
              <input type="date" value={filter.signup_to ?? ''} onChange={e => setFilter(f => ({ ...f, signup_to: e.target.value || null }))} className="w-full px-2 py-1.5 border border-line rounded-lg text-sm" />
            </label>
            <label className="text-xs text-stone-500 space-y-1">
              <span>Sem atividade há (dias)</span>
              <input type="number" min={1} value={filter.inactive_days ?? ''} onChange={e => setFilter(f => ({ ...f, inactive_days: e.target.value ? Number(e.target.value) : null }))} className="w-full px-2 py-1.5 border border-line rounded-lg text-sm" />
            </label>
            <label className="text-xs text-stone-500 space-y-1">
              <span>Ativo nos últimos (dias)</span>
              <input type="number" min={1} value={filter.active_within_days ?? ''} onChange={e => setFilter(f => ({ ...f, active_within_days: e.target.value ? Number(e.target.value) : null }))} className="w-full px-2 py-1.5 border border-line rounded-lg text-sm" />
            </label>
            <label className="text-xs text-stone-500 space-y-1 sm:col-span-2">
              <span>Assinatura</span>
              <select value={filter.subscription ?? ''} onChange={e => setFilter(f => ({ ...f, subscription: e.target.value || null }))} className="w-full px-2 py-1.5 border border-line rounded-lg text-sm bg-white">
                {SUBS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>

          {!isEmpty && (
            <button onClick={() => setFilter({ tags_mode: 'any' })} className="text-xs text-forest-700 underline">Limpar critérios</button>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-line rounded-2xl p-5 text-center">
            <Users className="w-6 h-6 text-forest-500 mx-auto mb-2" />
            <p className="text-3xl font-serif text-forest-900">
              {previewing ? <Loader2 className="w-6 h-6 animate-spin inline" /> : isEmpty ? '—' : (count ?? 0)}
            </p>
            <p className="text-xs text-ink-soft mt-1">{isEmpty ? 'defina ao menos um critério' : 'usuário(s) no segmento'}</p>
          </div>

          <div className="bg-white border border-line rounded-2xl p-4 space-y-2">
            <button onClick={verLista} disabled={isEmpty || !count || listLoading} className="w-full inline-flex items-center justify-center gap-2 text-sm border border-line rounded-lg py-2 hover:border-forest-300 disabled:opacity-40">
              {listLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} Ver lista
            </button>
            <button onClick={aplicarEtiqueta} disabled={isEmpty || !count || busy} className="w-full inline-flex items-center justify-center gap-2 text-sm border border-line rounded-lg py-2 hover:border-forest-300 disabled:opacity-40">
              <Tag className="w-4 h-4" /> Adicionar etiqueta
            </button>
            <button onClick={enviarNotificacao} disabled={isEmpty || !count || busy} className="w-full inline-flex items-center justify-center gap-2 text-sm border border-line rounded-lg py-2 hover:border-forest-300 disabled:opacity-40">
              <Bell className="w-4 h-4" /> Enviar notificação
            </button>
            <button onClick={salvarPublico} disabled={isEmpty} className="w-full inline-flex items-center justify-center gap-2 text-sm border border-line rounded-lg py-2 hover:border-forest-300 disabled:opacity-40">
              <Save className="w-4 h-4" /> Salvar como público
            </button>
          </div>

          {saved.length > 0 && (
            <div className="bg-white border border-line rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-2">Públicos salvos</p>
              <div className="space-y-1">
                {saved.map(s => (
                  <div key={s.id} className="flex items-center gap-1 group">
                    <button onClick={() => setFilter({ tags_mode: 'any', ...s.filter })} className="flex-1 text-left text-sm text-forest-800 hover:underline truncate">
                      {s.name}
                    </button>
                    <button onClick={() => void atualizarPublico(s)} title="Salvar critérios atuais neste público" className="text-[11px] text-stone-400 hover:text-forest-700 px-1">salvar</button>
                    <button onClick={() => void excluirPublico(s)} title="Excluir público" className="text-[11px] text-stone-400 hover:text-red-600 px-1">excluir</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {listRows && (
        <div className="mt-6 bg-white border border-line rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-sm text-forest-900 font-medium">{listRows.length} usuário(s)</p>
            <button onClick={exportCsv} className="text-xs border border-line rounded-lg px-3 py-1.5 hover:border-forest-300">Exportar CSV</button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {listRows.map(r => (
                  <tr key={r.user_id}>
                    <td className="px-4 py-2">{r.full_name || '—'}</td>
                    <td className="px-4 py-2 text-ink-soft">{r.email || '—'}</td>
                    <td className="px-4 py-2 text-xs text-ink-soft">{r.plan}</td>
                    <td className="px-4 py-2 text-xs text-ink-soft">{(r.admin_tags ?? []).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sample.length > 0 && !listRows && (
        <p className="mt-4 text-xs text-stone-400">
          Amostra: {sample.slice(0, 8).map(s => s.full_name || s.email || s.user_id.slice(0, 6)).join(' · ')}
          {count && count > 8 ? ` … +${count - 8}` : ''}
        </p>
      )}
    </div>
  )
}
