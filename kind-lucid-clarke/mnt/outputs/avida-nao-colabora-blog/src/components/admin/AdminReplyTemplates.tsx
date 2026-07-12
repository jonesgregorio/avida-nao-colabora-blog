import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Save, Loader2, ArrowLeft, Plus, Trash2, Star } from 'lucide-react'

interface Template {
  id: string
  title: string
  category: string | null
  body: string
  is_active: boolean
  is_favorite: boolean
  updated_at: string
}

const EMPTY = { title: '', category: '', body: '', is_active: true, is_favorite: false }

export default function AdminReplyTemplates({ onBack }: { onBack?: () => void }) {
  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [sel, setSel] = useState<Template | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  function flash(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3000) }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('support_reply_templates')
      .select('id, title, category, body, is_active, is_favorite, updated_at')
      .order('category').order('title')
    if (error) setMissing(true)
    setItems((data as Template[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function open(t: Template | 'new') {
    setSel(t)
    setForm(t === 'new' ? EMPTY : { title: t.title, category: t.category ?? '', body: t.body, is_active: t.is_active, is_favorite: t.is_favorite })
  }

  async function save() {
    if (!form.title.trim() || !form.body.trim()) { flash('Título e corpo são obrigatórios.', true); return }
    setSaving(true)
    const payload = { title: form.title, category: form.category || null, body: form.body, is_active: form.is_active, is_favorite: form.is_favorite, updated_at: new Date().toISOString() }
    const { error } = sel === 'new'
      ? await supabase.from('support_reply_templates').insert(payload)
      : await supabase.from('support_reply_templates').update(payload).eq('id', (sel as Template).id)
    setSaving(false)
    if (error) { flash('Erro ao salvar: ' + error.message, true); return }
    flash('Modelo salvo.'); setSel(null); load()
  }

  async function remove(t: Template) {
    if (!confirm(`Excluir o modelo "${t.title}"?`)) return
    const { error } = await supabase.from('support_reply_templates').delete().eq('id', t.id)
    if (error) flash('Erro ao excluir: ' + error.message, true)
    else { flash('Modelo excluído.'); load() }
  }

  async function toggle(t: Template) {
    const { error } = await supabase.from('support_reply_templates').update({ is_active: !t.is_active, updated_at: new Date().toISOString() }).eq('id', t.id)
    if (!error) setItems(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x))
  }

  const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

  if (sel) {
    const isNew = sel === 'new'
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}
        <button onClick={() => setSel(null)} className="inline-flex items-center gap-1.5 text-sm text-forest-700 hover:text-forest-900 mb-4"><ArrowLeft className="w-4 h-4" /> Voltar aos modelos</button>
        <div className="bg-white border border-line rounded-2xl p-6 space-y-4">
          <h2 className="font-serif text-2xl text-forest-900">{isNew ? 'Novo modelo' : 'Editar modelo'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs text-stone-500 mb-1">Título</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} /></div>
            <div><label className="block text-xs text-stone-500 mb-1">Categoria</label><input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: Planos, Suporte..." className={inputCls} /></div>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Corpo da resposta</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={10} className={`${inputCls} leading-relaxed`} />
          </div>
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="accent-forest-700" /> Ativo</label>
            <label className="inline-flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={form.is_favorite} onChange={e => setForm(f => ({ ...f, is_favorite: e.target.checked }))} className="accent-forest-700" /> Favorito</label>
          </div>
          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar modelo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          {onBack && <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-forest-700 hover:text-forest-900 mb-2"><ArrowLeft className="w-4 h-4" /> Voltar ao suporte</button>}
          <h1 className="font-serif text-3xl text-forest-900">Modelos de resposta</h1>
          <p className="text-sm text-ink-soft mt-1">Respostas automáticas usadas ao atender tickets. Edite o texto de cada uma.</p>
        </div>
        <button onClick={() => open('new')} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800"><Plus className="w-4 h-4" /> Novo modelo</button>
      </div>

      {missing ? (
        <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-paper-soft">
          <p className="text-ink-soft text-sm">A tabela <code>support_reply_templates</code> não está disponível.</p>
        </div>
      ) : loading ? (
        <p className="text-ink-soft text-sm">Carregando…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(t => (
            <div key={t.id} className={`bg-white border rounded-2xl p-4 ${t.is_active ? 'border-line' : 'border-line opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => open(t)} className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {t.is_favorite && <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                    <p className="font-medium text-forest-900 truncate">{t.title}</p>
                  </div>
                  {t.category && <span className="text-[11px] text-forest-700 bg-mint px-1.5 py-0.5 rounded-full">{t.category}</span>}
                  <p className="text-xs text-ink-soft mt-1.5 line-clamp-2">{t.body}</p>
                </button>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <button onClick={() => toggle(t)} title={t.is_active ? 'Ativo' : 'Inativo'} className={`w-9 h-5 rounded-full relative transition-colors ${t.is_active ? 'bg-forest-600' : 'bg-stone-300'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${t.is_active ? 'left-4' : 'left-0.5'}`} />
                  </button>
                  <button onClick={() => remove(t)} className="text-stone-400 hover:text-red-500" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
