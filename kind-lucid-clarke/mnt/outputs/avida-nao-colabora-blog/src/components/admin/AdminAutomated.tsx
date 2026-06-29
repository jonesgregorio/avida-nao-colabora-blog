import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Plus, Pencil, Trash2, Zap, ToggleLeft, ToggleRight,
  Sparkles, Loader2, CheckCircle, AlertCircle, Eye, Save
} from 'lucide-react'

interface AutoContent {
  id: string
  title: string
  type: string
  plan_required: string
  frequency: string
  content: string
  active: boolean
  created_at: string
}

const TYPES = [
  'Sugestão de artigo', 'Meditação guiada em texto', 'Exercício emocional',
  'Mini-desafio', 'Avaliação semanal', 'Plano semanal de autocuidado',
  'Lembrete de diário', 'Reflexão guiada', 'Técnica terapêutica',
]

const FREQUENCIES = ['Diário', 'Semanal', 'Quinzenal', 'Mensal']

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial',
  therapeutic: 'Terapêutico', 'therapeutic-plus': 'Plus',
}

const FREQ_COLORS: Record<string, string> = {
  Diário:    'bg-red-100 text-red-700',
  Semanal:   'bg-blue-100 text-blue-700',
  Quinzenal: 'bg-purple-100 text-purple-700',
  Mensal:    'bg-stone-100 text-stone-600',
}

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

// ── Geração via Pollinations.ai (gratuito, sem API key) ────────────────────
const GENERATE_TIMEOUT_MS = 30_000

async function generateContent(tema: string, tipo: string, frequencia: string): Promise<string> {
  const prompt = `Você é um psicólogo especializado em saúde mental e bem-estar emocional.

Crie um conteúdo do tipo "${tipo}" sobre o tema: "${tema}".
Frequência de envio: ${frequencia}

Requisitos:
- Escreva em português brasileiro, tom acolhedor e empático
- Entre 150 e 250 palavras
- Inclua uma dica prática ou exercício ao final
- Escreva em parágrafos corridos, sem listas ou markdown
- Termine com uma frase de encorajamento
- Retorne APENAS o texto, sem título`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)

  try {
    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai',
        seed: Math.floor(Math.random() * 9999),
      }),
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`Serviço indisponível (${response.status})`)
    const text = await response.text()
    if (!text.trim()) throw new Error('Resposta vazia')
    return text.trim()
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Tempo limite excedido (30s). Tente novamente.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export default function AdminAutomated() {
  const [items, setItems] = useState<AutoContent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AutoContent | null>(null)
  const [preview, setPreview] = useState<AutoContent | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // Form state
  const [title, setTitle]         = useState('')
  const [tema, setTema]           = useState('')
  const [type, setType]           = useState(TYPES[0])
  const [planRequired, setPlan]   = useState('free')
  const [frequency, setFrequency] = useState(FREQUENCIES[1])
  const [content, setContent]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [generating, setGenerating] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('automated_contents')
      .select('*')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function flash(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function openNew() {
    setEditing(null); setTitle(''); setTema(''); setType(TYPES[0])
    setPlan('free'); setFrequency(FREQUENCIES[1]); setContent('')
    setShowForm(true)
  }

  function openEdit(item: AutoContent) {
    setEditing(item); setTitle(item.title); setTema('')
    setType(item.type); setPlan(item.plan_required)
    setFrequency(item.frequency); setContent(item.content)
    setShowForm(true)
  }

  async function handleGenerate() {
    if (!tema.trim()) { flash('Digite um tema antes de gerar', 'err'); return }
    setGenerating(true)
    try {
      const result = await generateContent(tema.trim(), type, frequency)
      setContent(result)
      if (!title.trim()) setTitle(`${type} — ${tema.trim()}`)
      flash('Conteúdo gerado!')
    } catch (e: any) {
      const msg = e?.message || 'Erro desconhecido'
      flash(`Geração falhou: ${msg}`, 'err')
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (!title.trim()) { flash('Título obrigatório', 'err'); return }
    if (!content.trim()) { flash('Gere ou escreva o conteúdo', 'err'); return }
    setSaving(true)
    const payload = { title, type, plan_required: planRequired, frequency, content, active: true }
    try {
      if (editing) {
        await supabase.from('automated_contents').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('automated_contents').insert(payload)
      }
      flash('Salvo!'); setShowForm(false); load()
    } catch (e: any) {
      flash('Erro: ' + e.message, 'err')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from('automated_contents').update({ active: !active }).eq('id', id)
    setItems(is => is.map(i => i.id === id ? { ...i, active: !active } : i))
  }

  async function remove(id: string) {
    if (!confirm('Excluir?')) return
    await supabase.from('automated_contents').delete().eq('id', id)
    load()
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg shadow-lg ${
          toast.type === 'ok' ? 'bg-emerald-700 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${FREQ_COLORS[preview.frequency]}`}>
                  {preview.frequency}
                </span>
                <button onClick={() => setPreview(null)} className="text-stone-400 hover:text-stone-600 text-xl">×</button>
              </div>
              <h2 className="text-lg font-bold text-stone-800 mb-1">{preview.title}</h2>
              <p className="text-xs text-stone-400 mb-4">{preview.type} · {PLAN_LABELS[preview.plan_required]}</p>
              <div className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">{preview.content}</div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Conteúdos Automáticos</h1>
          <p className="text-stone-400 text-xs mt-1">Gere com IA e entregue aos usuários no app</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700"
        >
          <Plus size={14} /> Novo conteúdo
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">
            {editing ? 'Editar conteúdo' : 'Novo conteúdo automático'}
          </h2>

          {/* Gerador IA */}
          <div className="bg-gradient-to-r from-emerald-50 to-stone-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800">Gerar com IA</span>
              <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Gratuito · Sem chave</span>
            </div>
            <div className="flex gap-2">
              <input
                value={tema}
                onChange={e => setTema(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder="Ex: ansiedade no trabalho, luto, relacionamentos tóxicos..."
                className="flex-1 px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
              />
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? 'Gerando...' : 'Gerar'}
              </button>
            </div>
            <p className="text-xs text-emerald-600 mt-2">
              💡 Digite o tema e pressione Enter. O conteúdo é gerado por IA sem precisar de API key — funciona via Pollinations.ai (gratuito).
            </p>
          </div>

          {/* Form fields */}
          <div>
            <label className="text-xs text-stone-500 block mb-1">Título *</label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do conteúdo" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Conteúdo *</label>
            <textarea className={inputCls} rows={5} value={content} onChange={e => setContent(e.target.value)} placeholder="Escreva ou gere com IA acima..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500 block mb-1">Tipo</label>
              <select className={inputCls} value={type} onChange={e => setType(e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Frequência</label>
              <select className={inputCls} value={frequency} onChange={e => setFrequency(e.target.value)}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Plano mínimo</label>
            <select className={inputCls} value={planRequired} onChange={e => setPlan(e.target.value)}>
              {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 text-sm text-stone-600 border rounded-lg hover:bg-stone-50">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-700 disabled:opacity-50">
              <Save size={14} />{saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </div>
        )}

      {/* Lista de conteúdos */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm">
            Nenhum conteúdo automático criado ainda.
          </div>
        ) : items.map(item => (
          <div key={item.id} className="bg-white border rounded-xl p-4 flex items-start gap-3">
            <button
              onClick={() => toggle(item.id, item.active)}
              className={"mt-0.5 flex-shrink-0 " + (item.active ? 'text-emerald-500' : 'text-stone-300')}
              title={item.active ? 'Desativar' : 'Ativar'}
            >
              {item.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-stone-800 text-sm">{item.title}</span>
                <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{item.type}</span>
                {!item.active && <span className="text-xs text-orange-500">Inativo</span>}
              </div>
              <p className="text-xs text-stone-500 line-clamp-2">{item.content}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => openEdit(item)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded">
                <Pencil size={14} />
              </button>
              <button onClick={() => setPreview(item)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded">
                <Eye size={14} />
              </button>
              <button onClick={() => remove(item.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>
  )
}
