import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AlertCircle, CheckCircle, Save, X, Loader2 } from 'lucide-react'

interface ArticleSEO {
  id: string
  title: string
  slug: string
  seo_title: string | null
  seo_description: string | null
  cover_image_url: string | null
  category: string | null
  status: string
}

interface EditState {
  seo_title: string
  seo_description: string
}

export default function AdminSEO() {
  const [articles, setArticles] = useState<ArticleSEO[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'issues'>('issues')
  const [editId, setEditId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ seo_title: '', seo_description: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('articles')
        .select('id, title, slug, seo_title, seo_description, cover_image_url, category, status')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
      setArticles(data || [])
      setLoading(false)
    }
    load()
  }, [])

  function issues(a: ArticleSEO) {
    const list: string[] = []
    if (!a.seo_title) list.push('Sem título SEO')
    if (!a.seo_description) list.push('Sem descrição SEO')
    if (a.seo_description && a.seo_description.length > 160) list.push('Descrição longa (>160 chars)')
    if (!a.cover_image_url) list.push('Sem imagem de capa')
    if (!a.category) list.push('Sem categoria')
    return list
  }

  function openEdit(a: ArticleSEO) {
    setEditId(a.id)
    setEditState({ seo_title: a.seo_title || '', seo_description: a.seo_description || '' })
  }

  async function saveEdit() {
    if (!editId) return
    setSaving(true)
    const { error } = await supabase
      .from('articles')
      .update({ seo_title: editState.seo_title || null, seo_description: editState.seo_description || null })
      .eq('id', editId)
    if (!error) {
      setArticles(prev => prev.map(a =>
        a.id === editId
          ? { ...a, seo_title: editState.seo_title || null, seo_description: editState.seo_description || null }
          : a
      ))
      showToast('SEO salvo!')
    } else {
      showToast('Erro ao salvar: ' + error.message)
    }
    setSaving(false)
    setEditId(null)
  }

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(null), 3000)
  }

  const filtered = filter === 'issues'
    ? articles.filter(a => issues(a).length > 0)
    : articles

  const totalIssues = articles.filter(a => issues(a).length > 0).length
  const ok = articles.length - totalIssues

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-stone-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <h1 className="text-2xl font-bold text-stone-800 mb-6">SEO</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-2xl font-bold text-stone-800">{articles.length}</p>
          <p className="text-xs text-stone-500">Artigos publicados</p>
        </div>
        <div className={`rounded-xl border p-4 ${ok === articles.length ? 'bg-green-50 border-green-200' : 'bg-white border-stone-200'}`}>
          <p className="text-2xl font-bold text-green-600">{ok}</p>
          <p className="text-xs text-stone-500">Sem problemas</p>
        </div>
        <div className={`rounded-xl border p-4 ${totalIssues > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-stone-200'}`}>
          <p className="text-2xl font-bold text-red-600">{totalIssues}</p>
          <p className="text-xs text-stone-500">Com problemas SEO</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('issues')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'issues' ? 'bg-stone-800 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
        >
          Com problemas ({totalIssues})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-stone-800 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
        >
          Todos ({articles.length})
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="text-green-700 font-medium">Todos os artigos estão com SEO completo!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const probs = issues(a)
            const isEditing = editId === a.id
            return (
              <div key={a.id} className={`bg-white rounded-xl border p-4 ${probs.length > 0 ? 'border-red-100' : 'border-stone-200'}`}>
                <div className="flex items-start gap-3">
                  {probs.length > 0
                    ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    : <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-stone-800 text-sm leading-snug">{a.title}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{a.slug}</p>
                      </div>
                      {!isEditing && (
                        <button
                          onClick={() => openEdit(a)}
                          className="flex-shrink-0 text-xs px-3 py-1 border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50"
                        >
                          Editar SEO
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">
                            Título SEO{' '}
                            <span className={`ml-1 ${editState.seo_title.length > 60 ? 'text-red-500' : 'text-stone-400'}`}>
                              ({editState.seo_title.length}/60)
                            </span>
                          </label>
                          <input
                            value={editState.seo_title}
                            onChange={e => setEditState(s => ({ ...s, seo_title: e.target.value }))}
                            placeholder="Título para mecanismos de busca (até 60 chars)"
                            className={inputCls}
                            maxLength={80}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">
                            Descrição SEO{' '}
                            <span className={`ml-1 ${editState.seo_description.length > 160 ? 'text-red-500' : 'text-stone-400'}`}>
                              ({editState.seo_description.length}/160)
                            </span>
                          </label>
                          <textarea
                            value={editState.seo_description}
                            onChange={e => setEditState(s => ({ ...s, seo_description: e.target.value }))}
                            placeholder="Descrição para mecanismos de busca (até 160 chars)"
                            rows={2}
                            className={inputCls}
                            maxLength={200}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            {saving ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-200 text-stone-600 text-xs rounded-lg hover:bg-stone-50"
                          >
                            <X className="w-3 h-3" /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {a.seo_title && <p className="text-xs text-stone-500 mt-1">SEO Title: {a.seo_title}</p>}
                        {a.seo_description && (
                          <p className="text-xs text-stone-500">
                            Meta desc: {a.seo_description.substring(0, 80)}{a.seo_description.length > 80 ? '...' : ''}
                            <span className={`ml-1 ${a.seo_description.length > 160 ? 'text-red-500' : 'text-green-600'}`}>
                              ({a.seo_description.length} chars)
                            </span>
                          </p>
                        )}
                        {probs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {probs.map(p => (
                              <span key={p} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{p}</span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
