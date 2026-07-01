import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Calendar, Sparkles } from 'lucide-react'
import AIContentAssistant from './AIContentAssistant'

interface ScheduledContent {
  id: string
  title: string
  type: string
  content: string
  plan_required: string
  scheduled_at: string
  status: 'pending' | 'sent' | 'cancelled'
  recurrence: string | null
  created_at: string
}

const TYPES = ['Artigo', 'Desafio', 'Campanha', 'Lembrete', 'Relatório mensal', 'Conteúdo premium']
const PLANS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', therapeutic: 'Terapêutico', 'therapeutic-plus': 'Plus',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  sent: 'bg-green-100 text-green-700',
  cancelled: 'bg-stone-100 text-stone-400',
}

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

export default function AdminScheduled() {
  const [items, setItems] = useState<ScheduledContent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ScheduledContent | null>(null)
  const [showAI, setShowAI] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  const [title, setTitle] = useState('')
  const [type, setType] = useState(TYPES[0])
  const [content, setContent] = useState('')
  const [planRequired, setPlanRequired] = useState('free')
  const [scheduledAt, setScheduledAt] = useState('')
  const [recurrence, setRecurrence] = useState('')
  const [saving, setSaving] = useState(false)

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    const { data, error } = await supabase.from('scheduled_contents').select('*').order('scheduled_at', { ascending: true })
    if (error) showToast('Erro ao carregar: ' + error.message, true)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null); setTitle(''); setType(TYPES[0]); setContent('')
    setPlanRequired('free'); setScheduledAt(''); setRecurrence(''); setShowForm(true)
  }

  function openEdit(item: ScheduledContent) {
    setEditing(item); setTitle(item.title); setType(item.type)
    setContent(item.content); setPlanRequired(item.plan_required)
    setScheduledAt(item.scheduled_at?.slice(0, 16) || ''); setRecurrence(item.recurrence || '')
    setShowForm(true)
  }

  async function save() {
    if (!title.trim()) { showToast('Título obrigatório', true); return }
    if (!scheduledAt) { showToast('Data e hora obrigatórias', true); return }
    setSaving(true)
    const payload = {
      title, type, content, plan_required: planRequired,
      scheduled_at: new Date(scheduledAt).toISOString(),
      recurrence: recurrence || null,
      status: 'pending' as const,
    }

    let error: any
    if (editing) {
      const res = await supabase.from('scheduled_contents').update(payload).eq('id', editing.id)
      error = res.error
    } else {
      const res = await supabase.from('scheduled_contents').insert(payload).select().single()
      error = res.error
    }
    setSaving(false)

    if (error) {
      showToast('Erro ao salvar: ' + error.message, true)
      return
    }
    showToast('Salvo!')
    setShowForm(false)
    load()
  }

  async function cancel(id: string) {
    if (!confirm('Cancelar este conteúdo programado?')) return
    const { error } = await supabase.from('scheduled_contents').update({ status: 'cancelled' }).eq('id', id)
    if (error) showToast('Erro: ' + error.message, true)
    else load()
  }

  async function remove(id: string) {
    if (!confirm('Excluir?')) return
    const { error } = await supabase.from('scheduled_contents').delete().eq('id', id)
    if (error) showToast('Erro ao excluir: ' + error.message, true)
    else load()
  }

  const upcoming = items.filter(i => i.status === 'pending' && new Date(i.scheduled_at) >= new Date())
  const past = items.filter(i => i.status !== 'pending' || new Date(i.scheduled_at) < new Date())

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-stone-800'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Conteúdos Programados</h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700">
          <Plus className="w-4 h-4" /> Novo programado
        </button>
      </div>

      {showAI && (
        <AIContentAssistant
          contentType="scheduled_content"
          defaultTheme={title || type}
          label="Gerar conteúdo programado com IA"
          onInsert={result => setContent(result)}
          onClose={() => setShowAI(false)}
        />
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">{editing ? 'Editar' : 'Novo conteúdo programado'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Título *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Desafio de início do mês" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Data e hora *</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Plano alvo</label>
              <select value={planRequired} onChange={e => setPlanRequired(e.target.value)} className={inputCls}>
                {Object.entries(PLANS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-stone-500 mb-1">Recorrência (opcional)</label>
              <input value={recurrence} onChange={e => setRecurrence(e.target.value)} placeholder="Ex: Mensal, toda segunda-feira, etc." className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-stone-500">Conteúdo / Descrição</label>
                <button
                  type="button"
                  onClick={() => setShowAI(true)}
                  className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors font-medium"
                >
                  <Sparkles className="w-3 h-3" /> Gerar com IA
                </button>
              </div>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="Conteúdo ou descrição do envio..." className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-stone-200 text-stone-600 text-sm rounded-lg hover:bg-stone-50">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum conteúdo programado ainda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3">Próximos ({upcoming.length})</h2>
              <ContentTable items={upcoming} onEdit={openEdit} onCancel={cancel} onDelete={remove} />
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3">Histórico</h2>
              <ContentTable items={past} onEdit={openEdit} onCancel={cancel} onDelete={remove} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ContentTable({ items, onEdit, onCancel, onDelete }: {
  items: ScheduledContent[]
  onEdit: (i: ScheduledContent) => void
  onCancel: (id: string) => void
  onDelete: (id: string) => void
}) {
  const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    sent: 'bg-green-100 text-green-700',
    cancelled: 'bg-stone-100 text-stone-400',
  }
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr>
            <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Título</th>
            <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs hidden md:table-cell">Tipo</th>
            <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Data</th>
            <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Status</th>
            <th className="px-4 py-3 text-right text-stone-500 font-medium text-xs">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-stone-50">
              <td className="px-4 py-3">
                <p className="font-medium text-stone-800 leading-snug">{item.title}</p>
                {item.recurrence && <p className="text-xs text-stone-400">🔁 {item.recurrence}</p>}
              </td>
              <td className="px-4 py-3 text-stone-500 text-xs hidden md:table-cell">{item.type}</td>
              <td className="px-4 py-3 text-stone-600 text-xs">
                {new Date(item.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || ''}`}>
                  {item.status === 'pending' ? 'Pendente' : item.status === 'sent' ? 'Enviado' : 'Cancelado'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 justify-end">
                  {item.status === 'pending' && (
                    <button onClick={() => onEdit(item)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.status === 'pending' && (
                    <button onClick={() => onCancel(item.id)} className="p-1.5 text-stone-400 hover:text-amber-500 hover:bg-amber-50 rounded text-xs">✕</button>
                  )}
                  <button onClick={() => onDelete(item.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
