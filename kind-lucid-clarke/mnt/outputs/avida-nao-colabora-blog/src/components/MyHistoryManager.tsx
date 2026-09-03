import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Pencil, Plus, Save, Star, Trash2, X } from 'lucide-react'
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

type Tab = 'milestones' | 'periods'
type FormState = { title: string; description: string; eventDate: string; category: string }

const emptyForm = (): FormState => ({
  title: '',
  description: '',
  eventDate: new Date().toISOString().slice(0, 10),
  category: '',
})

function formatDate(value: string | null) {
  if (!value) return 'Sem data'
  const [y, m, d] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d, 12))
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
    setLoading(true)
    setError('')
    try {
      setItems(await loadHistoryManagementItems(userId))
    } catch {
      setError('Não foi possível carregar sua história.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const milestones = useMemo(() => items.filter(item => item.item_type === 'milestone'), [items])
  const hidden = useMemo(
    () => new Set(items.filter(item => item.item_type === 'hidden_month').map(item => item.reference_key).filter(Boolean) as string[]),
    [items],
  )
  const highlighted = useMemo(
    () => new Set(items.filter(item => item.item_type === 'highlight_month').map(item => item.reference_key).filter(Boolean) as string[]),
    [items],
  )

  function openCreate() {
    setTab('milestones')
    setCreating(true)
    setEditingId(null)
    setForm(emptyForm())
  }

  function startEdit(item: HistoryManagementItem) {
    setEditingId(item.id)
    setCreating(true)
    setForm({
      title: item.title ?? '',
      description: item.description ?? '',
      eventDate: item.event_date ?? new Date().toISOString().slice(0, 10),
      category: item.category ?? '',
    })
  }

  function cancelForm() {
    setCreating(false)
    setEditingId(null)
    setForm(emptyForm())
    setError('')
  }

  async function saveMilestone() {
    if (!form.title.trim() || !form.eventDate) {
      setError('Informe um título e uma data para o marco.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      if (editingId) await updateHistoryMilestone(editingId, userId, form)
      else await createHistoryMilestone(userId, form)
      const wasEditing = Boolean(editingId)
      await refresh()
      cancelForm()
      setMessage(wasEditing ? 'Marco atualizado.' : 'Marco adicionado.')
      onChanged?.()
    } catch {
      setError('Não foi possível salvar este marco.')
    } finally {
      setSaving(false)
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm('Remover este marco? O Diário não será alterado.')) return
    setSaving(true)
    setError('')
    try {
      await deleteHistoryItem(id, userId)
      await refresh()
      setMessage('Marco removido.')
      onChanged?.()
    } catch {
      setError('Não foi possível remover este marco.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleMonth(monthKey: string, type: 'hidden_month' | 'highlight_month', enabled: boolean) {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await setMonthHistoryControl(userId, monthKey, type, enabled)
      await refresh()
      setMessage(type === 'hidden_month' ? (enabled ? 'Período ocultado.' : 'Período restaurado.') : (enabled ? 'Período destacado.' : 'Destaque removido.'))
      onChanged?.()
    } catch {
      setError('Não foi possível atualizar este período.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[920px] px-4 py-7 text-ink sm:px-6 sm:py-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-medium text-forest-800">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <h1 className="mt-3 font-serif text-4xl text-forest-900">Gerenciar história</h1>
          <p className="mt-1 text-sm text-ink-soft">Escolha o que merece aparecer na sua trajetória.</p>
        </div>
        {tab === 'milestones' && (
          <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white">
            <Plus className="h-4 w-4" />
            Novo marco
          </button>
        )}
      </header>

      <div className="mt-6 grid grid-cols-2 rounded-2xl border border-line bg-white p-1">
        <button type="button" onClick={() => setTab('milestones')} className={`rounded-xl px-4 py-2.5 text-sm font-medium ${tab === 'milestones' ? 'bg-mint text-forest-900' : 'text-ink-soft hover:bg-paper-soft'}`}>
          Marcos
        </button>
        <button type="button" onClick={() => setTab('periods')} className={`rounded-xl px-4 py-2.5 text-sm font-medium ${tab === 'periods' ? 'bg-mint text-forest-900' : 'text-ink-soft hover:bg-paper-soft'}`}>
          Períodos
        </button>
      </div>

      {message && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#cfe1cf] bg-[#edf7ed] px-4 py-3 text-xs text-forest-900">
          <Check className="h-4 w-4" />
          {message}
        </div>
      )}
      {error && <div className="mt-4 rounded-xl border border-[#ecc9c0] bg-[#fff3ef] px-4 py-3 text-xs text-[#8e4936]">{error}</div>}

      {tab === 'milestones' && (
        <section className="mt-5 rounded-[22px] border border-line bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-forest-900">Marcos pessoais</h2>
              <p className="mt-1 text-xs text-ink-soft">Momentos importantes que você escolheu guardar.</p>
            </div>
            <span className="rounded-full bg-paper-soft px-2.5 py-1 text-[11px] text-ink-soft">{milestones.length}</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-forest-500" /></div>
          ) : milestones.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-paper-soft/60 px-5 py-8 text-center">
              <p className="text-sm font-medium text-forest-900">Nenhum marco ainda</p>
              <p className="mt-1 text-xs text-ink-soft">Adicione apenas os momentos que realmente importam para você.</p>
              <button type="button" onClick={openCreate} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-forest-900">
                <Plus className="h-3.5 w-3.5" />
                Adicionar primeiro marco
              </button>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-line">
              {milestones.map(item => (
                <article key={item.id} className="flex items-start justify-between gap-3 py-4 first:pt-1 last:pb-1">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-forest-900">{item.title}</h3>
                      {item.category && <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-medium text-forest-900">{item.category}</span>}
                    </div>
                    <p className="mt-1 text-[11px] text-ink-soft">{formatDate(item.event_date)}</p>
                    {item.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink-soft">{item.description}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" aria-label={`Editar ${item.title}`} onClick={() => startEdit(item)} className="rounded-lg p-2 text-forest-700 hover:bg-paper-soft">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label={`Excluir ${item.title}`} onClick={() => void removeItem(item.id)} className="rounded-lg p-2 text-[#8e4936] hover:bg-[#fff3ef]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'periods' && (
        <section className="mt-5 rounded-[22px] border border-line bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-forest-900">Períodos da timeline</h2>
            <p className="mt-1 text-xs text-ink-soft">Destaque ou oculte meses da visão principal.</p>
          </div>

          <div className="mt-4 divide-y divide-line">
            {months.length === 0 ? (
              <p className="py-8 text-center text-xs text-ink-soft">Ainda não existem períodos para gerenciar.</p>
            ) : months.map(month => {
              const isHidden = hidden.has(month.key)
              const isHighlighted = highlighted.has(month.key)
              return (
                <div key={month.key} className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium capitalize text-forest-900">{month.label}</p>
                      {isHighlighted && <span className="rounded-full bg-[#fff0c9] px-2 py-0.5 text-[10px] font-medium text-[#76501a]">Destaque</span>}
                      {isHidden && <span className="rounded-full bg-[#f4ece8] px-2 py-0.5 text-[10px] font-medium text-[#7d4f42]">Oculto</span>}
                    </div>
                    <p className="mt-1 text-[11px] text-ink-soft">{month.entryCount} registros · {month.activeDays} dias ativos</p>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={saving} type="button" onClick={() => void toggleMonth(month.key, 'highlight_month', !isHighlighted)} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs text-forest-900 disabled:opacity-50">
                      <Star className={`h-3.5 w-3.5 ${isHighlighted ? 'fill-current' : ''}`} />
                      {isHighlighted ? 'Tirar destaque' : 'Destacar'}
                    </button>
                    <button disabled={saving} type="button" onClick={() => void toggleMonth(month.key, 'hidden_month', !isHidden)} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs text-forest-900 disabled:opacity-50">
                      {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {isHidden ? 'Restaurar' : 'Ocultar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <p className="mt-5 text-center text-[11px] leading-5 text-ink-soft">
        Ocultar ou remover itens daqui não apaga seus registros do Diário.
      </p>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={editingId ? 'Editar marco pessoal' : 'Adicionar marco pessoal'}>
          <div className="w-full max-w-xl rounded-t-[24px] bg-white p-5 shadow-xl sm:rounded-[24px]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl text-forest-900">{editingId ? 'Editar marco' : 'Novo marco'}</h2>
                <p className="mt-1 text-xs text-ink-soft">Registre um momento importante da sua trajetória.</p>
              </div>
              <button type="button" onClick={cancelForm} aria-label="Fechar" className="rounded-lg border border-line p-2"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-xs font-medium text-forest-900">
                Título
                <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} maxLength={120} placeholder="Ex.: Comecei um novo trabalho" className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-forest-500" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium text-forest-900">
                  Data
                  <input type="date" value={form.eventDate} onChange={event => setForm(current => ({ ...current, eventDate: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-forest-500" />
                </label>
                <label className="block text-xs font-medium text-forest-900">
                  Categoria <span className="font-normal text-ink-soft">(opcional)</span>
                  <input value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} maxLength={60} placeholder="Ex.: Trabalho, família" className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-forest-500" />
                </label>
              </div>
              <label className="block text-xs font-medium text-forest-900">
                Descrição <span className="font-normal text-ink-soft">(opcional)</span>
                <textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} maxLength={1200} rows={3} placeholder="O que você quer lembrar sobre este momento?" className="mt-1.5 w-full resize-none rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-forest-500" />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={cancelForm} className="rounded-xl border border-line px-4 py-2.5 text-sm text-forest-900">Cancelar</button>
              <button disabled={saving} type="button" onClick={() => void saveMilestone()} className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingId ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
