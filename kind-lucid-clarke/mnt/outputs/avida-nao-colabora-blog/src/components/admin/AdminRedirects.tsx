import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, ArrowRight, Loader2 } from 'lucide-react'

// Extraído do antigo AnalyticsPageLegacy (aba "Erros" → 404). Vive em
// Conteúdo → Inteligência: gerir redirecionamentos 301/302 de URLs antigas é
// tarefa de conteúdo/SEO, não de análise. O site (ArticleView) aplica ao
// detectar um 404.

interface Redirect { id: string; from_path: string; to_path: string; type: number; is_active: boolean; hits: number; created_at: string }

export default function AdminRedirects() {
  const [rows, setRows] = useState<Redirect[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState(301)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('analytics_redirects').select('*').order('created_at', { ascending: false })
    setRows((data as Redirect[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function add() {
    if (!from.trim() || !to.trim()) { setErr('Preencha origem e destino.'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('analytics_redirects').upsert(
      { from_path: from.trim(), to_path: to.trim(), type }, { onConflict: 'from_path' })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setFrom(''); setTo(''); setType(301); load()
  }
  async function toggle(r: Redirect) { await supabase.from('analytics_redirects').update({ is_active: !r.is_active }).eq('id', r.id); load() }
  async function del(r: Redirect) { await supabase.from('analytics_redirects').delete().eq('id', r.id); load() }

  const inp = 'border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-forest-400'
  return (
    <div className="p-5 sm:p-6">
      <div className="bg-white border border-line rounded-2xl p-5">
        <h2 className="font-serif text-xl text-forest-900 mb-1">Redirecionamentos</h2>
        <p className="text-xs text-ink-soft mb-4">Uma URL antiga (ex.: <code>/blog/slug-velho</code>) é reenviada para a nova. O site aplica automaticamente ao detectar o 404.</p>
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-[180px]"><label className="block text-xs text-ink-soft mb-1">De (origem)</label><input value={from} onChange={e => setFrom(e.target.value)} placeholder="/blog/slug-antigo" className={`${inp} w-full`} /></div>
          <ArrowRight className="w-4 h-4 text-stone-300 mb-3" />
          <div className="flex-1 min-w-[180px]"><label className="block text-xs text-ink-soft mb-1">Para (destino)</label><input value={to} onChange={e => setTo(e.target.value)} placeholder="/blog/slug-novo" className={`${inp} w-full`} /></div>
          <div><label className="block text-xs text-ink-soft mb-1">Tipo</label><select value={type} onChange={e => setType(Number(e.target.value))} className={inp}><option value={301}>301 permanente</option><option value={302}>302 temporário</option></select></div>
          <button onClick={add} disabled={busy} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar</button>
        </div>
        {err && <p className="text-xs text-red-600 mb-3">{err}</p>}
        {loading ? <p className="text-sm text-ink-soft py-6 text-center">Carregando…</p>
          : rows.length === 0 ? <p className="text-sm text-ink-soft py-6 text-center">Nenhum redirecionamento cadastrado.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]"><thead className="bg-stone-50 border-b border-line"><tr><th className="text-left px-3 py-2 text-stone-500 font-medium">De → Para</th><th className="px-3 py-2 text-stone-500 font-medium">Tipo</th><th className="text-right px-3 py-2 text-stone-500 font-medium">Hits</th><th className="px-3 py-2 text-stone-500 font-medium">Ativo</th><th className="px-3 py-2" /></tr></thead>
              <tbody className="divide-y divide-stone-100">{rows.map(r => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-mono text-xs text-forest-900"><span className="text-stone-500">{r.from_path}</span> → {r.to_path}</td>
                  <td className="px-3 py-2 text-center text-xs">{r.type}</td>
                  <td className="px-3 py-2 text-right">{r.hits}</td>
                  <td className="px-3 py-2 text-center"><button onClick={() => toggle(r)} className={`text-xs px-2 py-1 rounded-lg ${r.is_active ? 'bg-mint text-forest-700' : 'bg-stone-100 text-stone-400'}`}>{r.is_active ? 'ativo' : 'inativo'}</button></td>
                  <td className="px-3 py-2 text-right"><button onClick={() => del(r)} className="text-stone-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}</tbody></table>
          </div>
        )}
      </div>
    </div>
  )
}
