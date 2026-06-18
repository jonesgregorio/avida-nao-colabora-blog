import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, HelpCircle, ToggleLeft, ToggleRight } from 'lucide-react'

interface Questionnaire {
  id: string
  title: string
  description: string
  plan_required: string
  active: boolean
  question_count?: number
  response_count?: number
  created_at: string
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', therapeutic: 'Terapêutico', 'therapeutic-plus': 'Plus',
}

export default function AdminQuestionnaires() {
  const [items, setItems] = useState<Questionnaire[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Questionnaire | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [planRequired, setPlanRequired] = useState('free')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('questionnaires').select('*').order('created_at', { ascending: false })
    if (data) {
      // Try to get response counts
      const withCounts = await Promise.all((data || []).map(async (q: any) => {
        const { count } = await supabase
          .from('questionnaire_responses')
          .select('*', { count: 'exact', head: true })
          .eq('questionnaire_id', q.id)
          .catch(() => ({ count: 0 })) as any
        return { ...q, response_count: count || 0 }
      }))
      setItems(withCounts)
    } else {
      setItems([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null); setTitle(''); setDescription(''); setPlanRequired('free'); setShowForm(true)
  }

  function openEdit(q: Questionnaire) {
    setEditing(q); setTitle(q.title); setDescription(q.description); setPlanRequired(q.plan_required); setShowForm(true)
  }

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await supabase.from('questionnaires').update({ title, description, plan_required: planRequired }).eq('id', editing.id)
      } else {
        await supabase.from('questionnaires').insert({ title, description, plan_required: planRequired, active: true })
      }
      showToast('Salvo!'); setShowForm(false); load()
    } catch (e: any) {
      showToast('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from('questionnaires').update({ active: !active }).eq('id', id)
    setItems(is => is.map(i => i.id === id ? { ...i, active: !active } : i))
  }

  async function remove(id: string) {
    if (!confirm('Excluir este questionário?')) return
    await supabase.from('questionnaires').delete().eq('id', id)
    load()
  }

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(null), 3000)
  }

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-stone-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Questionários</h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700">
          <Plus className="w-4 h-4" /> Novo questionário
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">{editing ? 'Editar' : 'Novo questionário'}</h2>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Título</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Autoavaliação emocional" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Descrição</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Explique o objetivo deste questionário..." className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Plano mínimo</label>
            <select value={planRequired} onChange={e => setPlanRequired(e.target.value)} className={inputCls}>
              {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
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
          <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum questionário cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(q => (
            <div key={q.id} className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-stone-800 leading-snug text-sm">{q.title}</h3>
                <button onClick={() => toggle(q.id, q.active)}>
                  {q.active
                    ? <ToggleRight className="w-5 h-5 text-emerald-600 flex-shrink-0 ml-2" />
                    : <ToggleLeft className="w-5 h-5 text-stone-300 flex-shrink-0 ml-2" />
                  }
                </button>
              </div>
              <p className="text-xs text-stone-500 mb-3 line-clamp-2">{q.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <span className="text-xs text-stone-400">{PLAN_LABELS[q.plan_required]}</span>
                  {q.response_count !== undefined && (
                    <span className="text-xs text-stone-400">• {q.response_count} respostas</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(q)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(q.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Editor de perguntas em breve:</strong> A próxima versão permitirá criar, ordenar e editar as perguntas de cada questionário diretamente pelo painel, com lógica condicional e tipos de resposta personalizados.
      </div>
    </div>
  )
}

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
