import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Zap, ToggleLeft, ToggleRight } from 'lucide-react'

interface AutoContent {
  id: string
  title: string
  type: string
  plan_required: string
  frequency: string
  content: string
  active: boolean
  created_at: string
}

const TYPES = [
  'Sugestão de artigo', 'Meditação guiada em texto', 'Exercício emocional',
  'Mini-desafio', 'Avaliação semanal', 'Relatório mensal', 'Plano semanal de autocuidado',
  'Lembrete de diário', 'Preparação para sessão',
]

const FREQUENCIES = ['Diário', 'Semanal', 'Quinzenal', 'Mensal']

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', therapeutic: 'Terapêutico', 'therapeutic-plus': 'Plus',
}

export default function AdminAutomated() {
  const [items, setItems] = useState<AutoContent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AutoContent | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Form
  const [title, setTitle] = useState('')
  const [type, setType] = useState(TYPES[0])
  const [planRequired, setPlanRequired] = useState('free')
  const [frequency, setFrequency] = useState(FREQUENCIES[1])
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('automated_contents').select('*').order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null); setTitle(''); setType(TYPES[0]); setPlanRequired('free')
    setFrequency(FREQUENCIES[1]); setContent(''); setShowForm(true)
  }

  function openEdit(item: AutoContent) {
    setEditing(item); setTitle(item.title); setType(item.type)
    setPlanRequired(item.plan_required); setFrequency(item.frequency)
    setContent(item.content); setShowForm(true)
  }

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    const payload = { title, type, plan_required: planRequired, frequency, content, active: true }
    try {
      if (editing) {
        await supabase.from('automated_contents').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('automated_contents').insert(payload)
      }
      showToast('Salvo!'); setShowForm(false); load()
    } catch (e: any) {
      showToast('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from('automated_contents').update({ active: !active }).eq('id', id)
    setItems(is => is.map(i => i.id === id ? { ...i, active: !active } : i))
  }

  async function remove(id: string) {
    if (!confirm('Excluir este conteúdo automático?')) return
    await supabase.from('automated_contents').delete().eq('id', id)
    load()
  }

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(null), 3000)
  }

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-stone-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Conteúdos Automáticos</h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700">
          <Plus className="w-4 h-4" /> Novo conteúdo
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">{editing ? 'Editar conteúdo' : 'Novo conteúdo automático'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Título</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Exercício de respiração" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Plano mínimo</label>
              <select value={planRequired} onChange={e => setPlanRequired(e.target.value)} className={inputCls}>
                {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Frequência</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)} className={inputCls}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Conteúdo</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Texto completo do conteúdo automático..." className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-stone-200 text-stone-600 text-sm rounded-lg hover:bg-stone-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum conteúdo automático cadastrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Título</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs hidden md:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs hidden lg:table-cell">Frequência</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Plano</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Status</th>
                <th className="px-4 py-3 text-right text-stone-500 font-medium text-xs">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800">{item.title}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs hidden md:table-cell">{item.type}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs hidden lg:table-cell">{item.frequency}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{PLAN_LABELS[item.plan_required] || item.plan_required}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggle(item.id, item.active)} className="flex items-center gap-1.5">
                      {item.active
                        ? <ToggleRight className="w-5 h-5 text-emerald-600" />
                        : <ToggleLeft className="w-5 h-5 text-stone-300" />
                      }
                      <span className={`text-xs ${item.active ? 'text-emerald-600' : 'text-stone-400'}`}>
                        {item.active ? 'Ativo' : 'Pausado'}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove(item.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
