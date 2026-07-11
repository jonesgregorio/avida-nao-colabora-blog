import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Save, Loader2, ArrowLeft } from 'lucide-react'

interface Template {
  id: string
  template_key: string
  name: string
  content_type: string
  prompt: string
  variables: string[]
  is_active: boolean
  version: number
  updated_at: string
}

export default function AdminTemplatesIA() {
  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [sel, setSel] = useState<Template | null>(null)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function flash(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3000) }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('ai_prompt_templates').select('*').order('template_key')
    if (error) setMissing(true)
    setItems((data as Template[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function open(t: Template) { setSel(t); setName(t.name); setPrompt(t.prompt) }

  async function save() {
    if (!sel || !prompt.trim()) return
    setSaving(true)
    const { error } = await supabase.from('ai_prompt_templates')
      .update({ name, prompt, version: (sel.version || 1) + 1, updated_at: new Date().toISOString() })
      .eq('id', sel.id)
    setSaving(false)
    if (error) { flash('Erro ao salvar: ' + error.message, true); return }
    flash('Template salvo.')
    setSel(null); load()
  }

  async function toggle(t: Template) {
    const { error } = await supabase.from('ai_prompt_templates').update({ is_active: !t.is_active }).eq('id', t.id)
    if (!error) setItems(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x))
  }

  if (sel) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}
        <button onClick={() => setSel(null)} className="inline-flex items-center gap-1.5 text-sm text-forest-700 hover:text-forest-900 mb-4"><ArrowLeft className="w-4 h-4" /> Voltar aos templates</button>
        <div className="bg-white border border-line rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-mint text-forest-800 px-2 py-0.5 rounded-full">{sel.template_key}</span>
            <span className="text-xs text-ink-soft">v{sel.version} · {sel.content_type}</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-line rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">Prompt</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={10} className="w-full px-3 py-2 border border-line rounded-lg text-sm font-mono leading-relaxed" />
          </div>
          {sel.variables?.length > 0 && (
            <div>
              <p className="text-xs text-stone-500 mb-1.5 uppercase tracking-wide">Variáveis disponíveis</p>
              <div className="flex flex-wrap gap-1.5">
                {sel.variables.map(v => <code key={v} className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded">{`{{${v}}}`}</code>)}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar template
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-forest-900">Templates de IA</h1>
        <p className="text-sm text-ink-soft mt-1">Edite os prompts usados na Fábrica IA — sem mexer no código.</p>
      </div>

      {missing ? (
        <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-paper-soft">
          <p className="text-ink-soft text-sm">A tabela <code>ai_prompt_templates</code> ainda não está disponível — aplica com a migration 061 (CI). Atualize em instantes.</p>
        </div>
      ) : loading ? (
        <p className="text-ink-soft text-sm">Carregando…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(t => (
            <div key={t.id} className="bg-white border border-line rounded-2xl p-4 flex items-start justify-between gap-3">
              <button onClick={() => open(t)} className="text-left min-w-0 flex-1">
                <p className="font-medium text-forest-900">{t.name}</p>
                <p className="text-xs text-ink-soft mt-0.5 line-clamp-2">{t.prompt}</p>
                <p className="text-[11px] text-stone-400 mt-1">{t.template_key} · v{t.version}</p>
              </button>
              <button onClick={() => toggle(t)} className={`text-[11px] px-2 py-1 rounded-full whitespace-nowrap ${t.is_active ? 'bg-mint text-forest-700' : 'bg-stone-100 text-stone-500'}`}>
                {t.is_active ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
