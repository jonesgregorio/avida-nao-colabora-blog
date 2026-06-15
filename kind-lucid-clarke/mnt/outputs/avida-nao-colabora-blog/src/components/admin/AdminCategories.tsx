import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2 } from 'lucide-react'

interface Category { id: string; name: string; slug: string; description: string }

export default function AdminCategories() {
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  async function load() {
    const { data } = await supabase.from('categories').select('*').order('name')
    setCats(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!newName.trim()) return
    const slug = newName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
    await supabase.from('categories').insert({ name: newName.trim(), slug, description: newDesc.trim() })
    setNewName(''); setNewDesc('')
    load()
  }

  async function remove(id: string) {
    if (!confirm('Excluir categoria?')) return
    await supabase.from('categories').delete().eq('id', id)
    load()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Categorias</h1>

      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6 space-y-3">
        <h2 className="font-semibold text-stone-700 text-sm">Nova categoria</h2>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nome da categoria"
          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
        <input
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
          placeholder="Descrição (opcional)"
          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
        <button
          onClick={create}
          className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700"
        >
          <Plus className="w-4 h-4" /> Criar
        </button>
      </div>

      {loading ? <p className="text-stone-400 text-sm">Carregando...</p> : (
        <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
          {cats.map(cat => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-800">{cat.name}</p>
                <p className="text-xs text-stone-400">{cat.slug}{cat.description ? ` — ${cat.description}` : ''}</p>
              </div>
              <button
                onClick={() => remove(cat.id)}
                className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {cats.length === 0 && <p className="text-stone-400 text-sm px-4 py-3">Nenhuma categoria cadastrada.</p>}
        </div>
      )}
    </div>
  )
}
