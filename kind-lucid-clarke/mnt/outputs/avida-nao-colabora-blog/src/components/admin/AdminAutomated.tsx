import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Sparkles, Loader2, CheckCircle, AlertCircle, Eye, Save
} from 'lucide-react'

interface AutoContent {
  id: string
  title: string
  type: string
  plan_required: string
  frequency: string
  content: string
  is_active: boolean
  active: boolean
  created_at: string
}

const TYPES = [
  { label: 'Sugestão de artigo', value: 'article_recommendation' },
  { label: 'Meditação guiada em texto', value: 'guided_meditation' },
  { label: 'Exercício emocional', value: 'emotional_exercise' },
  { label: 'Mini-desafio', value: 'mini_challenge' },
  { label: 'Avaliação semanal', value: 'weekly_evaluation' },
  { label: 'Plano semanal de autocuidado', value: 'weekly_self_care' },
  { label: 'Lembrete de diário', value: 'diary_reminder' },
  { label: 'Reflexão guiada', value: 'guided_reflection' },
  { label: 'Técnica terapêutica', value: 'therapeutic_technique' },
]

const FREQUENCIES = [
  { label: 'Diário', value: 'daily' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Quinzenal', value: 'biweekly' },
  { label: 'Mensal', value: 'monthly' },
]

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial',
  therapeutic: 'Terapêutico', 'therapeutic-plus': 'Plus',
}

const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPES.map(t => [t.value, t.label]))
const FREQ_LABELS: Record<string, string> = Object.fromEntries(FREQUENCIES.map(f => [f.value, f.label]))

const FREQ_COLORS: Record<string, string> = {
  daily:    'bg-red-100 text-red-700',
  weekly:   'bg-blue-100 text-blue-700',
  biweekly: 'bg-purple-100 text-purple-700',
  monthly:  'bg-stone-100 text-stone-600',
}

const inputCls = "w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

const GENERATE_TIMEOUT_MS = 30_000

async function generateContent(tema: string, tipo: string, frequencia: string): Promise<string> {
  const prompt = `Você é um psicólogo especializado em saúde mental e bem-estar emocional.
Crie um conteúdo do tipo "${tipo}" sobre o tema: "${tema}". Frequência de envio: ${frequencia}
Requisitos: escreva em português brasileiro, tom acolhedor e empático, entre 150 e 250 palavras, inclua uma dica prática ou exercício ao final, escreva em parágrafos corridos sem listas ou markdown, termine com uma frase de encorajamento. Retorne APENAS o texto, sem título.`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)
  try {
    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: 'openai', seed: Math.floor(Math.random() * 9999) }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Serviço indisponível (${response.status})`)
    const text = await response.text()
    if (!text.trim()) throw new Error('Resposta vazia')
    return text.trim()
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('Tempo limite excedido (30s). Tente novamente.')
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

  const [title, setTitle]         = useState('')
  const [tema, setTema]           = useState('')
  const [type, setType]           = useState(TYPES[0].value)
  const [planRequired, setPlan]   = useState('free')
  const [frequency, setFrequency] = useState(FREQUENCIES[1].value)
  const [content, setContent]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [generating, setGenerating] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('automated_contents')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) flash('Erro ao carregar: ' + error.message, 'err')
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [])

  function flash(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function openNew() {
    setEditing(null); setTitle(''); setTema(''); setType(TYPES[0].value)
    setPlan('free'); setFrequency(FREQUENCIES[1].value); setContent('')
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
      const typeLabel = TYPE_LABELS[type] || type
      const freqLabel = FREQ_LABELS[frequency] || frequency
      const result = await generateContent(tema.trim(), typeLabel, freqLabel)
      setContent(result)
      if (!title.trim()) setTitle(`${typeLabel} — ${tema.trim()}`)
      flash('Conteúdo gerado!')
    } catch (e) {
      flash(`Geração falhou: ${(e as Error)?.message || 'Erro desconhecido'}`, 'err')
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (!title.trim()) { flash('Título obrigatório', 'err'); return }
    if (!content.trim()) { flash('Gere ou escreva o conteúdo', 'err'); return }
    setSaving(true)
    const payload = {
      title,
      type,
      plan_required: planRequired,
      frequency,
      content,
      is_active: true,
      active: true,
    }
    let error: { message: string } | null
    if (editing) {
      const res = await supabase.from('automated_contents').update(payload).eq('id', editing.id)
      error = res.error
    } else {
      const res = await supabase.from('automated_contents').insert(payload).select().single()
      error = res.error
    }
    setSaving(false)

    if (error) {
      flash('Erro ao salvar: ' + error.message, 'err')
      return
    }
    flash('Salvo!')
    setShowForm(false)
    load()
  }

  async function toggle(id: string, currentActive: boolean) {
    const { error } = await supabase.from('automated_contents').update({ is_active: !currentActive, active: !currentActive }).eq('id', id)
    if (error) flash('Erro ao alternar: ' + error.message, 'err')
    else setItems(is => is.map(i => i.id === id ? { ...i, is_active: !currentActive, active: !currentActive } : i))
  }

  async function remove(id: string) {
    if (!confirm('Excluir?')) return
    const { error } = await supabase.from('automated_contents').delete().eq('id', id)
    if (error) flash('Erro ao excluir: ' + error.message, 'err')
    else load()
  }

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg shadow-lg ${
          toast.type === 'ok' ? 'bg-forest-800 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${FREQ_COLORS[preview.frequency] || 'bg-stone-100 text-stone-600'}`}>
                  {FREQ_LABELS[preview.frequency] || preview.frequency}
                </span>
                <button onClick={() => setPreview(null)} className="text-stone-400 hover:text-stone-600 text-xl">×</button>
              </div>
              <h2 className="text-lg font-bold text-forest-900 mb-1">{preview.title}</h2>
              <p className="text-xs text-stone-400 mb-4">{TYPE_LABELS[preview.type] || preview.type} · {PLAN_LABELS[preview.plan_required]}</p>
              <div className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">{preview.content}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-forest-900">Conteúdos Automáticos</h1>
          <p className="text-stone-400 text-xs mt-1">Gere com IA e entregue aos usuários no app</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-forest-800">
          <Plus size={14} /> Novo conteúdo
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-line p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">
            {editing ? 'Editar conteúdo' : 'Novo conteúdo automático'}
          </h2>

          <div className="bg-gradient-to-r from-mint to-stone-50 border border-forest-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-forest-700" />
              <span className="text-sm font-semibold text-forest-900">Gerar com IA</span>
              <span className="text-xs text-forest-700 bg-mint px-2 py-0.5 rounded-full">Gratuito · Sem chave</span>
            </div>
            <div className="flex gap-2">
              <input
                value={tema}
                onChange={e => setTema(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder="Ex: ansiedade no trabalho, luto, relacionamentos..."
                className="flex-1 px-3 py-2 border border-forest-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
              />
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 bg-forest-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-forest-800 disabled:opacity-50 whitespace-nowrap"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? 'Gerando...' : 'Gerar'}
              </button>
            </div>
          </div>

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
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Frequência</label>
              <select className={inputCls} value={frequency} onChange={e => setFrequency(e.target.value)}>
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
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
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-forest-900 text-white rounded-lg hover:bg-forest-800 disabled:opacity-50">
              <Save size={14} />{saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-stone-400 text-sm">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm">Nenhum conteúdo automático criado ainda.</div>
        ) : items.map(item => {
          const isActive = item.is_active ?? item.active
          return (
            <div key={item.id} className="bg-white border rounded-xl p-4 flex items-start gap-3">
              <button
                onClick={() => toggle(item.id, isActive)}
                className={"mt-0.5 flex-shrink-0 " + (isActive ? 'text-forest-600' : 'text-stone-300')}
                title={isActive ? 'Desativar' : 'Ativar'}
              >
                {isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-forest-900 text-sm">{item.title}</span>
                  <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{TYPE_LABELS[item.type] || item.type}</span>
                  {!isActive && <span className="text-xs text-orange-500">Inativo</span>}
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
          )
        })}
      </div>
    </div>
  )
}
