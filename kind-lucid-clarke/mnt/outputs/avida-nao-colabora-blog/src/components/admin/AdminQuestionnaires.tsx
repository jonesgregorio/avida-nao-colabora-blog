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
  min_plan: string
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
  min_plan: string
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
  emotional_category: 'Medo', status: 'draft', min_plan: 'free',
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
        <span className="flex-1 text-sm font-medium text-stone-700 truncate">
          {question.text || '(sem texto)'}
        </span>
        <span className="text-xs text-stone-400 bg-stone-200 px-2 py-0.5 rounded">
          {QUESTION_TYPES.find(t => t.value === question.type)?.label}
        </span>
        <button onClick={e => { e.stopPropagation(); onMove(-1) }} className="text-stone-400 hover:text-stone-600"><ChevronUp size={14} /></button>
        <button onClick={e => { e.stopPropagation(); onMove(1) }} className="text-stone-400 hover:text-stone-600"><ChevronDown size={14} /></button>
        <button onClick={e => { e.stopPropagation(); onRemove() }} className="text-red-400 hover:text-red-600"><X size={14} /></button>
      </div>

      {question.expanded && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Tipo</label>
              <select
                className="w-full text-sm border rounded px-2 py-1.5"
                value={question.type}
                onChange={e => onChange({ ...question, type: e.target.value as QuestionType, options: [] })}
              >
                {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <input
                type="checkbox"
                id={`req-${question.id}`}
                checked={question.required}
                onChange={e => onChange({ ...question, required: e.target.checked })}
              />
              <label htmlFor={`req-${question.id}`} className="text-sm text-stone-600">Obrigatória</label>
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500 mb-1 block">Texto da pergunta</label>
            <textarea
              className="w-full text-sm border rounded px-2 py-1.5 resize-none"
              rows={2}
              value={question.text}
              onChange={e => onChange({ ...question, text: e.target.value })}
              placeholder="Digite a pergunta..."
            />
          </div>

          <div>
            <label className="text-xs text-stone-500 mb-1 block">Subtítulo / instrução (opcional)</label>
            <input
              className="w-full text-sm border rounded px-2 py-1.5"
              value={question.subtitle || ''}
              onChange={e => onChange({ ...question, subtitle: e.target.value })}
              placeholder="Ex: Escolha a opção que melhor descreve..."
            />
          </div>

          {(question.type === 'scale_5' || question.type === 'scale_10') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Rótulo mínimo</label>
                <input className="w-full text-sm border rounded px-2 py-1.5" value={question.min_label || ''} onChange={e => onChange({ ...question, min_label: e.target.value })} placeholder="Ex: Nunca" />
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Rótulo máximo</label>
                <input className="w-full text-sm border rounded px-2 py-1.5" value={question.max_label || ''} onChange={e => onChange({ ...question, max_label: e.target.value })} placeholder="Ex: Sempre" />
              </div>
            </div>
          )}

          {hasOptions && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-stone-500">Opções <span className="text-stone-400">(texto | pontos | tag)</span></label>
                <button onClick={addOption} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                  <Plus size={12} /> Adicionar opção
                </button>
              </div>
              {question.options.map((opt, i) => (
                <OptionEditor
                  key={opt.id}
                  option={opt}
                  onChange={o => updateOption(i, o)}
                  onRemove={() => removeOption(i)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultEditor({ result, onChange, onRemove }: {
  result: QResult
  onChange: (r: QResult) => void
  onRemove: () => void
}) {
  return (
    <div className="border rounded-lg p-3 mb-3" style={{ borderLeftColor: result.color, borderLeftWidth: 4 }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">
          {RESULT_COLORS.map(c => (
            <button
              key={c}
              className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: c, borderColor: result.color === c ? '#000' : 'transparent' }}
              onClick={() => onChange({ ...result, color: c })}
            />
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={onRemove} className="text-red-400 hover:text-red-600"><X size={14} /></button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-xs text-stone-500 mb-1 block">Pontuação mín.</label>
          <input type="number" className="w-full text-sm border rounded px-2 py-1.5" value={result.min_score} onChange={e => onChange({ ...result, min_score: Number(e.target.value) })} />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">Pontuação máx.</label>
          <input type="number" className="w-full text-sm border rounded px-2 py-1.5" value={result.max_score} onChange={e => onChange({ ...result, max_score: Number(e.target.value) })} />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">Rótulo</label>
          <input className="w-full text-sm border rounded px-2 py-1.5" value={result.label} onChange={e => onChange({ ...result, label: e.target.value })} placeholder="Ex: Leve" />
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-xs text-stone-500 mb-1 block">Descrição do resultado</label>
          <textarea className="w-full text-sm border rounded px-2 py-1.5 resize-none" rows={2} value={result.description} onChange={e => onChange({ ...result, description: e.target.value })} placeholder="Descreva o que significa esta faixa..." />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">Recomendação</label>
          <textarea className="w-full text-sm border rounded px-2 py-1.5 resize-none" rows={2} value={result.recommendation} onChange={e => onChange({ ...result, recommendation: e.target.value })} placeholder="O que o usuário pode fazer a seguir..." />
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ q, onClose }: { q: QData; onClose: () => void }) {
  const [step, setStep] = useState(-1)
  const [answers, setAnswers] = useState<Record<string, any>>({})

  const questions = q.questions.filter(qu => qu.type !== 'info')
  const isIntro = step === -1
  const isDone = step >= questions.length && step > -1

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-stone-700">Preview: {q.title}</span>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="p-6">
          {isIntro && (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-bold text-stone-800">{q.title}</h2>
              <p className="text-stone-600">{q.intro_text || q.description}</p>
              <p className="text-sm text-stone-400">⏱ ~{q.estimated_time} min • {q.questions.length} perguntas</p>
              <button onClick={() => setStep(0)} className="bg-emerald-600 text-white px-6 py-2 rounded-full hover:bg-emerald-700">
                Iniciar
              </button>
            </div>
          )}

          {!isIntro && !isDone && questions[step] && (
            <div className="space-y-4">
              <div className="flex justify-between text-xs text-stone-400">
                <span>Pergunta {step + 1} de {questions.length}</span>
                <span>{Math.round(((step + 1) / questions.length) * 100)}%</span>
              </div>
              <div className="h-1 bg-stone-100 rounded-full">
                <div className="h-1 bg-emerald-500 rounded-full transition-all" style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
              </div>
              <p className="font-semibold text-stone-800">{questions[step].text}</p>
              {questions[step].subtitle && <p className="text-sm text-stone-500">{questions[step].subtitle}</p>}

              {['single_choice', 'yes_no', 'emotion_select'].includes(questions[step].type) && (
                <div className="space-y-2">
                  {(questions[step].type === 'yes_no'
                    ? [{ id: 'y', text: 'Sim', score: 1 }, { id: 'n', text: 'Não', score: 0 }]
                    : questions[step].options
                  ).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setAnswers(a => ({ ...a, [questions[step].id]: opt.id })); setTimeout(() => setStep(s => s + 1), 300) }}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${answers[questions[step].id] === opt.id ? 'bg-emerald-50 border-emerald-400' : 'hover:bg-stone-50'}`}
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
              )}

              {(questions[step].type === 'scale_5' || questions[step].type === 'scale_10') && (
                <div className="flex gap-2 flex-wrap justify-center">
                  {Array.from({ length: questions[step].type === 'scale_5' ? 5 : 10 }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => { setAnswers(a => ({ ...a, [questions[step].id]: n })); setTimeout(() => setStep(s => s + 1), 300) }}
                      className={`w-10 h-10 rounded-full border text-sm font-semibold transition-colors ${answers[questions[step].id] === n ? 'bg-emerald-500 text-white border-emerald-500' : 'hover:bg-stone-50'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {(questions[step].type === 'text_short' || questions[step].type === 'text_long') && (
                <div>
                  {questions[step].type === 'text_short'
                    ? <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Sua resposta..." />
                    : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={4} placeholder="Sua resposta..." />
                  }
                  <button onClick={() => setStep(s => s + 1)} className="mt-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">Próximo</button>
                </div>
              )}
            </div>
          )}

          {isDone && (
            <div className="text-center space-y-4">
              <CheckCircle size={48} className="mx-auto text-emerald-500" />
              <h3 className="text-xl font-bold text-stone-800">Questionário concluído!</h3>
              <p className="text-stone-600">{q.completion_text || 'Obrigado por responder.'}</p>
              <button onClick={() => { setStep(-1); setAnswers({}) }} className="text-sm text-emerald-600 hover:underline">
                Reiniciar preview
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminQuestionnaires() {
  const [list, setList] = useState<QListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [editorTab, setEditorTab] = useState<'info' | 'questions' | 'results' | 'preview'>('info')
  const [data, setData] = useState<QData>(emptyQ())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('questionnaires')
      .select('id,title,status,type,category,min_plan,question_count,estimated_time,created_at')
      .order('created_at', { ascending: false })
    setList((rows as QListItem[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const flash = (msg: string, isError = false) => {
    if (isError) setError(msg); else setSuccess(msg)
    setTimeout(() => { setError(''); setSuccess('') }, 3500)
  }

  const newQuestionnaire = () => {
    setData(emptyQ())
    setEditorTab('info')
    setView('editor')
  }

  const editQuestionnaire = async (id: string) => {
    const { data: row } = await supabase.from('questionnaires').select('*').eq('id', id).single()
    if (!row) return
    setData({
      ...emptyQ(),
      ...row,
      questions: row.questions || [],
      results: row.results || [],
      tags: row.tags || [],
    })
    setEditorTab('info')
    setView('editor')
  }

  const validate = (forPublish = false) => {
    if (!data.title.trim()) return 'Título é obrigatório'
    if (!data.description.trim()) return 'Descrição é obrigatória'
    if (forPublish) {
      if (!data.category) return 'Categoria é obrigatória para publicar'
      if (data.questions.length === 0) return 'Adicione pelo menos uma pergunta para publicar'
      if (data.results.length === 0) return 'Adicione pelo menos um resultado para publicar'
    }
    return ''
  }

  const save = async (status?: QStatus) => {
    const err = validate(status === 'published')
    if (err) { flash(err, true); return }

    setSaving(true)
    const payload = {
      ...data,
      status: status || data.status,
      question_count: data.questions.length,
      scheduled_at: data.scheduled_at || null,
    }

    let result
    if (data.id) {
      result = await supabase.from('questionnaires').update(payload).eq('id', data.id)
    } else {
      result = await supabase.from('questionnaires').insert(payload).select().single()
      if (result.data) setData(d => ({ ...d, id: result.data.id }))
    }

    setSaving(false)
    if (result.error) { flash(result.error.message, true); return }

    flash(status === 'published' ? 'Questionário publicado!' : 'Salvo com sucesso!')
    load()
  }

  const duplicate = async (id: string) => {
    const { data: row } = await supabase.from('questionnaires').select('*').eq('id', id).single()
    if (!row) return
    const { id: _, created_at: __, ...rest } = row
    await supabase.from('questionnaires').insert({ ...rest, title: `${row.title} (cópia)`, status: 'draft' })
    flash('Duplicado com sucesso!')
    load()
  }

  const archive = async (id: string) => {
    await supabase.from('questionnaires').update({ status: 'archived' }).eq('id', id)
    flash('Arquivado.')
    load()
  }

  const deleteQ = async (id: string) => {
    await supabase.from('questionnaires').delete().eq('id', id)
    setDeleteConfirm(null)
    flash('Excluído.')
    load()
  }

  // Question operations
  const addQuestion = () => {
    const q: QQuestion = {
      id: uid(), type: 'single_choice', text: '', required: true,
      options: [], expanded: true,
    }
    setData(d => ({ ...d, questions: [...d.questions, q] }))
  }

  const updateQuestion = (i: number, q: QQuestion) => {
    setData(d => {
      const qs = [...d.questions]; qs[i] = q; return { ...d, questions: qs }
    })
  }

  const removeQuestion = (i: number) => {
    setData(d => ({ ...d, questions: d.questions.filter((_, idx) => idx !== i) }))
  }

  const moveQuestion = (i: number, dir: 1 | -1) => {
    setData(d => {
      const qs = [...d.questions]
      const j = i + dir
      if (j < 0 || j >= qs.length) return d
      ;[qs[i], qs[j]] = [qs[j], qs[i]]
      return { ...d, questions: qs }
    })
  }

  // Result operations
  const addResult = () => {
    const r: QResult = {
      id: uid(), min_score: 0, max_score: 10,
      label: '', description: '', recommendation: '',
      color: RESULT_COLORS[data.results.length % RESULT_COLORS.length],
    }
    setData(d => ({ ...d, results: [...d.results, r] }))
  }

  const updateResult = (i: number, r: QResult) => {
    setData(d => {
      const rs = [...d.results]; rs[i] = r; return { ...d, results: rs }
    })
  }

  const removeResult = (i: number) => {
    setData(d => ({ ...d, results: d.results.filter((_, idx) => idx !== i) }))
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Questionários</h1>
            <p className="text-stone-500 text-sm mt-1">{list.length} questionário{list.length !== 1 ? 's' : ''} cadastrado{list.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={newQuestionnaire}
            className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-700 transition-colors"
          >
            <Plus size={16} /> Novo questionário
          </button>
        </div>

        {/* Flash */}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><AlertCircle size={14} />{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-center gap-2"><CheckCircle size={14} />{success}</div>}

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-stone-400">Carregando...</div>
        ) : list.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <FileText size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhum questionário cadastrado ainda.</p>
            <button onClick={newQuestionnaire} className="mt-4 text-sm text-emerald-600 hover:underline">Criar o primeiro</button>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map(item => {
              const st = STATUS_CONFIG[item.status]
              return (
                <div key={item.id} className="bg-white border rounded-xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                      <span className="text-xs text-stone-400">{PLAN_OPTIONS.find(p => p.value === item.min_plan)?.label}</span>
                    </div>
                    <p className="font-semibold text-stone-800 truncate">{item.title}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {item.category} • {item.question_count} perguntas • ~{item.estimated_time} min
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => editQuestionnaire(item.id)} className="p-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg" title="Editar"><Pencil size={15} /></button>
                    <button onClick={() => duplicate(item.id)} className="p-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg" title="Duplicar"><Copy size={15} /></button>
                    <button onClick={() => archive(item.id)} className="p-2 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg" title="Arquivar"><Archive size={15} /></button>
                    <button onClick={() => setDeleteConfirm(item.id)} className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir"><Trash2 size={15} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full">
              <h3 className="font-bold text-stone-800 mb-2">Confirmar exclusão</h3>
              <p className="text-stone-500 text-sm mb-4">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 border rounded-lg px-4 py-2 text-sm">Cancelar</button>
                <button onClick={() => deleteQ(deleteConfirm)} className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm">Excluir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── EDITOR VIEW ────────────────────────────────────────────────────────────

  const TABS = [
    { key: 'info',      icon: <Info size={14} />,     label: 'Informações' },
    { key: 'questions', icon: <List size={14} />,      label: `Perguntas (${data.questions.length})` },
    { key: 'results',   icon: <BarChart2 size={14} />, label: `Resultados (${data.results.length})` },
    { key: 'preview',   icon: <Play size={14} />,      label: 'Preview' },
  ] as const

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {showPreview && <PreviewModal q={data} onClose={() => setShowPreview(false)} />}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setView('list')} className="text-stone-500 hover:text-stone-700">
          <ChevronDown size={18} className="-rotate-90" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-stone-800">{data.id ? 'Editar questionário' : 'Novo questionário'}</h1>
          {data.id && <p className="text-xs text-stone-400">ID: {data.id}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-stone-600 hover:bg-stone-50"
          >
            <Eye size={14} /> Preview
          </button>
          <button
            onClick={() => save('draft')}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-stone-600 hover:bg-stone-50"
          >
            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar rascunho'}
          </button>
          {!showSchedule ? (
            <button
              onClick={() => save('published')}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
            >
              <Send size={14} /> Publicar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                className="text-sm border rounded px-2 py-1"
                value={data.scheduled_at}
                onChange={e => setData(d => ({ ...d, scheduled_at: e.target.value }))}
              />
              <button onClick={() => save('scheduled')} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">
                <Clock size={14} /> Agendar
              </button>
            </div>
          )}
          <button
            onClick={() => setShowSchedule(s => !s)}
            className="p-1.5 border rounded-lg text-stone-500 hover:bg-stone-50"
            title="Agendar publicação"
          >
            <Clock size={14} />
          </button>
        </div>
      </div>

      {/* Flash */}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><AlertCircle size={14} />{error}</div>}
      {success && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-center gap-2"><CheckCircle size={14} />{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setEditorTab(tab.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors -mb-px ${
              editorTab === tab.key
                ? 'border-stone-900 text-stone-900 font-medium'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {editorTab === 'info' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-stone-600 mb-1 block">Título *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: Avaliação de ansiedade"
                value={data.title}
                onChange={e => setData(d => ({ ...d, title: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-stone-600 mb-1 block">Descrição *</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Explique o objetivo deste questionário..."
                value={data.description}
                onChange={e => setData(d => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Tipo</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={data.type} onChange={e => setData(d => ({ ...d, type: e.target.value as QType }))}>
                {QUESTIONNAIRE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Categoria</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={data.category} onChange={e => setData(d => ({ ...d, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Categoria emocional</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={data.emotional_category} onChange={e => setData(d => ({ ...d, emotional_category: e.target.value }))}>
                {EMOTIONAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Plano mínimo</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={data.min_plan} onChange={e => setData(d => ({ ...d, min_plan: e.target.value }))}>
                {PLAN_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Tempo estimado (min)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={data.estimated_time} onChange={e => setData(d => ({ ...d, estimated_time: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Status</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={data.status} onChange={e => setData(d => ({ ...d, status: e.target.value as QStatus }))}>
                {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Texto de introdução</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2} value={data.intro_text} onChange={e => setData(d => ({ ...d, intro_text: e.target.value }))} placeholder="Texto exibido antes de iniciar o questionário..." />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Texto de conclusão</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2} value={data.completion_text} onChange={e => setData(d => ({ ...d, completion_text: e.target.value }))} placeholder="Texto exibido ao finalizar..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'show_on_questionnaires_page', label: 'Exibir na página pública' },
              { key: 'show_score', label: 'Mostrar pontuação ao usuário' },
              { key: 'show_result', label: 'Mostrar resultado ao usuário' },
              { key: 'allow_anonymous', label: 'Permitir resposta anônima' },
              { key: 'allow_retake', label: 'Permitir refazer' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={Boolean((data as any)[key])}
                  onChange={e => setData(d => ({ ...d, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Questions */}
      {editorTab === 'questions' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-stone-500">{data.questions.length} pergunta{data.questions.length !== 1 ? 's' : ''}</p>
            <button onClick={addQuestion} className="flex items-center gap-1.5 text-sm bg-stone-900 text-white px-3 py-1.5 rounded-lg hover:bg-stone-700">
              <Plus size={14} /> Adicionar pergunta
            </button>
          </div>

          {data.questions.length === 0 ? (
            <div className="text-center py-16 text-stone-400 border-2 border-dashed rounded-xl">
              <List size={40} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma pergunta ainda.</p>
              <button onClick={addQuestion} className="mt-3 text-sm text-emerald-600 hover:underline">Adicionar a primeira</button>
            </div>
          ) : (
            data.questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={i}
                onChange={upd => updateQuestion(i, upd)}
                onRemove={() => removeQuestion(i)}
                onMove={dir => moveQuestion(i, dir)}
              />
            ))
          )}
        </div>
      )}

      {/* Tab: Results */}
      {editorTab === 'results' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-stone-500">{data.results.length} faixa{data.results.length !== 1 ? 's' : ''} de resultado</p>
            <button onClick={addResult} className="flex items-center gap-1.5 text-sm bg-stone-900 text-white px-3 py-1.5 rounded-lg hover:bg-stone-700">
              <Plus size={14} /> Adicionar resultado
            </button>
          </div>

          {data.results.length === 0 ? (
            <div className="text-center py-16 text-stone-400 border-2 border-dashed rounded-xl">
              <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma faixa de resultado definida.</p>
              <button onClick={addResult} className="mt-3 text-sm text-emerald-600 hover:underline">Adicionar a primeira</button>
            </div>
          ) : (
            data.results.map((r, i) => (
              <ResultEditor
                key={r.id}
                result={r}
                onChange={upd => updateResult(i, upd)}
                onRemove={() => removeResult(i)}
              />
            ))
          )}
        </div>
      )}

      {/* Tab: Preview */}
      {editorTab === 'preview' && (
        <div className="text-center py-12">
          <Eye size={48} className="mx-auto mb-4 text-stone-300" />
          <p className="text-stone-500 mb-4">Clique para visualizar o questionário como o usuário verá.</p>
          <button
            onClick={() => setShowPreview(true)}
            className="bg-stone-900 text-white px-6 py-2.5 rounded-lg hover:bg-stone-700"
          >
            Abrir preview interativo
          </button>
        </div>
      )}

      {/* Bottom save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-3 flex justify-end gap-3">
        <button onClick={() => setView('list')} className="px-4 py-2 border rounded-lg text-sm text-stone-600 hover:bg-stone-50">
          Cancelar
        </button>
        <button onClick={() => save('draft')} disabled={saving} className="px-4 py-2 border rounded-lg text-sm text-stone-600 hover:bg-stone-50">
          <Save size={14} className="inline mr-1" />{saving ? 'Salvando...' : 'Salvar rascunho'}
        </button>
        <button onClick={() => save('published')} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
          <Send size={14} className="inline mr-1" />Publicar
        </button>
      </div>
    </div>
  )
}
