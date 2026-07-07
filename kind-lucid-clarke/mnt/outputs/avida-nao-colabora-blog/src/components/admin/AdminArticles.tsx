import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Copy, Search } from 'lucide-react'

interface Article {
  id: string
  title: string
  slug: string
  status: string
  category: string
  created_at: string
  published_at: string | null
}

interface Props {
  onNew: () => void
  onEdit: (id: string) => void
}

const STATUS_LABELS: Record<string, string> = {
  published: 'Publicado',
  draft: 'Rascunho',
  archived: 'Arquivado',
  scheduled: 'Agendado',
}

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  draft: 'bg-amber-100 text-amber-700',
  archived: 'bg-stone-100 text-stone-500',
  scheduled: 'bg-blue-100 text-blue-700',
}

export default function AdminArticles({ onNew, onEdit }: Props) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, status, category, created_at, published_at')
      .order('created_at', { ascending: false })
    if (error) showToast('Erro ao carregar artigos: ' + error.message, true)
    setArticles(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [])

  async function duplicate(article: Article) {
    const { data, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', article.id)
      .single()
    if (fetchError || !data) { showToast('Erro ao buscar artigo', true); return }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at: _c, updated_at: _u, published_at: _p, ...rest } = data as Record<string, unknown>
    const { error } = await supabase.from('articles').insert({
      ...rest,
      title: `${data.title} (cópia)`,
      slug: `${data.slug}-copia-${Date.now()}`,
      status: 'draft',
      published_at: null,
    })
    if (error) showToast('Erro ao duplicar: ' + error.message, true)
    else { showToast('Artigo duplicado!'); load() }
  }

  async function deleteArticle(id: string) {
    if (!confirm('Tem certeza que deseja excluir este artigo?')) return
    const { error } = await supabase.from('articles').delete().eq('id', id)
    if (error) showToast('Erro ao excluir: ' + error.message, true)
    else load()
  }

  const filtered = articles.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) || a.slug.includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || a.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-forest-900">Artigos</h1>
        <button
          onClick={onNew}
          className="flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-forest-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo artigo
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título ou slug..."
            className="w-full pl-9 pr-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
        >
          <option value="all">Todos os status</option>
          <option value="published">Publicados</option>
          <option value="draft">Rascunhos</option>
          <option value="archived">Arquivados</option>
          <option value="scheduled">Agendados</option>
        </select>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando artigos...</p>
      ) : filtered.length === 0 ? (
        <p className="text-stone-400 text-sm">Nenhum artigo encontrado.</p>
      ) : (
        <div className="bg-white rounded-xl border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-line">
              <tr>
                <th className="text-left px-4 py-3 text-stone-500 font-medium">Título</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium hidden md:table-cell">Categoria</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium hidden lg:table-cell">Data</th>
                <th className="px-4 py-3 text-stone-500 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map(article => (
                <tr key={article.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-forest-900 leading-snug">{article.title}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{article.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-500 hidden md:table-cell">{article.category || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[article.status] || 'bg-stone-100 text-stone-500'}`}>
                      {STATUS_LABELS[article.status] || article.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-400 text-xs hidden lg:table-cell">
                    {new Date(article.published_at || article.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => onEdit(article.id)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => duplicate(article)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded" title="Duplicar">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteArticle(article.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded" title="Excluir">
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
