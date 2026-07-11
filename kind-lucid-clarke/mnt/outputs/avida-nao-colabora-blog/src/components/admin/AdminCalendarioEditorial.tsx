import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { List, Columns, Plus, ChevronLeft, ChevronRight, Loader2, Pencil } from 'lucide-react'

interface Entry {
  id: string
  article_id: string | null
  title: string
  content_type: string
  category: string | null
  plan_required: string
  status: string
  scheduled_date: string | null
  origin: string
  notes: string | null
  created_at: string
}

const STATUSES = [
  { key: 'ideia', label: 'Ideia', color: 'bg-stone-100 text-stone-600' },
  { key: 'gerado_ia', label: 'Gerado IA', color: 'bg-lilac text-[#7c5cbf]' },
  { key: 'em_revisao', label: 'Em revisão', color: 'bg-[#f8e7b6] text-[#9a6a10]' },
  { key: 'aprovado', label: 'Aprovado', color: 'bg-sky text-[#245f85]' },
  { key: 'agendado', label: 'Agendado', color: 'bg-blue-100 text-blue-700' },
  { key: 'publicado', label: 'Publicado', color: 'bg-mint text-forest-700' },
  { key: 'arquivado', label: 'Arquivado', color: 'bg-stone-100 text-stone-400' },
  { key: 'precisa_atualizar', label: 'Precisa atualizar', color: 'bg-coral text-[#c05f3c]' },
] as const
const PIPELINE = ['ideia', 'gerado_ia', 'em_revisao', 'aprovado', 'agendado', 'publicado']
const PLAN_TXT: Record<string, string> = { free: 'Gratuito', essential: 'Essencial', plus: 'Plus' }
const TYPE_TXT: Record<string, string> = { article: 'Artigo', practice: 'Prática', meditation: 'Meditação' }
const label = (k: string) => STATUSES.find(s => s.key === k)?.label ?? k
const color = (k: string) => STATUSES.find(s => s.key === k)?.color ?? 'bg-stone-100 text-stone-600'

export default function AdminCalendarioEditorial({ onEditArticle }: { onEditArticle?: (id: string) => void }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [view, setView] = useState<'lista' | 'kanban'>('kanban')
  const [fPlan, setFPlan] = useState('all')
  const [fType, setFType] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  function flash(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3000) }

  // Nova pauta
  const [nTitle, setNTitle] = useState('')
  const [nType, setNType] = useState('article')
  const [nPlan, setNPlan] = useState('free')
  const [nDate, setNDate] = useState('')
  const [nNotes, setNNotes] = useState('')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('editorial_calendar').select('*').order('scheduled_date', { ascending: true, nullsFirst: false }).limit(300)
    if (error) setMissing(true)
    setEntries((data as Entry[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = entries.filter(e =>
    (fPlan === 'all' || e.plan_required === fPlan) &&
    (fType === 'all' || e.content_type === fType))

  async function move(e: Entry, dir: 1 | -1) {
    const idx = PIPELINE.indexOf(e.status)
    if (idx < 0) return
    const next = PIPELINE[Math.min(PIPELINE.length - 1, Math.max(0, idx + dir))]
    if (next === e.status) return
    setEntries(prev => prev.map(x => x.id === e.id ? { ...x, status: next } : x))
    const { error } = await supabase.from('editorial_calendar').update({ status: next }).eq('id', e.id)
    if (error) { flash('Erro ao mover: ' + error.message, true); load() }
  }

  async function setStatus(e: Entry, status: string) {
    setEntries(prev => prev.map(x => x.id === e.id ? { ...x, status } : x))
    await supabase.from('editorial_calendar').update({ status }).eq('id', e.id)
  }

  async function createEntry() {
    if (!nTitle.trim()) { flash('Informe um título.', true); return }
    setBusy(true)
    const { error } = await supabase.from('editorial_calendar').insert({
      title: nTitle, content_type: nType, plan_required: nPlan,
      scheduled_date: nDate || null, notes: nNotes || null, status: 'ideia', origin: 'manual',
    })
    setBusy(false)
    if (error) { flash('Erro: ' + error.message, true); return }
    flash('Pauta criada.'); setShowNew(false)
    setNTitle(''); setNDate(''); setNNotes('')
    load()
  }

  const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm'

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Calendário Editorial</h1>
          <p className="text-sm text-ink-soft mt-1">Da ideia à publicação — planeje, revise e acompanhe os conteúdos.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-paper-soft border border-line rounded-xl p-1">
            <button onClick={() => setView('kanban')} className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${view === 'kanban' ? 'bg-white shadow-sm text-forest-900' : 'text-ink-soft'}`}><Columns className="w-4 h-4" /> Kanban</button>
            <button onClick={() => setView('lista')} className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${view === 'lista' ? 'bg-white shadow-sm text-forest-900' : 'text-ink-soft'}`}><List className="w-4 h-4" /> Lista</button>
          </div>
          <button onClick={() => setShowNew(v => !v)} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800"><Plus className="w-4 h-4" /> Nova pauta</button>
        </div>
      </div>

      {showNew && (
        <div className="bg-white border border-line rounded-2xl p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-2"><label className="block text-xs text-stone-500 mb-1">Título</label><input value={nTitle} onChange={e => setNTitle(e.target.value)} className={inputCls} /></div>
          <div><label className="block text-xs text-stone-500 mb-1">Tipo</label><select value={nType} onChange={e => setNType(e.target.value)} className={inputCls}><option value="article">Artigo</option><option value="practice">Prática</option><option value="meditation">Meditação</option></select></div>
          <div><label className="block text-xs text-stone-500 mb-1">Plano</label><select value={nPlan} onChange={e => setNPlan(e.target.value)} className={inputCls}><option value="free">Gratuito</option><option value="essential">Essencial</option><option value="plus">Plus</option></select></div>
          <div><label className="block text-xs text-stone-500 mb-1">Data</label><input type="date" value={nDate} onChange={e => setNDate(e.target.value)} className={inputCls} /></div>
          <div className="lg:col-span-4"><label className="block text-xs text-stone-500 mb-1">Notas</label><input value={nNotes} onChange={e => setNNotes(e.target.value)} className={inputCls} /></div>
          <button onClick={createEntry} disabled={busy} className="inline-flex items-center justify-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar</button>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={fType} onChange={e => setFType(e.target.value)} className="border border-line rounded-lg px-3 py-2 text-sm"><option value="all">Todos os tipos</option><option value="article">Artigo</option><option value="practice">Prática</option><option value="meditation">Meditação</option></select>
        <select value={fPlan} onChange={e => setFPlan(e.target.value)} className="border border-line rounded-lg px-3 py-2 text-sm"><option value="all">Todos os planos</option><option value="free">Gratuito</option><option value="essential">Essencial</option><option value="plus">Plus</option></select>
      </div>

      {missing ? (
        <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-paper-soft">
          <p className="text-ink-soft text-sm">A tabela <code>editorial_calendar</code> ainda não está disponível — aplica com a migration 061 (CI). Atualize em instantes.</p>
        </div>
      ) : loading ? (
        <p className="text-ink-soft text-sm">Carregando…</p>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-paper-soft">
          <p className="text-ink-soft text-sm">Nenhuma pauta ainda. Crie uma pauta ou use a Fábrica IA em massa para popular o calendário.</p>
        </div>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
          {PIPELINE.map(st => {
            const items = filtered.filter(e => e.status === st)
            return (
              <div key={st} className="bg-paper-soft border border-line rounded-2xl p-3 min-h-[360px]">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color(st)}`}>{label(st)}</span>
                  <span className="text-xs text-ink-soft">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map(e => (
                    <div key={e.id} className="bg-white border border-line rounded-xl p-3">
                      <p className="text-sm font-medium text-forest-900 leading-tight">{e.title}</p>
                      <p className="text-[11px] text-ink-soft mt-1">{TYPE_TXT[e.content_type] ?? e.content_type} · {PLAN_TXT[e.plan_required] ?? e.plan_required}{e.scheduled_date ? ` · ${new Date(e.scheduled_date).toLocaleDateString('pt-BR')}` : ''}{e.origin === 'ia' ? ' · IA' : ''}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <button onClick={() => move(e, -1)} disabled={PIPELINE.indexOf(e.status) === 0} className="p-1 text-stone-400 hover:text-forest-700 disabled:opacity-30" title="Anterior"><ChevronLeft className="w-3.5 h-3.5" /></button>
                        <button onClick={() => move(e, 1)} disabled={PIPELINE.indexOf(e.status) === PIPELINE.length - 1} className="p-1 text-stone-400 hover:text-forest-700 disabled:opacity-30" title="Avançar"><ChevronRight className="w-3.5 h-3.5" /></button>
                        {e.article_id && onEditArticle && (
                          <button onClick={() => onEditArticle(e.article_id!)} className="ml-auto p-1 text-stone-400 hover:text-forest-700" title="Editar conteúdo"><Pencil className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-[11px] text-ink-soft text-center py-4">—</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-line rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-line">
              <tr>
                <th className="text-left px-4 py-3 text-stone-500 font-medium">Título</th>
                <th className="text-left px-3 py-3 text-stone-500 font-medium hidden sm:table-cell">Tipo</th>
                <th className="text-left px-3 py-3 text-stone-500 font-medium hidden md:table-cell">Plano</th>
                <th className="text-left px-3 py-3 text-stone-500 font-medium hidden lg:table-cell">Data</th>
                <th className="text-left px-3 py-3 text-stone-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-forest-900">{e.title}</p>
                    {e.notes && <p className="text-xs text-stone-400 mt-0.5">{e.notes}</p>}
                  </td>
                  <td className="px-3 py-3 text-stone-500 hidden sm:table-cell">{TYPE_TXT[e.content_type] ?? e.content_type}</td>
                  <td className="px-3 py-3 text-stone-500 hidden md:table-cell">{PLAN_TXT[e.plan_required] ?? e.plan_required}</td>
                  <td className="px-3 py-3 text-stone-400 text-xs hidden lg:table-cell">{e.scheduled_date ? new Date(e.scheduled_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-3 py-3">
                    <select value={e.status} onChange={ev => setStatus(e, ev.target.value)} className={`text-xs rounded-full px-2 py-1 border-0 font-medium ${color(e.status)}`}>
                      {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
