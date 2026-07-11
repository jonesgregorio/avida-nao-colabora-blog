import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Loader2, Trash2, ImageOff, Upload } from 'lucide-react'

interface Media {
  id: string
  url: string
  alt_text: string | null
  credit: string | null
  prompt: string | null
  kind: string
  article_id: string | null
  created_at: string
}

const KINDS: [string, string][] = [['cover', 'Capa'], ['og', 'Open Graph'], ['social', 'Social'], ['inline', 'No texto']]
const KIND_TXT = Object.fromEntries(KINDS)

export default function AdminMediaLibrary() {
  const [items, setItems] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  function flash(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3000) }

  const [url, setUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [credit, setCredit] = useState('')
  const [prompt, setPrompt] = useState('')
  const [kind, setKind] = useState('inline')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('media_library').select('*').order('created_at', { ascending: false }).limit(200)
    if (error) setMissing(true)
    setItems((data as Media[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!url.trim()) { flash('Informe a URL da imagem.', true); return }
    setBusy(true)
    const { error } = await supabase.from('media_library').insert({
      url: url.trim(), alt_text: alt || null, credit: credit || null, prompt: prompt || null, kind,
    })
    setBusy(false)
    if (error) { flash('Erro: ' + error.message, true); return }
    flash('Mídia adicionada.'); setShowNew(false)
    setUrl(''); setAlt(''); setCredit(''); setPrompt('')
    load()
  }

  async function uploadFile(file: File) {
    setUploading(true)
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${Date.now()}-${safe}`
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: false, contentType: file.type })
    if (error) { flash('Erro no upload: ' + error.message, true); setUploading(false); return }
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    setUrl(data.publicUrl)
    setAlt(prev => prev || safe.replace(/\.[^.]+$/, ''))
    setShowNew(true)
    setUploading(false)
    flash('Arquivo enviado. Complete os campos e salve a mídia.')
  }

  async function remove(m: Media) {
    if (!confirm('Remover esta mídia da biblioteca?')) return
    const { error } = await supabase.from('media_library').delete().eq('id', m.id)
    if (error) flash('Erro ao remover: ' + error.message, true)
    else { flash('Mídia removida.'); load() }
  }

  const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Estúdio de Mídia</h1>
          <p className="text-sm text-ink-soft mt-1">Biblioteca de imagens com alt, crédito e prompt de IA. Reaproveite nos conteúdos.</p>
        </div>
        <div className="flex gap-2">
          <label className={`inline-flex items-center gap-2 border border-line bg-white text-forest-800 px-4 py-2 rounded-xl text-sm font-medium hover:border-forest-300 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar arquivo
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }} />
          </label>
          <button onClick={() => setShowNew(v => !v)} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800"><Plus className="w-4 h-4" /> Adicionar por URL</button>
        </div>
      </div>

      {showNew && (
        <div className="bg-white border border-line rounded-2xl p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div className="sm:col-span-2"><label className="block text-xs text-stone-500 mb-1">URL da imagem</label><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className={inputCls} /></div>
          <div><label className="block text-xs text-stone-500 mb-1">Texto alternativo (alt)</label><input value={alt} onChange={e => setAlt(e.target.value)} className={inputCls} /></div>
          <div><label className="block text-xs text-stone-500 mb-1">Crédito</label><input value={credit} onChange={e => setCredit(e.target.value)} className={inputCls} /></div>
          <div><label className="block text-xs text-stone-500 mb-1">Tipo</label><select value={kind} onChange={e => setKind(e.target.value)} className={inputCls}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="block text-xs text-stone-500 mb-1">Prompt de IA (se gerada)</label><input value={prompt} onChange={e => setPrompt(e.target.value)} className={inputCls} /></div>
          <div className="sm:col-span-2 flex justify-end">
            <button onClick={add} disabled={busy} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Salvar mídia</button>
          </div>
        </div>
      )}

      {missing ? (
        <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-paper-soft">
          <p className="text-ink-soft text-sm">A tabela <code>media_library</code> ainda não está disponível — aplica com a migration 061 (CI).</p>
        </div>
      ) : loading ? (
        <p className="text-ink-soft text-sm">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-paper-soft">
          <p className="text-ink-soft text-sm">Biblioteca vazia. Adicione a primeira imagem.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map(m => (
            <div key={m.id} className="bg-white border border-line rounded-2xl overflow-hidden group">
              <div className="aspect-video bg-stone-100 flex items-center justify-center overflow-hidden">
                {m.url ? <img src={m.url} alt={m.alt_text || ''} className="w-full h-full object-cover" loading="lazy" /> : <ImageOff className="w-6 h-6 text-stone-300" />}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] bg-mint text-forest-700 px-2 py-0.5 rounded-full">{KIND_TXT[m.kind] ?? m.kind}</span>
                  <button onClick={() => remove(m)} className="text-stone-400 hover:text-red-500" title="Remover"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <p className="text-xs text-ink-soft mt-1.5 line-clamp-2">{m.alt_text || <span className="text-amber-500">sem alt</span>}</p>
                {m.credit && <p className="text-[11px] text-stone-400 mt-0.5">© {m.credit}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
