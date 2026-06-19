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
        <span className="flex-1 text-sm font-medium text-st