import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2 } from 'lucide-react'

interface Category { id: string; name: string; slug: string; description: string; is_active: boolean; match_terms: string | null; order_index: number | null }

const inputCls = "w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

export default function AdminCategories() {
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTerms, setNewTerms] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    const { data, error } = await supabase.from('categories').select('*')
      .order('order_index', { ascending: true }).order('name', { ascending: true })
    if (error) showToast('Erro ao carregar: ' + error.message, true)
    setCats(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [])

  async function create() {
    if (!newName.trim()) { showToast('Nome obrigatório', true); return }
    setSaving(true)
    const slug = newName.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-')

    // Novo tema entra depois dos existentes na ordem dos chips do blog.
    const nextOrder = Math.max(0, ...cats.map(c => c.order_index ?? 0)) + 1

    const { error } = await supabase.from('categories').insert({
      name: newName.trim(),
      slug,
      description: newDesc.trim() || null,
      match_terms: newTerms.trim() || null,
      order_index: nextOrder,
      is_active: true,
    })
    setSaving(false)

    if (error) {
      showToast('Erro ao criar categoria: ' + error.message, true)
      return
    }
    showToast('Categoria criada! Já aparece nos filtros do blog e no editor de artigos.')
    setNewName(''); setNewDesc(''); setNewTerms('')
    load()
  }

  // Salva os "termos de busca" (match_terms) de uma categoria já existente.
  async function saveTerms(cat: Category, value: string) {
    const v = value.trim()
    if (v === (cat.match_terms || '').trim()) return // nada mudou
    const { error } = await supabase.from('categories').update({ match_terms: v || null }).eq('id', cat.id)
    if (error) showToast('Erro ao salvar termos: ' + error.message, true)
    else { showToast('Termos atualizados.'); load() }
  }

  async function toggleActive(cat: Category) {
    const { error } = await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    if (error) showToast('Erro: ' + error.message, true)
    else load()
  }

  async function remove(id: string) {
    if (!confirm('Excluir categoria?')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) showToast('Erro ao excluir: ' + error.message, true)
    else load()
  }

  return (
    <div className="max-w-2xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>
          {toast.msg}
        </div>
      )}

      <h1 className="font-serif text-2xl text-forest-900 mb-1">Categorias</h1>
      <p className="text-sm text-ink-soft mb-6">
        Estas categorias controlam <strong>os chips de tema do blog</strong> (na página Conteúdos) e o
        <strong> dropdown de categoria</strong> ao criar artigos. Criar, ativar/desativar ou reordenar aqui reflete automaticamente nos dois lugares.
      </p>

      <div className="bg-white rounded-xl border border-line p-5 mb-6 space-y-3">
        <h2 className="font-semibold text-stone-700 text-sm">Nova categoria</h2>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nome da categoria (ex.: Ansiedade)"
          className={inputCls}
          onKeyDown={e => e.key === 'Enter' && create()}
        />
        <input
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
          placeholder="Descrição (opcional)"
          className={inputCls}
        />
        <input
          value={newTerms}
          onChange={e => setNewTerms(e.target.value)}
          placeholder="Termos de busca do filtro (opcional) — ex.: ansiedad, respira"
          className={inputCls}
        />
        <p className="text-xs text-stone-400 -mt-1">
          Radicais separados por vírgula que o filtro do blog procura no conteúdo. Se deixar em branco, o filtro casa pelos artigos marcados com esta categoria.
        </p>
        <button
          onClick={create}
          disabled={saving}
          className="flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-forest-800 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> {saving ? 'Criando...' : 'Criar'}
        </button>
      </div>

      {loading ? <p className="text-stone-400 text-sm">Carregando...</p> : (
        <div className="bg-white rounded-xl border border-line divide-y divide-stone-100">
          {cats.map(cat => (
            <div key={cat.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${cat.is_active ? 'text-forest-900' : 'text-stone-400'}`}>{cat.name}</p>
                <p className="text-xs text-stone-400">{cat.slug}{cat.description ? ` — ${cat.description}` : ''}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-[11px] text-stone-400 whitespace-nowrap">Termos do filtro:</span>
                  <input
                    defaultValue={cat.match_terms || ''}
                    placeholder="ex.: ansiedad, respira"
                    className="flex-1 min-w-0 text-xs px-2 py-1 border border-line rounded focus:outline-none focus:ring-1 focus:ring-stone-300"
                    onBlur={e => saveTerms(cat, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleActive(cat)}
                  className={`text-xs px-2 py-1 rounded ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400'}`}
                  title={cat.is_active ? 'Desativar' : 'Ativar'}
                >
                  {cat.is_active ? 'Ativa' : 'Inativa'}
                </button>
                <button
                  onClick={() => remove(cat.id)}
                  className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {cats.length === 0 && <p className="text-stone-400 text-sm px-4 py-3">Nenhuma categoria cadastrada.</p>}
        </div>
      )}
    </div>
  )
}
