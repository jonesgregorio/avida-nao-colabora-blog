import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { generateSEO } from '../../lib/aiContent'
import { Sparkles, Loader2, Pencil, RefreshCw } from 'lucide-react'

interface Row {
  id: string
  title: string
  slug: string
  status: string
  seo_title: string | null
  seo_description: string | null
  image_url: string | null
  cover_image: string | null
  cover_image_url: string | null
  keyword: string | null
  content: string | null
  published_at: string | null
  updated_at: string | null
  created_at: string
}

type Issue = 'no_seo' | 'no_image' | 'bad_slug' | 'old'

const seoOk = (a: Row) => !!(a.seo_title && a.seo_description)
const imgOk = (a: Row) => !!(a.image_url || a.cover_image || a.cover_image_url)
const badSlug = (s: string) => !s || /[^a-z0-9-]/.test(s) || s.length > 60 || s.includes('--')
function isOld(a: Row) {
  const d = a.published_at || a.updated_at || a.created_at
  if (!d) return false
  return Date.now() - new Date(d).getTime() > 180 * 86400000
}
const hasIssue = (a: Row, i: Issue) =>
  i === 'no_seo' ? !seoOk(a) : i === 'no_image' ? !imgOk(a) : i === 'bad_slug' ? badSlug(a.slug) : isOld(a)

export default function AdminSEOCockpit({ onEditArticle }: { onEditArticle?: (id: string) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [issue, setIssue] = useState<Issue>('no_seo')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  function flash(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3000) }

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('articles').select('*').order('created_at', { ascending: false }).limit(500)
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const cards: { key: Issue; label: string }[] = [
    { key: 'no_seo', label: 'Sem SEO' },
    { key: 'no_image', label: 'Sem imagem' },
    { key: 'bad_slug', label: 'Slug ruim' },
    { key: 'old', label: 'Antigos (6+ meses)' },
  ]
  const count = (i: Issue) => rows.filter(a => hasIssue(a, i)).length
  const list = rows.filter(a => hasIssue(a, issue))

  async function genSEO(a: Row) {
    setBusyId(a.id)
    try {
      const raw = await generateSEO(a.title, a.content || a.title)
      const title = raw.match(/META TITLE:\s*(.+)/i)?.[1]?.trim()
      const desc = raw.match(/META DESCRIPTION:\s*(.+)/i)?.[1]?.trim()
      const kw = raw.match(/KEYWORDS:\s*(.+)/i)?.[1]?.trim()
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (title) patch.seo_title = title
      if (desc) patch.seo_description = desc
      if (kw) patch.keyword = kw.split(',')[0]?.trim()
      const { error } = await supabase.from('articles').update(patch).eq('id', a.id)
      if (error) flash('Erro: ' + error.message, true)
      else { flash('SEO gerado para "' + a.title + '".'); load() }
    } catch (e) { flash('Falha na IA: ' + (e instanceof Error ? e.message : String(e)), true) }
    setBusyId(null)
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">SEO</h1>
          <p className="text-sm text-ink-soft mt-1">Encontre e corrija lacunas de SEO — gere metadados com IA em 1 clique.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(c => (
          <button key={c.key} onClick={() => setIssue(c.key)} className={`text-left bg-white border rounded-2xl p-5 transition-colors ${issue === c.key ? 'border-forest-700 shadow-sm' : 'border-line hover:border-forest-300'}`}>
            <p className="font-serif text-3xl text-forest-900">{loading ? '—' : count(c.key)}</p>
            <p className="text-sm text-ink-soft mt-1">{c.label}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink-soft text-sm">Carregando…</p>
      ) : list.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-paper-soft">
          <p className="text-ink-soft text-sm">Nenhum conteúdo com esse problema. 🎉</p>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-line">
              <tr>
                <th className="text-left px-4 py-3 text-stone-500 font-medium">Título</th>
                <th className="text-center px-3 py-3 text-stone-500 font-medium hidden sm:table-cell">SEO</th>
                <th className="text-center px-3 py-3 text-stone-500 font-medium hidden sm:table-cell">Imagem</th>
                <th className="text-left px-3 py-3 text-stone-500 font-medium hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-stone-500 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {list.map(a => (
                <tr key={a.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-forest-900 leading-snug">{a.title}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{a.slug}</p>
                  </td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">{seoOk(a) ? <span className="text-green-600">✓</span> : <span className="text-amber-500">—</span>}</td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">{imgOk(a) ? <span className="text-green-600">✓</span> : <span className="text-amber-500">—</span>}</td>
                  <td className="px-3 py-3 text-stone-500 hidden md:table-cell">{a.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => genSEO(a)} disabled={busyId === a.id} className="inline-flex items-center gap-1.5 text-xs border border-forest-200 bg-white text-forest-800 px-2.5 py-1.5 rounded-lg hover:bg-mint disabled:opacity-50">
                        {busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Gerar SEO
                      </button>
                      {onEditArticle && (
                        <button onClick={() => onEditArticle(a.id)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                      )}
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
