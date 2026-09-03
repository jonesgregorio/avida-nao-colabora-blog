import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bookmark, CalendarDays, Check, Eye, EyeOff, Loader2, Pencil, Plus, Save, Sparkles, Star, Trash2, X } from 'lucide-react'
import {
  createHistoryMilestone,
  deleteHistoryItem,
  loadHistoryManagementItems,
  setMonthHistoryControl,
  updateHistoryMilestone,
  type HistoryManagementItem,
} from '../lib/historyManagement'
import type { HistoryMonth } from '../lib/myHistory'

type Props = {
  userId: string
  months: HistoryMonth[]
  onBack: () => void
  onChanged?: () => void
  startCreating?: boolean
}

type Tab = 'milestones' | 'periods' | 'privacy'

type FormState = { title: string; description: string; eventDate: string; category: string }
const emptyForm = (): FormState => ({ title: '', description: '', eventDate: new Date().toISOString().slice(0, 10), category: '' })

function formatDate(value: string | null) {
  if (!value) return 'Sem data'
  const [y,m,d] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(y,m-1,d,12))
}

export default function MyHistoryManager({ userId, months, onBack, onChanged, startCreating = false }: Props) {
  const [tab, setTab] = useState<Tab>('milestones')
  const [items, setItems] = useState<HistoryManagementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(startCreating)
  const [form, setForm] = useState<FormState>(emptyForm)

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try { setItems(await loadHistoryManagementItems(userId)) }
    catch { setError('Não foi possível carregar suas preferências da história.') }
    finally { setLoading(false) }
  }, [userId])
  useEffect(() => { void refresh() }, [refresh])

  const milestones = useMemo(() => items.filter(i => i.item_type === 'milestone'), [items])
  const hidden = useMemo(() => new Set(items.filter(i => i.item_type === 'hidden_month').map(i => i.reference_key).filter(Boolean) as string[]), [items])
  const highlighted = useMemo(() => new Set(items.filter(i => i.item_type === 'highlight_month').map(i => i.reference_key).filter(Boolean) as string[]), [items])

  function startEdit(item: HistoryManagementItem) {
    setEditingId(item.id); setCreating(true)
    setForm({ title: item.title ?? '', description: item.description ?? '', eventDate: item.event_date ?? new Date().toISOString().slice(0,10), category: item.category ?? '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function cancelForm() { setCreating(false); setEditingId(null); setForm(emptyForm()); setError('') }

  async function saveMilestone() {
    if (!form.title.trim() || !form.eventDate) { setError('Informe um título e uma data para o marco.'); return }
    setSaving(true); setError(''); setMessage('')
    try {
      if (editingId) await updateHistoryMilestone(editingId, userId, form)
      else await createHistoryMilestone(userId, form)
      await refresh(); cancelForm(); setMessage(editingId ? 'Marco atualizado.' : 'Marco adicionado à sua história.'); onChanged?.()
    } catch { setError('Não foi possível salvar este marco. Tente novamente.') }
    finally { setSaving(false) }
  }
  async function removeItem(id: string) {
    if (!window.confirm('Remover este marco da sua história? O Diário não será alterado.')) return
    setSaving(true); setError('')
    try { await deleteHistoryItem(id, userId); await refresh(); setMessage('Marco removido.'); onChanged?.() }
    catch { setError('Não foi possível remover este marco.') }
    finally { setSaving(false) }
  }
  async function toggleMonth(monthKey: string, type: 'hidden_month' | 'highlight_month', enabled: boolean) {
    setSaving(true); setError(''); setMessage('')
    try { await setMonthHistoryControl(userId, monthKey, type, enabled); await refresh(); setMessage(type === 'hidden_month' ? (enabled ? 'Período ocultado da timeline.' : 'Período restaurado.') : (enabled ? 'Período destacado.' : 'Destaque removido.')); onChanged?.() }
    catch { setError('Não foi possível atualizar este período.') }
    finally { setSaving(false) }
  }

  return <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-ink">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-medium text-forest-800"><ArrowLeft className="w-4 h-4"/>Voltar para Minha História</button><h1 className="mt-3 font-serif text-4xl text-forest-900">Gerenciar história</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Organize marcos pessoais, destaques e a visibilidade da sua timeline. Essas escolhas não alteram nem apagam seus registros do Diário.</p></div>
      <button type="button" onClick={() => { setTab('milestones'); setCreating(true); setEditingId(null); setForm(emptyForm()) }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white"><Plus className="w-4 h-4"/>Adicionar marco pessoal</button>
    </header>

    <div className="mt-6 flex overflow-x-auto rounded-[18px] border border-line bg-white p-1">{([['milestones','Marcos pessoais'],['periods','Períodos e destaques'],['privacy','Privacidade']] as Array<[Tab,string]>).map(([key,label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`min-w-max flex-1 rounded-xl px-4 py-2.5 text-xs font-medium ${tab===key?'bg-mint text-forest-900':'text-ink-soft hover:bg-paper-soft'}`}>{label}</button>)}</div>

    {message && <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#cfe1cf] bg-[#edf7ed] px-4 py-3 text-xs text-forest-900"><Check className="w-4 h-4"/>{message}</div>}
    {error && <div className="mt-4 rounded-xl border border-[#ecc9c0] bg-[#fff3ef] px-4 py-3 text-xs text-[#8e4936]">{error}</div>}

    {tab === 'milestones' && <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-[22px] border border-line bg-white p-5">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-forest-900">Seus marcos pessoais</h2><p className="mt-1 text-xs text-ink-soft">Momentos que você decidiu registrar como parte da sua trajetória.</p></div><Bookmark className="w-5 h-5 text-forest-600"/></div>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-forest-500"/></div> : milestones.length === 0 ? <div className="mt-5 rounded-2xl bg-paper-soft/60 p-7 text-center"><Sparkles className="mx-auto w-7 h-7 text-forest-600"/><p className="mt-3 text-sm font-medium text-forest-900">Nenhum marco pessoal ainda</p><p className="mt-1 text-xs text-ink-soft">Adicione acontecimentos que ajudam a dar contexto à sua história.</p></div> : <div className="mt-4 space-y-3">{milestones.map(item => <article key={item.id} className="rounded-2xl border border-line p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-forest-900">{item.title}</h3>{item.category && <span className="rounded-full bg-mint px-2 py-1 text-[10px] font-medium text-forest-900">{item.category}</span>}</div><p className="mt-1 text-[11px] text-ink-soft">{formatDate(item.event_date)}</p>{item.description && <p className="mt-3 text-xs leading-5 text-ink">{item.description}</p>}</div><div className="flex gap-1"><button type="button" aria-label={`Editar ${item.title}`} onClick={() => startEdit(item)} className="rounded-lg border border-line p-2 text-forest-700 hover:bg-paper-soft"><Pencil className="w-3.5 h-3.5"/></button><button type="button" aria-label={`Excluir ${item.title}`} onClick={() => void removeItem(item.id)} className="rounded-lg border border-line p-2 text-[#8e4936] hover:bg-[#fff3ef]"><Trash2 className="w-3.5 h-3.5"/></button></div></div></article>)}</div>}
      </section>
      <aside className="space-y-4"><section className="rounded-[22px] border border-line bg-paper-soft/55 p-5"><h3 className="text-sm font-semibold text-forest-900">O que é um marco?</h3><p className="mt-2 text-xs leading-5 text-ink-soft">É uma memória ou acontecimento que você escolhe registrar, como uma mudança, um começo, uma conquista, uma decisão ou outro momento importante para você.</p></section><section className="rounded-[22px] border border-line bg-white p-5"><h3 className="text-sm font-semibold text-forest-900">Você tem o controle</h3><p className="mt-2 text-xs leading-5 text-ink-soft">Marcos pessoais podem ser editados ou removidos a qualquer momento. Removê-los daqui não apaga nenhuma entrada do Diário.</p></section></aside>
    </div>}

    {tab === 'periods' && <section className="mt-5 rounded-[22px] border border-line bg-white p-5"><div className="flex items-center gap-3"><CalendarDays className="w-5 h-5 text-forest-600"/><div><h2 className="text-sm font-semibold text-forest-900">Períodos da sua timeline</h2><p className="mt-1 text-xs text-ink-soft">Escolha o que aparece na visão principal e quais períodos merecem destaque.</p></div></div><div className="mt-5 space-y-2">{months.length === 0 ? <p className="rounded-xl bg-paper-soft p-4 text-xs text-ink-soft">Ainda não existem períodos suficientes para gerenciar.</p> : months.map(month => { const isHidden=hidden.has(month.key), isHighlighted=highlighted.has(month.key); return <div key={month.key} className="flex flex-col gap-3 rounded-2xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium capitalize text-forest-900">{month.label}</p><p className="mt-1 text-[11px] text-ink-soft">{month.entryCount} registros · {month.activeDays} dias ativos</p><div className="mt-2 flex gap-2">{isHidden&&<span className="rounded-full bg-[#f4ece8] px-2 py-1 text-[10px] font-medium text-[#7d4f42]">Oculto</span>}{isHighlighted&&<span className="rounded-full bg-[#fff0c9] px-2 py-1 text-[10px] font-medium text-[#76501a]">Em destaque</span>}</div></div><div className="flex flex-wrap gap-2"><button disabled={saving} type="button" onClick={() => void toggleMonth(month.key,'highlight_month',!isHighlighted)} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-forest-900 disabled:opacity-50"><Star className={`w-3.5 h-3.5 ${isHighlighted?'fill-current':''}`}/>{isHighlighted?'Remover destaque':'Destacar'}</button><button disabled={saving} type="button" onClick={() => void toggleMonth(month.key,'hidden_month',!isHidden)} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-forest-900 disabled:opacity-50">{isHidden?<Eye className="w-3.5 h-3.5"/>:<EyeOff className="w-3.5 h-3.5"/>}{isHidden?'Restaurar':'Ocultar da timeline'}</button></div></div> })}</div></section>}

    {tab === 'privacy' && <section className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-[22px] border border-line bg-white p-5"><h2 className="text-sm font-semibold text-forest-900">Ocultar não é apagar</h2><p className="mt-3 text-xs leading-6 text-ink-soft">Quando você oculta um período, ele deixa de aparecer na timeline principal da Minha História. Seus registros originais continuam no Diário e permanecem disponíveis para você.</p></div><div className="rounded-[22px] border border-line bg-white p-5"><h2 className="text-sm font-semibold text-forest-900">Seus marcos são privados</h2><p className="mt-3 text-xs leading-6 text-ink-soft">Marcos pessoais ficam associados somente à sua conta. Eles não são usados para alterar automaticamente o conteúdo original do seu Diário.</p></div><div className="rounded-[22px] border border-line bg-paper-soft/55 p-5 md:col-span-2"><h2 className="text-sm font-semibold text-forest-900">O que você pode controlar aqui</h2><p className="mt-3 text-xs leading-6 text-ink-soft">Você controla marcos pessoais, visibilidade de períodos e destaques. Dados automáticos como quantidade de registros, datas e sinais estruturados continuam refletindo o que foi realmente registrado, sem edição artificial.</p></div></section>}

    {creating && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={editingId?'Editar marco pessoal':'Adicionar marco pessoal'}><div className="w-full max-w-xl rounded-t-[24px] bg-white p-5 shadow-xl sm:rounded-[24px]"><div className="flex items-center justify-between"><div><h2 className="font-serif text-2xl text-forest-900">{editingId?'Editar marco':'Novo marco pessoal'}</h2><p className="mt-1 text-xs text-ink-soft">Registre apenas o que fizer sentido para a sua própria história.</p></div><button type="button" onClick={cancelForm} aria-label="Fechar" className="rounded-lg border border-line p-2"><X className="w-4 h-4"/></button></div><div className="mt-5 space-y-4"><label className="block text-xs font-medium text-forest-900">Título<input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} maxLength={120} placeholder="Ex.: Comecei um novo trabalho" className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-forest-500"/></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-medium text-forest-900">Data<input type="date" value={form.eventDate} onChange={e=>setForm(f=>({...f,eventDate:e.target.value}))} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-forest-500"/></label><label className="block text-xs font-medium text-forest-900">Categoria <span className="font-normal text-ink-soft">(opcional)</span><input value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} maxLength={60} placeholder="Ex.: Trabalho, família, saúde" className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-forest-500"/></label></div><label className="block text-xs font-medium text-forest-900">Descrição <span className="font-normal text-ink-soft">(opcional)</span><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} maxLength={1200} rows={4} placeholder="O que você gostaria de lembrar sobre este momento?" className="mt-1.5 w-full resize-none rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-forest-500"/></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={cancelForm} className="rounded-xl border border-line px-4 py-2.5 text-sm text-forest-900">Cancelar</button><button disabled={saving} type="button" onClick={() => void saveMilestone()} className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}{editingId?'Salvar alterações':'Adicionar à história'}</button></div></div></div>}
  </div>
}
