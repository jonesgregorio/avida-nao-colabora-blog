import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Plus, Pencil, Trash2, Eye, Copy, Archive,
  ChevronUp, ChevronDown, X, Save, Send, Clock, CheckCircle,
  AlertCircle, Info, List, Settings, BarChart2, Play,
  GripVertical, ChevronRight, FileText
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type QStatus = 'draft' | 'published' | 'scheduled' | 'inactive' | 'archived'
type QType = 'autoavaliacao' | 'diagnostico' | 'triagem' | 'check-in' | 'reflexao' |
  'psicoeducacao' | 'rastreamento' | 'clima-emocional' | 'identidade' | 'relacionamentos' | 'outro'
type QuestionType = 'single_choice' | 'multiple_choice' | 'yes_no' | 'emotion_select' |
  'scale_5' | 'scale_10' | 'text_short' | 'text_long' | 'rating' | 'info'

interface QOption {
  id: string
  text: string
  score: number
  tag?: string
}

interface QQuestion {
  id: string
  type: QuestionType
  text: string
  subtitle?: string
  required: boolean
  options: QOption[]
  min_label?: string
  max_label?: string
  expanded?: boolean
}

interface QResult {
  id: string
  min_score: number
  max_score: number
  label: string
  description: string
  recommendation: string
  color: string
}

interface QData {
  id?: string
  title: string
  description: string
  type: QType
  category: string
  emotional_category: string
  status: QStatus
  plan_required: string
  estimated_time: number
  question_count: number
  show_on_questionnaires_page: boolean
  show_score: boolean
  show_result: boolean
  allow_anonymous: boolean
  allow_retake: boolean
  scheduled_at: string
  cover_image: string
  intro_text: string
  completion_text: string
  tags: string[]
  questions: QQuestion[]
  results: QResult[]
  created_at?: string
}

interface QListItem {
  id: string
  title: string
  status: QStatus
  type: QType
  category: string
  plan_required: string
  question_count: number
  estimated_time: number
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Rascunho',   color: 'text-stone-600', bg: 'bg-stone-100' },
  published: { label: 'Publicado',  color: 'text-emerald-700', bg: 'bg-emerald-100' },
  scheduled: { label: 'Agendado',   color: 'text-blue-700', bg: 'bg-blue-100' },
  inactive:  { label: 'Inativo',    color: 'text-orange-700', bg: 'bg-orange-100' },
  archived:  { label: 'Arquivado',  color: 'text-red-700', bg: 'bg-red-100' },
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'single_choice',   label: 'Escolha única' },
  { value: 'multiple_choice', label: 'Múltipla escolha' },
  { value: 'yes_no',          label: 'Sim / Não' },
  { value: 'emotion_select',  label: 'Seleção de emoção' },
  { value: 'scale_5',         label: 'Escala 1–5' },
  { value: 'scale_10',        label: 'Escala 1–10' },
  { value: 'text_short',      label: 'Texto curto' },
  { value: 'text_long',       label: 'Texto longo' },
  { value: 'rating',          label: 'Avaliação (estrelas)' },
  { value: 'info',            label: 'Informativo (sem resposta)' },
]

const QUESTIONNAIRE_TYPES: { value: QType; label: string }[] = [
  { value: 'autoavaliacao', label: 'Autoavaliação' },
  { value: 'diagnostico', label: 'Diagnóstico' },
  { value: 'triagem', label: 'Triagem' },
  { value: 'check-in', label: 'Check-in' },
  { value: 'reflexao', label: 'Reflexão' },
  { value: 'psicoeducacao', label: 'Psicoeducação' },
  { value: 'rastreamento', label: 'Rastreamento' },
  { value: 'clima-emocional', label: 'Clima emocional' },
  { value: 'identidade', label: 'Identidade' },
  { value: 'relacionamentos', label: 'Relacionamentos' },
  { value: 'outro', label: 'Outro' },
]

const CATEGORIES = [
  'Ansiedade', 'Depressão', 'Autoestima', 'Relacionamentos', 'Trabalho',
  'Sono', 'Estresse', 'Trauma', 'Luto', 'Identidade', 'Geral'
]

const EMOTIONAL_CATEGORIES = [
  'Medo', 'Tristeza', 'Raiva', 'Alegria', 'Nojo', 'Surpresa',
  'Vergonha', 'Culpa', 'Amor', 'Solidão', 'Esperança', 'Gratidão'
]

const PLAN_OPTIONS = [
  { value: 'free', label: 'Gratuito' },
  { value: 'essential', label: 'Essencial' },
  { value: 'therapeutic', label: 'Terapêutico' },
  { value: 'therapeutic-plus', label: 'Terapêutico Plus' },
]

const RESULT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const emptyQ = (): QData => ({
  title: '', description: '', type: 'autoavaliacao', category: 'Geral',
  emotional_category: 'Medo', status: 'draft', plan_required: 'free',
  estimated_time: 5, question_count: 0, show_on_questionnaires_page: true,
  show_score: true, show_result: true, allow_anonymous: true, allow_retake: true,
  scheduled_at: '', cover_image: '', intro_text: '', completion_text: '',
  tags: [], questions: [], results: [],
})

const uid = () => Math.random().toString(36).slice(2, 9)

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionEditor({ option, onChange, onRemove }: {
  option: QOption
  onChange: (o: QOption) => void
  onRemove: () => void
}) {
  return (
    <div className="flex gap-2 items-center bg-stone-50 rounded p-2 mb-1">
      <GripVertical size={14} className="text-stone-400 shrink-0" />
      <input
        className="flex-1 text-sm border rounded px-2 py-1"
        placeholder="Texto da opção"
        value={option.text}
        onChange={e => onChange({ ...option, text: e.target.value })}
      />
      <input
        type="number"
        className="w-16 text-sm border rounded px-2 py-1"
        placeholder="Pts"
        value={option.score}
        onChange={e => onChange({ ...option, score: Number(e.target.value) })}
      />
      <input
        className="w-20 text-sm border rounded px-2 py-1"
        placeholder="Tag"
        value={option.tag || ''}
        onChange={e => onChange({ ...option, tag: e.target.value })}
      />
      <button onClick={onRemove} className="text-red-400 hover:text-red-600">
        <X size={14} />
      </button>
    </div>
  )
}

function QuestionEditor({ question, index, onChange, onRemove, onMove }: {
  question: QQuestion
  index: number
  onChange: (q: QQuestion) => void
  onRemove: () => void
  onMove: (dir: 1 | -1) => void
}) {
  const toggle = () => onChange({ ...question, expanded: !question.expanded })
  const hasOptions = ['single_choice', 'multiple_choice', 'emotion_select'].includes(question.type)

  const addOption = () => {
    const option: QOption = { id: uid(), text: '', score: 0, tag: '' }
    onChange({ ...question, options: [...question.options, option] })
  }

  const updateOption = (i: number, o: QOption) => {
    const opts = [...question.options]
    opts[i] = o
    onChange({ ...question, options: opts })
  }

  const removeOption = (i: number) => {
    onChange({ ...question, options: question.options.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="border rounded-lg mb-3 overflow-hidden">
      <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 cursor-pointer" onClick={toggle}>
        <span className="text-xs font-bold text-stone-500 w-5">{index + 1}</span>
        <ChevronRight size={14} className={`text-stone-400 transition-transform ${question.expanded ? 'rotate-90' : ''}`} />
        <span className="flex-1 text-sm font-medium text-stone-700 truncate">{question.text || `Pergunta ${index + 1}`}</span>
        <select
          className="text-xs border rounded px-1 py-0.5 bg-white"
          value={question.type}
          onClick={e => e.stopPropagation()}
          onChange={e => { e.stopPropagation(); onChange({ ...question, type: e.target.value as QuestionType }) }}
        >
          {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button onClick={e => { e.stopPropagation(); onMove(-1) }} className="text-stone-400 hover:text-stone-600"><ChevronUp size={14} /></button>
        <button onClick={e => { e.stopPropagation(); onMove(1) }} className="text-stone-400 hover:text-stone-600"><ChevronDown size={14} /></button>
        <button onClick={e => { e.stopPropagation(); onRemove() }} className="text-red-400 hover:text-red-600"><X size={14} /></button>
      </div>

      {question.expanded && (
        <div className="p-3 space-y-3">
          <textarea
            className="w-full text-sm border rounded px-2 py-1 resize-none"
            rows={2}
            placeholder="Texto da pergunta *"
            value={question.text}
            onChange={e => onChange({ ...question, text: e.target.value })}
          />
          <input
            className="w-full text-sm border rounded px-2 py-1"
            placeholder="Subtítulo (opcional)"
            value={question.subtitle || ''}
            onChange={e => onChange({ ...question, subtitle: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={question.required} onChange={e => onChange({ ...question, required: e.target.checked })} />
            Resposta obrigatória
          </label>
          {hasOptions && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-stone-500">Opções</span>
                <button onClick={addOption} className="text-xs text-emerald-600 hover:underline flex items-center gap-1"><Plus size={12} />Adicionar opção</button>
              </div>
              {question.options.map((opt, i) => (
                <OptionEditor key={opt.id} option={opt} onChange={o => updateOption(i, o)} onRemove={() => removeOption(i)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminQuestionnaires() {
  const [list, setList] = useState<QListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [editing, setEditing] = useState<QData>(emptyQ())
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<QStatus | 'all'>('all')
  const [activeTab, setActiveTab] = useState<'info' | 'questions' | 'results' | 'settings'>('info')

  const flash = (type: 'ok' | 'err', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('questionnaires')
      .select('id,title,status,type,category,plan_required,question_count,estimated_time,created_at')
      .order('created_at', { ascending: false })
    if (error) flash('err', error.message)
    else setList(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(emptyQ()); setView('editor'); setActiveTab('info') }

  const openEdit = async (id: string) => {
    const { data, error } = await supabase.from('questionnaires').select('*').eq('id', id).single()
    if (error) { flash('err', error.message); return }
    setEditing({ ...data, questions: (data.questions || []).map((q: QQuestion) => ({ ...q, expanded: false })), results: data.results || [], tags: data.tags || [] })
    setView('editor'); setActiveTab('info')
  }

  const save = async (targetStatus?: QStatus) => {
    setSaving(true)
    const newStatus = targetStatus || editing.status
    const isPublishing = newStatus === 'published' && editing.status !== 'published'
    const payload = {
      ...editing,
      status: newStatus,
      question_count: editing.questions.length,
      questions: editing.questions.map(({ expanded: _e, ...q }) => q),
      // define published_at apenas na primeira publicação
      ...(isPublishing ? { published_at: new Date().toISOString() } : {}),
    }
    const { error } = editing.id
      ? await supabase.from('questionnaires').update(payload).eq('id', editing.id)
      : await supabase.from('questionnaires').insert([payload])
    if (error) flash('err', error.message)
    else { flash('ok', 'Salvo!'); await load(); if (!editing.id) setView('list') }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Excluir?')) return
    await supabase.from('questionnaires').delete().eq('id', id)
    flash('ok', 'Excluído.'); load()
  }

  const duplicate = async (id: string) => {
    const { data } = await supabase.from('questionnaires').select('*').eq('id', id).single()
    if (!data) return
    const { id: _id, created_at: _c, ...rest } = data
    await supabase.from('questionnaires').insert([{ ...rest, title: `${rest.title} (cópia)`, status: 'draft' }])
    flash('ok', 'Duplicado!'); load()
  }

  const addQ = () => setEditing(e => ({ ...e, questions: [...e.questions, { id: uid(), type: 'single_choice' as QuestionType, text: '', required: true, options: [], expanded: true }] }))
  const updQ = (i: number, q: QQuestion) => setEditing(e => { const qs = [...e.questions]; qs[i] = q; return { ...e, questions: qs } })
  const delQ = (i: number) => setEditing(e => ({ ...e, questions: e.questions.filter((_, idx) => idx !== i) }))
  const movQ = (i: number, dir: 1 | -1) => setEditing(e => { const qs = [...e.questions]; const j = i + dir; if (j < 0 || j >= qs.length) return e; [qs[i], qs[j]] = [qs[j], qs[i]]; return { ...e, questions: qs } })

  const addR = () => setEditing(e => ({ ...e, results: [...e.results, { id: uid(), min_score: 0, max_score: 10, label: '', description: '', recommendation: '', color: RESULT_COLORS[e.results.length % RESULT_COLORS.length] }] }))
  const updR = (i: number, r: QResult) => setEditing(e => { const rs = [...e.results]; rs[i] = r; return { ...e, results: rs } })
  const delR = (i: number) => setEditing(e => ({ ...e, results: e.results.filter((_, idx) => idx !== i) }))

  const filtered = list.filter(q => (filterStatus === 'all' || q.status === filterStatus) && q.title.toLowerCase().includes(search.toLowerCase()))

  if (view === 'list') return (
    <div className="p-6 max-w-5xl mx-auto">
      {msg && <div className={`mb-4 px-4 py-2 rounded text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-stone-800 flex items-center gap-2"><List size={20} />Questionários</h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700"><Plus size={16} />Novo</button>
      </div>
      <div className="flex gap-3 mb-4">
        <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="border rounded-lg px-3 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value as QStatus | 'all')}>
          <option value="all">Todos</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      {loading ? <div className="text-center py-12 text-stone-400">Carregando...</div> : (
        <div className="space-y-2">
          {filtered.map(q => {
            const sc = STATUS_CONFIG[q.status]
            return (
              <div key={q.id} className="flex items-center gap-3 bg-white border rounded-lg px-4 py-3 hover:border-stone-300">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-stone-800 text-sm truncate">{q.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.color} ${sc.bg}`}>{sc.label}</span>
                  </div>
                  <div className="text-xs text-stone-400 flex gap-3"><span>{q.category}</span><span>{q.question_count} perguntas</span><span>{q.estimated_time} min</span></div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(q.id)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded"><Pencil size={14} /></button>
                  <button onClick={() => duplicate(q.id)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded"><Copy size={14} /></button>
                  <button onClick={() => del(q.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <div className="text-center py-12 text-stone-400"><FileText size={40} className="mx-auto mb-3 opacity-30" /><p>Nenhum questionário</p></div>}
        </div>
      )}
    </div>
  )

  const tabs = [
    { key: 'info' as const, label: 'Informações', icon: <Info size={14} /> },
    { key: 'questions' as const, label: `Perguntas (${editing.questions.length})`, icon: <List size={14} /> },
    { key: 'results' as const, label: `Resultados (${editing.results.length})`, icon: <BarChart2 size={14} /> },
    { key: 'settings' as const, label: 'Configurações', icon: <Settings size={14} /> },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {msg && <div className={`mb-4 px-4 py-2 rounded text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setView('list')} className="text-stone-400 hover:text-stone-700"><X size={20} /></button>
        <h1 className="text-xl font-bold text-stone-800 flex-1">{editing.id ? 'Editar' : 'Novo questionário'}</h1>
        <button onClick={() => save()} disabled={saving} className="flex items-center gap-2 border rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"><Save size={14} />{saving ? 'Salvando...' : 'Rascunho'}</button>
        <button onClick={() => save('published')} disabled={saving} className="flex items-center gap-2 bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50"><Send size={14} />Publicar</button>
      </div>
      <div className="flex border-b mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 ${activeTab === t.key ? 'border-stone-800 text-stone-800 font-medium' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="space-y-4">
          <div><label className="text-xs text-stone-500 block mb-1">Título *</label><input className="w-full border rounded-lg px-3 py-2 text-sm" value={editing.title} onChange={e => setEditing(x => ({ ...x, title: e.target.value }))} /></div>
          <div><label className="text-xs text-stone-500 block mb-1">Descrição</label><textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={3} value={editing.description} onChange={e => setEditing(x => ({ ...x, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-stone-500 block mb-1">Tipo</label><select className="w-full border rounded-lg px-3 py-2 text-sm" value={editing.type} onChange={e => setEditing(x => ({ ...x, type: e.target.value as QType }))}>{QUESTIONNAIRE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div><label className="text-xs text-stone-500 block mb-1">Categoria</label><select className="w-full border rounded-lg px-3 py-2 text-sm" value={editing.category} onChange={e => setEditing(x => ({ ...x, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-stone-500 block mb-1">Tempo (min)</label><input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={editing.estimated_time} onChange={e => setEditing(x => ({ ...x, estimated_time: Number(e.target.value) }))} /></div>
            <div><label className="text-xs text-stone-500 block mb-1">Categoria emocional</label><select className="w-full border rounded-lg px-3 py-2 text-sm" value={editing.emotional_category} onChange={e => setEditing(x => ({ ...x, emotional_category: e.target.value }))}>{EMOTIONAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-stone-500 block mb-1">Texto de introdução</label><textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2} value={editing.intro_text} onChange={e => setEditing(x => ({ ...x, intro_text: e.target.value }))} /></div>
          <div><label className="text-xs text-stone-500 block mb-1">Texto de conclusão</label><textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2} value={editing.completion_text} onChange={e => setEditing(x => ({ ...x, completion_text: e.target.value }))} /></div>
        </div>
      )}

      {activeTab === 'questions' && (
        <div>
          {editing.questions.map((q, i) => <QuestionEditor key={q.id} question={q} index={i} onChange={nq => updQ(i, nq)} onRemove={() => delQ(i)} onMove={dir => movQ(i, dir)} />)}
          <button onClick={addQ} className="flex items-center gap-2 text-sm text-emerald-600 hover:underline mt-2"><Plus size={14} />Adicionar pergunta</button>
        </div>
      )}

      {activeTab === 'results' && (
        <div>
          {editing.results.map((r, i) => (
            <div key={r.id} className="border rounded-lg p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <input type="color" value={r.color} onChange={e => updR(i, { ...r, color: e.target.value })} className="w-8 h-8 rounded border cursor-pointer" />
                <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Label" value={r.label} onChange={e => updR(i, { ...r, label: e.target.value })} />
                <button onClick={() => delR(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div><label className="text-xs text-stone-500 block mb-1">Pontuação mín.</label><input type="number" className="w-full border rounded px-2 py-1 text-sm" value={r.min_score} onChange={e => updR(i, { ...r, min_score: Number(e.target.value) })} /></div>
                <div><label className="text-xs text-stone-500 block mb-1">Pontuação máx.</label><input type="number" className="w-full border rounded px-2 py-1 text-sm" value={r.max_score} onChange={e => updR(i, { ...r, max_score: Number(e.target.value) })} /></div>
              </div>
              <textarea className="w-full border rounded px-2 py-1 text-sm resize-none mb-2" rows={2} placeholder="Descrição" value={r.description} onChange={e => updR(i, { ...r, description: e.target.value })} />
              <textarea className="w-full border rounded px-2 py-1 text-sm resize-none" rows={2} placeholder="Recomendação" value={r.recommendation} onChange={e => updR(i, { ...r, recommendation: e.target.value })} />
            </div>
          ))}
          <button onClick={addR} className="flex items-center gap-2 text-sm text-emerald-600 hover:underline"><Plus size={14} />Adicionar resultado</button>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-stone-500 block mb-1">Status</label><select className="w-full border rounded-lg px-3 py-2 text-sm" value={editing.status} onChange={e => setEditing(x => ({ ...x, status: e.target.value as QStatus }))}>{Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label className="text-xs text-stone-500 block mb-1">Plano mínimo</label><select className="w-full border rounded-lg px-3 py-2 text-sm" value={editing.plan_required} onChange={e => setEditing(x => ({ ...x, plan_required: e.target.value }))}>{PLAN_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
          </div>
          <div className="space-y-2 pt-2 border-t">
            {([['show_on_questionnaires_page','Exibir na página pública'],['show_score','Mostrar pontuação'],['show_result','Mostrar resultado'],['allow_anonymous','Permitir anônimo'],['allow_retake','Permitir refazer']] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editing[key as keyof QData] as boolean} onChange={e => setEditing(x => ({ ...x, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
