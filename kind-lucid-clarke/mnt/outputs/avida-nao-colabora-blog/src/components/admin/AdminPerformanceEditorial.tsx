import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Loader2, Save, TrendingUp, TrendingDown, Bookmark, ThumbsUp } from 'lucide-react'

interface Art { id: string; title: string; slug: string; category: string | null; status: string }
interface Perf {
  art: Art; views: number; saves: number; pos: number; neg: number
}

const POS_TYPES = ['helped', 'made_me_think']

export default function AdminPerformanceEditorial({ onEditArticle }: { onEditArticle?: (id: string) => void }) {
  const [perf, setPerf] = useState<Perf[]>([])
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<'top' | 'bottom'>('top')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  function flash(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3500) }

  async function load() {
    setLoading(true)
    const [artRes, viewRes, savRes, fbRes] = await Promise.all([
      supabase.from('articles').select('id, title, slug, category, status').limit(1000),
      supabase.from('reading_history').select('article_slug').limit(20000),
      supabase.from('saved_items').select('item_id').eq('item_type', 'article').limit(20000),
      supabase.from('article_feedback').select('article_slug, feedback_type').limit(20000),
    ])
    const arts = (artRes.data as Art[]) ?? []
    const views = new Map<string, number>()
    ;((viewRes.data as { article_slug: string }[]) ?? []).forEach(r => views.set(r.article_slug, (views.get(r.article_slug) ?? 0) + 1))
    const saves = new Map<string, number>()
    ;((savRes.data as { item_id: string }[]) ?? []).forEach(r => saves.set(r.item_id, (saves.get(r.item_id) ?? 0) + 1))
    const pos = new Map<string, number>(), neg = new Map<string, number>()
    ;((fbRes.data as { article_slug: string; feedback_type: string }[]) ?? []).forEach(r => {
      const m = POS_TYPES.includes(r.feedback_type) ? pos : neg
      m.set(r.article_slug, (m.get(r.article_slug) ?? 0) + 1)
    })
    setPerf(arts.map(a => ({
      art: a,
      views: views.get(a.slug) ?? 0,
      saves: (saves.get(a.slug) ?? 0) + (saves.get(a.id) ?? 0),
      pos: pos.get(a.slug) ?? 0,
      neg: neg.get(a.slug) ?? 0,
    })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const totalViews = perf.reduce((s, p) => s + p.views, 0)
  const totalSaves = perf.reduce((s, p) => s + p.saves, 0)
  const totalFb = perf.reduce((s, p) => s + p.pos + p.neg, 0)
  const published = perf.filter(p => p.art.status === 'published').length

  const sorted = [...perf].sort((a, b) => order === 'top' ? b.views - a.views : a.views - b.views).slice(0, 25)

  // Top categorias por leituras
  const byCat = new Map<string, number>()
  perf.forEach(p => { const c = p.art.category || 'sem categoria'; byCat.set(c, (byCat.get(c) ?? 0) + p.views) })
  const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  async function recompute() {
    setSaving(true)
    const rows = perf.map(p => ({
      article_id: p.art.id, views: p.views, saves: p.saves,
      feedback_positive: p.pos, feedback_negative: p.neg, last_computed_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('content_performance').upsert(rows, { onConflict: 'article_id' })
    setSaving(false)
    if (error) flash('Não foi possível gravar em content_performance: ' + error.message, true)
    else flash('Métricas recalculadas e salvas em content_performance.')
  }

  const maxV = Math.max(1, ...sorted.map(s => s.views))

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Performance editorial</h1>
          <p className="text-sm text-ink-soft mt-1">Leituras, salvamentos e feedback reais dos conteúdos.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
          <button onClick={recompute} disabled={saving || loading} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Recalcular e salvar</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { n: totalViews, label: 'Leituras totais', Icon: TrendingUp },
          { n: totalSaves, label: 'Salvamentos', Icon: Bookmark },
          { n: totalFb, label: 'Feedbacks', Icon: ThumbsUp },
          { n: published, label: 'Publicados', Icon: TrendingUp },
        ].map(m => (
          <div key={m.label} className="bg-white border border-line rounded-2xl p-5">
            <m.Icon className="w-5 h-5 text-forest-600" />
            <p className="font-serif text-3xl text-forest-900 mt-2">{loading ? '—' : m.n}</p>
            <p className="text-sm text-ink-soft mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-line rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl text-forest-900">{order === 'top' ? 'Mais lidos' : 'Menos lidos'}</h2>
            <button onClick={() => setOrder(o => o === 'top' ? 'bottom' : 'top')} className="inline-flex items-center gap-1.5 text-xs text-forest-700 border border-line rounded-lg px-2.5 py-1 hover:bg-stone-50">
              {order === 'top' ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />} {order === 'top' ? 'Ver menos lidos' : 'Ver mais lidos'}
            </button>
          </div>
          {loading ? <p className="text-ink-soft text-sm">Carregando…</p> : sorted.length === 0 ? (
            <p className="text-ink-soft text-sm">Sem dados de leitura ainda.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map(p => (
                <div key={p.art.id} className="flex items-center gap-3">
                  <button onClick={() => onEditArticle?.(p.art.id)} className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-medium text-forest-900 truncate">{p.art.title}</p>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-forest-500" style={{ width: `${(p.views / maxV) * 100}%` }} /></div>
                  </button>
                  <div className="text-right text-xs text-ink-soft w-28 flex-shrink-0">
                    <span title="Leituras">{p.views}👁</span> · <span title="Salvos">{p.saves}🔖</span> · <span title="Feedback +/-">{p.pos}/{p.neg}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-serif text-xl text-forest-900 mb-3">Categorias mais lidas</h2>
          {loading ? <p className="text-ink-soft text-sm">Carregando…</p> : topCats.length === 0 ? (
            <p className="text-ink-soft text-sm">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {topCats.map(([c, v]) => (
                <div key={c} className="flex items-center justify-between text-sm">
                  <span className="text-forest-900 truncate">{c}</span>
                  <span className="text-ink-soft">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
