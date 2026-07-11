import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Copy, Search, Send, Archive, FileText, Sparkles, Loader2 } from 'lucide-react'
import { generateSEO } from '../../lib/aiContent'

interface Article {
  id: string
  title: string
  slug: string
  status: string
  category: string
  content_type?: string | null
  plan_required?: string | null
  image_url?: string | null
  cover_image?: string | null
  cover_image_url?: string | null
  seo_title?: string | null
  seo_description?: string | null
  keyword?: string | null
  origin?: string | null
  content?: string | null
  created_at: string
  published_at: string | null
}

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-stone-100 text-stone-600',
  essential: 'bg-blue-100 text-blue-700',
  plus: 'bg-coral text-[#c05f3c]',
}
const PLAN_TXT: Record<string, string> = { free: 'Gratuito', essential: 'Essencial', plus: 'Plus' }

function seoOk(a: Article) { return !!(a.seo_title && a.seo_description) }
function imageOk(a: Article) { return !!(a.image_url || a.cover_image || a.cover_image_url) }

type ContentType = 'article' | 'practice' | 'meditation'

interface Props {
  onNew: () => void
  onEdit: (id: string) => void
  contentType?: ContentType
}

const TYPE_COPY: Record<ContentType, { title: string; novo: string; vazio: string }> = {
  article: { title: 'Artigos', novo: 'Novo artigo', vazio: 'Nenhum artigo ainda.' },
  practice: { title: 'Práticas', novo: 'Nova prática', vazio: 'Nenhuma prática ainda. Crie um conteúdo e escolha o tipo "Prática".' },
  meditation: { title: 'Meditações', novo: 'Nova meditação', vazio: 'Nenhuma meditação ainda. Crie um conteúdo e escolha o tipo "Meditação".' },
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

export default function AdminArticles({ onNew, onEdit, contentType = 'article' }: Props) {
  const copy = TYPE_COPY[contentType]
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterQuality, setFilterQuality] = useState<'all' | 'no_seo' | 'no_image' | 'ia' | 'manual'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    // select('*') é tolerante caso a migration 059 (content_type) ainda não tenha aplicado.
    const { data, error } = await supabase
      .from('articles')
      .select('*')
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
    const matchType = (a.content_type ?? 'article') === contentType
    const matchQuality =
      filterQuality === 'all' ? true
      : filterQuality === 'no_seo' ? !seoOk(a)
      : filterQuality === 'no_image' ? !imageOk(a)
      : filterQuality === 'ia' ? a.origin === 'ia'
      : /* manual */ a.origin !== 'ia'
    return matchSearch && matchStatus && matchType && matchQuality
  })

  // ── Seleção + ações em massa ──
  const allSelected = filtered.length > 0 && filtered.every(a => selected.has(a.id))
  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map(a => a.id)))
  }
  const selectedIds = () => [...selected].filter(id => filtered.some(a => a.id === id))

  async function bulkStatus(status: string) {
    const ids = selectedIds()
    if (!ids.length) return
    setBulkBusy(true)
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
    if (status === 'published') patch.published_at = new Date().toISOString()
    const { error } = await supabase.from('articles').update(patch).in('id', ids)
    setBulkBusy(false)
    if (error) showToast('Erro na ação em massa: ' + error.message, true)
    else { showToast(`${ids.length} conteúdo(s) → ${STATUS_LABELS[status] ?? status}.`); setSelected(new Set()); load() }
  }

  async function bulkDelete() {
    const ids = selectedIds()
    if (!ids.length) return
    if (!confirm(`Excluir ${ids.length} conteúdo(s)? Esta ação não pode ser desfeita.`)) return
    setBulkBusy(true)
    const { error } = await supabase.from('articles').delete().in('id', ids)
    setBulkBusy(false)
    if (error) showToast('Erro ao excluir: ' + error.message, true)
    else { showToast(`${ids.length} conteúdo(s) excluído(s).`); setSelected(new Set()); load() }
  }

  async function bulkGenerateSEO() {
    const ids = selectedIds()
    if (!ids.length) return
    setBulkBusy(true)
    let ok = 0, fail = 0
    for (const id of ids) {
      const a = articles.find(x => x.id === id)
      if (!a) { fail++; continue }
      try {
        const raw = await generateSEO(a.title, a.content || a.title)
        const title = raw.match(/META TITLE:\s*(.+)/i)?.[1]?.trim()
        const desc = raw.match(/META DESCRIPTION:\s*(.+)/i)?.[1]?.trim()
        const kw = raw.match(/KEYWORDS:\s*(.+)/i)?.[1]?.trim()
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (title) patch.seo_title = title
        if (desc) patch.seo_description = desc
        if (kw) patch.keyword = kw.split(',')[0]?.trim()
        const { error } = await supabase.from('articles').update(patch).eq('id', id)
        if (error) fail++; else ok++
      } catch { fail++ }
      showToast(`Gerando SEO com IA… ${ok + fail}/${ids.length}`)
    }
    setBulkBusy(false)
    showToast(`SEO gerado: ${ok} ok${fail ? `, ${fail} falha(s)` : ''}.`, fail > 0 && ok === 0)
    setSelected(new Set()); load()
  }

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-forest-900">{copy.title}</h1>
        <button
          onClick={onNew}
          className="flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-forest-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> {copy.novo}
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
        <select
          value={filterQuality}
          onChange={e => setFilterQuality(e.target.value as typeof filterQuality)}
          className="border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
        >
          <option value="all">Qualidade: todas</option>
          <option value="no_seo">Sem SEO</option>
          <option value="no_image">Sem imagem</option>
          <option value="ia">Geradas por IA</option>
          <option value="manual">Criadas manualmente</option>
        </select>
      </div>

      {selectedIds().length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 bg-mint/50 border border-forest-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-forest-900">{selectedIds().length} selecionado(s)</span>
          {bulkBusy && <Loader2 className="w-4 h-4 animate-spin text-forest-700" />}
          <div className="flex flex-wrap gap-2 ml-auto">
            <button disabled={bulkBusy} onClick={() => bulkStatus('published')} className="inline-flex items-center gap-1.5 text-xs bg-forest-900 text-white px-3 py-1.5 rounded-lg hover:bg-forest-800 disabled:opacity-50"><Send className="w-3.5 h-3.5" /> Publicar</button>
            <button disabled={bulkBusy} onClick={() => bulkStatus('draft')} className="inline-flex items-center gap-1.5 text-xs border border-line bg-white text-stone-700 px-3 py-1.5 rounded-lg hover:bg-stone-50 disabled:opacity-50"><FileText className="w-3.5 h-3.5" /> Rascunho</button>
            <button disabled={bulkBusy} onClick={() => bulkStatus('archived')} className="inline-flex items-center gap-1.5 text-xs border border-line bg-white text-stone-700 px-3 py-1.5 rounded-lg hover:bg-stone-50 disabled:opacity-50"><Archive className="w-3.5 h-3.5" /> Arquivar</button>
            <button disabled={bulkBusy} onClick={bulkGenerateSEO} className="inline-flex items-center gap-1.5 text-xs border border-forest-200 bg-white text-forest-800 px-3 py-1.5 rounded-lg hover:bg-mint disabled:opacity-50"><Sparkles className="w-3.5 h-3.5" /> Gerar SEO (IA)</button>
            <button disabled={bulkBusy} onClick={bulkDelete} className="inline-flex items-center gap-1.5 text-xs border border-red-200 bg-white text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando artigos...</p>
      ) : filtered.length === 0 ? (
        <p className="text-stone-400 text-sm">{copy.vazio}</p>
      ) : (
        <div className="bg-white rounded-xl border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-line">
              <tr>
                <th className="w-10 px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Selecionar todos" className="accent-forest-700" /></th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium">Título</th>
                <th className="text-left px-3 py-3 text-stone-500 font-medium hidden sm:table-cell">Plano</th>
                <th className="text-left px-3 py-3 text-stone-500 font-medium">Status</th>
                <th className="text-center px-3 py-3 text-stone-500 font-medium hidden md:table-cell">SEO</th>
                <th className="text-center px-3 py-3 text-stone-500 font-medium hidden md:table-cell">Imagem</th>
                <th className="text-left px-3 py-3 text-stone-500 font-medium hidden lg:table-cell">Origem</th>
                <th className="text-left px-3 py-3 text-stone-500 font-medium hidden lg:table-cell">Data</th>
                <th className="px-4 py-3 text-stone-500 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map(article => (
                <tr key={article.id} className={`hover:bg-stone-50 ${selected.has(article.id) ? 'bg-mint/30' : ''}`}>
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(article.id)} onChange={() => toggleSelect(article.id)} aria-label={`Selecionar ${article.title}`} className="accent-forest-700" /></td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-forest-900 leading-snug">{article.title}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{article.category || 'sem categoria'} · {article.slug}</p>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_BADGE[article.plan_required || 'free'] || 'bg-stone-100 text-stone-500'}`}>
                      {PLAN_TXT[article.plan_required || 'free'] || article.plan_required}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[article.status] || 'bg-stone-100 text-stone-500'}`}>
                      {STATUS_LABELS[article.status] || article.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    {seoOk(article) ? <span className="text-green-600" title="SEO completo">✓</span> : <span className="text-amber-500" title="Sem SEO">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    {imageOk(article) ? <span className="text-green-600" title="Tem imagem">✓</span> : <span className="text-amber-500" title="Sem imagem">—</span>}
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${article.origin === 'ia' ? 'bg-lilac text-[#7c5cbf]' : 'bg-stone-100 text-stone-500'}`}>{article.origin === 'ia' ? 'IA' : 'Manual'}</span>
                  </td>
                  <td className="px-3 py-3 text-stone-400 text-xs hidden lg:table-cell">
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
