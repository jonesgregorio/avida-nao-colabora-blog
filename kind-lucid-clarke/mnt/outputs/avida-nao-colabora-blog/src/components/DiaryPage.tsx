import { useState, useEffect, useCallback, useRef } from 'react'
import { exportElementToPdf } from '../lib/exportPdf'
import { supabase } from '../lib/supabase'
import { DiaryEntry, Plan } from '../types'
import { ChevronDown, ChevronUp, RefreshCw, Lightbulb, FileDown, Save, Sprout, CalendarDays, CheckCircle2, Plus, Home } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { emailDiaryLimitWarningForUser, emailDiaryLimitReachedForUser } from '../lib/emailTriggers'
import { fetchDiaryConfig, defaultDiaryConfig, type DiaryPlanConfig } from '../lib/diaryConfig'
import { hasPlanAccess } from '../lib/officialPlans'
import { MoodChip } from './user/ui'
import { MOODS } from './user/moods'

// Rótulos neutros (substantivos) — sem marcação de gênero.
// Taxonomia oficial (slugs neutros = value), alinhada aos chips de moods.ts.
// `score` é 1–5 (escala única do app; Mapa/constraint usam 1–5). `label` fica salvo em `mood`.
const moodOptions = [
  { value: 'bem_estar',     emoji: '😊',   label: 'Bem-estar',     score: 5 },
  { value: 'tranquilidade', emoji: '😌',   label: 'Tranquilidade', score: 5 },
  { value: 'cansaco',       emoji: '😪',   label: 'Cansaço',       score: 2 },
  { value: 'sem_energia',   emoji: '🪫',   label: 'Sem energia',   score: 2 },
  { value: 'ansiedade',     emoji: '😰',   label: 'Ansiedade',     score: 2 },
  { value: 'sobrecarga',    emoji: '😩',   label: 'Sobrecarga',    score: 1 },
  { value: 'tristeza',      emoji: '😔',   label: 'Tristeza',      score: 1 },
  { value: 'irritacao',     emoji: '😤',   label: 'Irritação',     score: 2 },
  { value: 'desanimo',      emoji: '😞',   label: 'Desânimo',      score: 1 },
  { value: 'confusao',      emoji: '😵‍💫', label: 'Confusão',      score: 2 },
  { value: 'outro',         emoji: '😐',   label: 'Outro',         score: 3 },
]

// Escala oficial do app: SEMPRE inteiro de 1 a 5 (§7). Normaliza qualquer valor
// (slider, string, null, fora de faixa) antes de mandar ao banco — impede que
// chegue algo que viole a constraint diary_entries_energy_check.
const normalizeScale = (value: unknown, fallback = 3): number => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(5, Math.max(1, Math.round(n)))
}

// Chip do check-in → valor de humor salvo. Com slugs unificados é praticamente
// identidade; mantém aliases LEGADOS (com gênero / antigos) por compatibilidade
// de URLs e dados anteriores.
const CHIP_TO_MOOD: Record<string, string> = {
  bem_estar: 'bem_estar', tranquilidade: 'tranquilidade', cansaco: 'cansaco', sem_energia: 'sem_energia',
  ansiedade: 'ansiedade', sobrecarga: 'sobrecarga', tristeza: 'tristeza', irritacao: 'irritacao',
  desanimo: 'desanimo', confusao: 'confusao', outro: 'outro',
  // compat legado (com gênero / slugs antigos) → slug neutro atual
  bem: 'bem_estar', 'bem-estar': 'bem_estar', tranquila: 'tranquilidade', tranquilo: 'tranquilidade',
  ansiosa: 'ansiedade', ansioso: 'ansiedade', cansada: 'cansaco', cansado: 'cansaco',
  sobrecarregada: 'sobrecarga', sobrecarregado: 'sobrecarga', triste: 'tristeza',
  irritada: 'irritacao', irritado: 'irritacao', neutro: 'outro', neutra: 'outro',
}

const emotionalTags = [
  'ansiedade', 'tristeza', 'alegria', 'irritação', 'medo',
  'esperança', 'cansaço', 'energia', 'calma', 'confusão',
]

// Prompts por plano (brief §8.7). Cada plano vê o conjunto adequado ao seu momento.
const PROMPTS_BY_PLAN: Record<'free' | 'essential' | 'plus', string[]> = {
  free: [
    'Como você está hoje?',
    'O que mais pesou?',
    'O que ajudou um pouco?',
  ],
  essential: [
    'O que se repetiu nas suas emoções esta semana?',
    'Que padrão você percebe entre sono, energia e humor?',
    'Qual situação gerou mais sobrecarga?',
    'O que você pode tentar diferente amanhã?',
  ],
  plus: [
    'O que você quer priorizar no seu cuidado este mês?',
    'Qual padrão emocional apareceu com mais frequência?',
    'Que tipo de apoio você gostaria de receber na orientação por mensagem?',
    'Qual pequeno compromisso de autocuidado parece possível agora?',
  ],
}

interface DiaryPageProps {
  user: User | null
  plan: Plan
  onBack: () => void
  onNavigatePricing?: () => void
  /** Humor pré-selecionado ao chegar de um check-in (home/dashboard). */
  initialMood?: string | null
  promptContext?: {
    prompt: string
    articleTitle: string
    articleSlug: string
    category: string
  } | null
  onClearPromptContext?: () => void
}

function SliderField({ label, value, onChange, min = 1, max = 5 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const pct = ((value - min) / (max - min)) * 100
  const emoji = pct < 30 ? '😟' : pct < 60 ? '😐' : '😊'
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-ink-soft font-medium">{label}</label>
        <span className="text-xs text-forest-500">{emoji} {value}/{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={`${value} de ${max}`}
        className="w-full accent-forest-600"
      />
    </div>
  )
}

// Sequência de dias consecutivos de escrita, terminando hoje ou ontem.
function calcStreak(days: Set<string>): number {
  const d = new Date()
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1)
  let s = 0
  while (days.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1) }
  return s
}

export default function DiaryPage({ user, plan, onBack, onNavigatePricing, initialMood, promptContext, onClearPromptContext }: DiaryPageProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'diary' | 'questionnaire'>('all')
  // Dois modos (brief §8.1/§8.2): check-in rápido (curto) e diário completo (detalhado).
  const [entryMode, setEntryMode] = useState<'quick' | 'full'>('quick')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  // Recap para a tela de confirmação exibida após salvar um registro.
  const [savedConfirm, setSavedConfirm] = useState<null | { kind: 'checkin' | 'diary'; mood: string; emoji: string; energy: number; anxiety: number }>(null)
  const entriesRef = useRef<HTMLElement>(null)

  // Free fields
  const [mood, setMood] = useState('outro')
  const [checkinChip, setCheckinChip] = useState<string | null>(null)
  const [mainEmotion, setMainEmotion] = useState('')
  const [whatHappened, setWhatHappened] = useState('')
  const [whatINeed, setWhatINeed] = useState('')
  const [smallThing, setSmallThing] = useState('')

  // Essencial+ fields — escala 1–5, default 3 (meio)
  const [moodScore, setMoodScore] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [anxietyLevel, setAnxietyLevel] = useState(3)
  const [stressLevel, setStressLevel] = useState(3)
  const [gratitude, setGratitude] = useState('')
  const [smallPride, setSmallPride] = useState('')
  const [freeNote, setFreeNote] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Therapeutic+ fields — escala 1–5, default 3 (meio)
  const [sleepQuality, setSleepQuality] = useState(3)
  const [selfEsteem, setSelfEsteem] = useState(3)
  const [irritability, setIrritability] = useState(3)
  const [overload, setOverload] = useState(3)
  const [emotionalTriggers, setEmotionalTriggers] = useState('')
  const [recurringThoughts, setRecurringThoughts] = useState('')
  const [emotionalNeed, setEmotionalNeed] = useState('')
  const [relationships, setRelationships] = useState('')
  const [habits, setHabits] = useState('')

  const isEssential = hasPlanAccess(plan, 'essential')
  const isPlus = hasPlanAccess(plan, 'plus')
  const planKey: 'free' | 'essential' | 'plus' = isPlus ? 'plus' : isEssential ? 'essential' : 'free'
  const planPrompts = PROMPTS_BY_PLAN[planKey]

  // Configuração do diário por plano (admin → "Diário por Plano"). Fallback = padrão do plano.
  const [cfg, setCfg] = useState<DiaryPlanConfig>(() => defaultDiaryConfig(plan))
  useEffect(() => { fetchDiaryConfig(plan).then(setCfg) }, [plan])
  const fieldOn = (key: string) => cfg.fields[key] !== false
  const canExportPDF = cfg.exportPDF

  // Limite conta APENAS entradas reais de diário (brief §8.3): não contam
  // check-ins técnicos, respostas de questionário nem eventos automáticos.
  const currentMonthEntries = entries.filter(e => {
    if (e.entry_type !== 'diary') return false
    const d = new Date(e.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const entryLimit = cfg.entriesPerMonth // null = ilimitado
  const freeEntryCount = currentMonthEntries.length
  const atLimit = entryLimit != null && freeEntryCount >= entryLimit
  // O limite bloqueia SÓ o diário completo. Check-in rápido é ilimitado (§8):
  // não conta e nunca é bloqueado, mesmo com os 5 registros do mês já usados.
  const saveBlockedByLimit = atLimit && entryMode !== 'quick'

  const writeDays = new Set(entries.filter(e => e.entry_type === 'diary').map(e => String(e.date ?? '').slice(0, 10)))
  const streak = calcStreak(writeDays)

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }, [user])

  const fetchPrompt = useCallback(async () => {
    const day = new Date().getDay()
    const planFilter = isPlus
      ? ['free', 'essential', 'plus', 'therapeutic', 'therapeutic-plus']
      : isEssential
      ? ['free', 'essential']
      : ['free']
    const { data } = await supabase
      .from('guided_prompts')
      .select('text')
      .in('plan_level', planFilter)
      .or(`day_of_week.eq.${day},day_of_week.is.null`)
      .limit(20)
    // Combina perguntas do banco com as configuradas pelo admin (Diário por Plano).
    const pool = [...((data ?? []).map((d: { text: string }) => d.text)), ...cfg.guidedQuestions]
    if (pool.length > 0) {
      setPrompt(pool[Math.floor(Math.random() * pool.length)])
    }
  }, [isEssential, isPlus, cfg.guidedQuestions])

  useEffect(() => {
    fetchEntries()
    fetchPrompt()
  }, [fetchEntries, fetchPrompt])

  // When arriving from article with a prompt context, pre-fill
  useEffect(() => {
    if (promptContext && !atLimit) {
      setWhatHappened(promptContext.prompt)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptContext])

  // Chegando de um check-in (home/dashboard), pré-seleciona o humor escolhido (brief §8.6).
  useEffect(() => {
    if (initialMood && CHIP_TO_MOOD[initialMood]) {
      setCheckinChip(initialMood)
      setMood(CHIP_TO_MOOD[initialMood])
    }
  }, [initialMood])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const selectChip = (chipKey: string) => {
    setCheckinChip(chipKey)
    setMood(CHIP_TO_MOOD[chipKey] ?? 'outro')
  }

  const applyPrompt = (p: string) => {
    setWhatHappened(prev => prev.trim() ? prev : p + '\n\n')
  }

  const resetForm = () => {
    setMood('outro'); setCheckinChip(null); setMainEmotion(''); setWhatHappened(''); setWhatINeed(''); setSmallThing('')
    setMoodScore(3); setEnergy(3); setAnxietyLevel(3); setStressLevel(3)
    setGratitude(''); setSmallPride(''); setFreeNote(''); setSelectedTags([])
    setSleepQuality(3); setSelfEsteem(3); setIrritability(3); setOverload(3)
    setEmotionalTriggers(''); setRecurringThoughts(''); setEmotionalNeed(''); setRelationships(''); setHabits('')
    setError('')
  }

  const handleSave = async () => {
    if (entryMode === 'quick') {
      // Check-in (spec §6): basta o estado emocional (chip). Energia e ansiedade
      // percebida têm valor sempre (sliders); a nota é OPCIONAL — nunca exige texto.
      if (!checkinChip) {
        setError('Escolha um estado emocional para registrar o check-in.')
        return
      }
    } else if (!whatHappened.trim() && !mainEmotion.trim() && !freeNote.trim()) {
      setError('Escreva algo antes de salvar.')
      return
    }
    if (saveBlockedByLimit) {
      setError('Você atingiu o limite de entradas deste mês no seu plano.')
      return
    }
    setSaving(true)
    setError('')

    const isCheckin = entryMode === 'quick'
    const moodObj = moodOptions.find(m => m.value === mood) || moodOptions.find(m => m.value === 'outro') || moodOptions[0]
    const entryText = [mainEmotion, whatHappened, whatINeed, smallThing, freeNote].filter(Boolean).join('\n\n')

    const payload: Partial<DiaryEntry> & { user_id: string } = {
      user_id: user!.id,
      date: new Date().toISOString().split('T')[0],
      mood: moodObj.label,
      // Escala oficial 1–5 (§7). normalizeScale garante inteiro válido no banco.
      mood_score: normalizeScale(isEssential ? moodScore : moodObj.score, 3),
      text: entryText,
      // Check-in rápido NÃO conta como diário (§8): salva como 'checkin'.
      entry_type: isCheckin ? 'checkin' : 'diary',
    }

    // Check-in rápido (§8.1): energia + ansiedade percebida, para todos os planos.
    if (isCheckin) {
      payload.energy = normalizeScale(energy, 3)
      payload.anxiety_level = normalizeScale(anxietyLevel, 3)
    } else if (isEssential) {
      if (fieldOn('energy')) payload.energy = normalizeScale(energy, 3)
      if (fieldOn('anxiety_level')) payload.anxiety_level = normalizeScale(anxietyLevel, 3)
      if (fieldOn('stress_level')) payload.stress_level = normalizeScale(stressLevel, 3)
      if (fieldOn('sleep_quality')) payload.sleep_quality = normalizeScale(sleepQuality, 3)
      if (fieldOn('self_esteem')) payload.self_esteem = normalizeScale(selfEsteem, 3)
      if (fieldOn('gratitude')) payload.gratitude = gratitude || undefined
      if (fieldOn('small_pride')) payload.small_pride = smallPride || undefined
      if (fieldOn('free_note')) payload.free_note = freeNote || undefined
      if (fieldOn('emotional_tags')) payload.emotional_tags = selectedTags.length > 0 ? selectedTags : undefined
    }

    if (!isCheckin && isPlus) {
      if (fieldOn('irritability')) payload.irritability = normalizeScale(irritability, 3)
      if (fieldOn('overload')) payload.overload = normalizeScale(overload, 3)
      if (fieldOn('emotional_triggers')) payload.emotional_triggers = emotionalTriggers || undefined
      if (fieldOn('recurring_thoughts')) payload.recurring_thoughts = recurringThoughts || undefined
      if (fieldOn('emotional_need')) payload.emotional_need = emotionalNeed || undefined
      if (fieldOn('relationships')) payload.relationships = relationships || undefined
      if (fieldOn('habits')) payload.habits = habits || undefined
    }

    const { data, error: err } = await supabase.from('diary_entries').insert(payload).select().single()
    if (err) {
      // O detalhe técnico (constraint, SQL, tabela) fica só no console para debug (§17).
      console.error('[diary save] falhou', err, 'payload:', payload)
      const raw = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase()
      // Mensagem amigável — nunca expõe SQL/constraint/tabela ao usuário.
      const friendly = raw.includes('energy') || raw.includes('anxiety') || raw.includes('mood')
        ? 'Escolha um nível válido de energia e ansiedade antes de salvar.'
        : raw.includes('limit') || raw.includes('limite')
          ? 'Você atingiu o limite de registros de diário deste mês. Seus check-ins continuam liberados.'
          : 'Não foi possível salvar sua entrada agora. Revise os campos e tente novamente.'
      setError(friendly)
      setSaving(false)
      return
    }
    if (data) {
      setEntries(prev => [data, ...prev])
      // Aviso de limite do diário — apenas plano Gratuito, 1x/mês por status
      if (plan === 'free' && entryLimit != null) {
        const monthKey = new Date().toISOString().slice(0, 7)
        const count = [data, ...entries].filter(e => String(e.date ?? '').startsWith(monthKey) && e.entry_type === 'diary').length
        if (count === entryLimit - 1) void emailDiaryLimitWarningForUser(user!.id, monthKey)
        else if (count >= entryLimit) void emailDiaryLimitReachedForUser(user!.id, monthKey)
      }
      // Guarda o recap e dispara a tela de confirmação explícita.
      setSavedConfirm({ kind: isCheckin ? 'checkin' : 'diary', mood: moodObj.label, emoji: moodObj.emoji, energy, anxiety: anxietyLevel })
    }
    resetForm()
    setSaving(false)
    if (onClearPromptContext) onClearPromptContext()
  }

  const filteredEntries = entries.filter(e =>
    filter === 'all' ? true : filter === 'diary' ? e.entry_type === 'diary' : e.entry_type === 'questionnaire'
  )

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const formatShort = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  async function handleExportSummary() {
    if (!entriesRef.current || exporting) return
    setExporting(true)
    try {
      await exportElementToPdf(entriesRef.current, `diario-${new Date().toISOString().slice(0, 7)}.pdf`)
    } catch {
      // silencioso — o usuário pode tentar novamente
    } finally {
      setExporting(false)
    }
  }

  // ─── Tela de confirmação explícita após salvar (check-in ou diário) ───
  if (savedConfirm) {
    const isCheckinConfirm = savedConfirm.kind === 'checkin'
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-mint flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-forest-600" />
        </div>
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900">
          {isCheckinConfirm ? 'Check-in registrado 💚' : 'Registro salvo 💚'}
        </h1>
        <p className="mt-3 text-ink-soft leading-relaxed">
          {isCheckinConfirm
            ? 'Seu check-in foi salvo com segurança. Obrigado por reservar esse momento para você.'
            : 'Seu registro foi salvo no diário. Obrigado por cuidar de você hoje.'}
        </p>

        {/* Recap do que foi registrado */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-paper-soft border border-line rounded-full px-3.5 py-1.5 text-sm text-forest-900">
            <span aria-hidden>{savedConfirm.emoji}</span> {savedConfirm.mood}
          </span>
          {isCheckinConfirm && (
            <>
              <span className="bg-paper-soft border border-line rounded-full px-3.5 py-1.5 text-sm text-ink">
                Energia <strong className="text-forest-800">{savedConfirm.energy}/5</strong>
              </span>
              <span className="bg-paper-soft border border-line rounded-full px-3.5 py-1.5 text-sm text-ink">
                Ansiedade <strong className="text-forest-800">{savedConfirm.anxiety}/5</strong>
              </span>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <button
            onClick={() => { setSavedConfirm(null); setEntryMode('quick') }}
            className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors"
          >
            <Plus className="w-4 h-4" /> {isCheckinConfirm ? 'Fazer outro check-in' : 'Novo registro'}
          </button>
          <button
            onClick={() => { setSavedConfirm(null); setTimeout(() => entriesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60) }}
            className="inline-flex items-center gap-2 border border-line text-forest-900 text-sm font-medium px-5 py-2.5 rounded-2xl hover:bg-mint/40 transition-colors"
          >
            Ver meus registros
          </button>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-ink-soft hover:text-forest-900 text-sm font-medium px-4 py-2.5 transition-colors"
          >
            <Home className="w-4 h-4" /> Início
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">
          Diário emocional <Sprout className="w-6 h-6 text-forest-400" />
        </h1>
        <p className="mt-2 text-ink-soft">Escreva, acolha e organize o que sente. Aqui é o seu espaço seguro.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 lg:gap-6">
        {/* ─── Coluna principal ─── */}
        <div className="space-y-5 min-w-0">
          {/* Intro */}
          <div className="grid sm:grid-cols-[1.4fr_1fr] bg-paper-soft border border-line rounded-3xl overflow-hidden">
            <div className="p-6 flex flex-col justify-center">
              <p className="text-xs text-ink-soft flex items-center gap-1.5 capitalize"><CalendarDays className="w-3.5 h-3.5" /> {today}</p>
              <h2 className="font-serif text-xl sm:text-2xl text-forest-900 mt-2">Que bom ter você aqui.</h2>
              <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">
                Registrar o que sente é um ato de cuidado que traz clareza, alívio e leveza para o seu dia.
              </p>
              <p className="text-xs text-forest-600 mt-3 flex items-center gap-1.5"><Sprout className="w-3.5 h-3.5" /> Respire fundo e escreva no seu tempo.</p>
            </div>
            <div className="hidden sm:block bg-mint min-h-[160px]">
              <img
                src="https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&q=80"
                alt=""
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          </div>

          {/* Área de escrita */}
          <section className="bg-paper-soft border border-line rounded-3xl p-5 sm:p-6">
            {/* Contexto vindo de um artigo */}
            {promptContext && (
              <div className="bg-mint/60 border border-forest-100 rounded-2xl p-4 mb-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-forest-600 mb-1">Pergunta do conteúdo <span className="italic">"{promptContext.articleTitle}"</span></p>
                    <p className="text-forest-900 font-medium">"{promptContext.prompt}"</p>
                  </div>
                  {onClearPromptContext && (
                    <button onClick={onClearPromptContext} className="text-ink-soft hover:text-forest-700 text-xs flex-shrink-0" title="Limpar">✕</button>
                  )}
                </div>
              </div>
            )}

            {/* Modo de registro — check-in rápido × diário completo (§8.1/§8.2) */}
            <div className="inline-flex rounded-full border border-line bg-white p-1 mb-5">
              <button
                onClick={() => setEntryMode('quick')}
                aria-pressed={entryMode === 'quick'}
                className={`text-sm px-4 py-1.5 rounded-full transition-colors ${entryMode === 'quick' ? 'bg-forest-900 text-white' : 'text-ink-soft hover:text-forest-900'}`}
              >
                Check-in rápido
              </button>
              <button
                onClick={() => setEntryMode('full')}
                aria-pressed={entryMode === 'full'}
                className={`text-sm px-4 py-1.5 rounded-full transition-colors ${entryMode === 'full' ? 'bg-forest-900 text-white' : 'text-ink-soft hover:text-forest-900'}`}
              >
                Diário completo
              </button>
            </div>

            {/* Check-in emocional */}
            <h2 className="font-serif text-lg sm:text-xl text-forest-900">Check-in emocional</h2>
            <p className="text-sm text-ink-soft mt-1 mb-3">
              {entryMode === 'quick'
                ? 'Registre como você está agora. Você pode fazer quantos check-ins quiser ao longo do dia.'
                : 'Como você está se sentindo agora? Escolha o que mais faz sentido para você.'}
            </p>
            {entryMode === 'quick' && plan === 'free' && (
              <p className="text-xs text-forest-600 mb-3 flex items-center gap-1.5">
                <Sprout className="w-3.5 h-3.5 flex-shrink-0" /> Check-ins são ilimitados e não consomem seus registros mensais de diário.
              </p>
            )}
            <div className="flex flex-wrap gap-2 mb-6">
              {MOODS.map(m => (
                <MoodChip key={m.key} mood={m} active={checkinChip === m.key} onClick={() => selectChip(m.key)} />
              ))}
            </div>

            {/* Check-in rápido: energia + ansiedade percebida (§8.1) — nota opcional abaixo */}
            {entryMode === 'quick' && (
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <SliderField label="Energia" value={energy} onChange={setEnergy} />
                <SliderField label="Ansiedade percebida" value={anxietyLevel} onChange={setAnxietyLevel} />
              </div>
            )}

            {/* Prompts */}
            <h3 className="font-serif text-base text-forest-900">O que você gostaria de registrar hoje?</h3>
            <p className="text-sm text-ink-soft mt-1 mb-3">Use as sugestões ou escreva livremente.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {planPrompts.map(p => (
                <button
                  key={p}
                  onClick={() => applyPrompt(p)}
                  className="text-sm px-3 py-1.5 rounded-full border border-line bg-white text-ink-soft hover:border-forest-300 hover:text-forest-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Reflexão sugerida do dia */}
            {prompt && (
              <div className="bg-mint/40 border border-line rounded-2xl p-3 mb-4 flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-forest-500 mt-0.5 flex-shrink-0" />
                <p className="flex-1 text-sm text-forest-800 italic">"{prompt}"</p>
                <button onClick={fetchPrompt} className="text-ink-soft hover:text-forest-700 text-xs" title="Outra sugestão">↻</button>
              </div>
            )}

            {/* Textarea principal */}
            <div className="relative">
              <textarea
                value={whatHappened}
                onChange={e => setWhatHappened(e.target.value)}
                placeholder="Escreva aqui o que está sentindo…"
                rows={6}
                disabled={saveBlockedByLimit}
                className="w-full border border-line rounded-2xl px-4 py-3 text-sm resize-none bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 focus:border-forest-300 disabled:opacity-60"
              />
              <span className="absolute bottom-3 right-4 text-[11px] text-ink-soft/70">{whatHappened.length} caracteres</span>
            </div>

            {/* Campos livres complementares — só no diário completo (§8.2) */}
            {entryMode === 'full' && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <input type="text" value={mainEmotion} onChange={e => setMainEmotion(e.target.value)} placeholder="Qual emoção marcou seu dia?" className="border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />
                <input type="text" value={whatINeed} onChange={e => setWhatINeed(e.target.value)} placeholder="O que você precisa agora?" className="border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />
                <input type="text" value={smallThing} onChange={e => setSmallThing(e.target.value)} placeholder="Uma coisa pequena que consegui fazer hoje…" className="sm:col-span-2 border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />
              </div>
            )}

            {/* Indicadores — Essencial+ (só no diário completo) */}
            {entryMode === 'full' && isEssential && (
              <div className="border-t border-line pt-5 mt-5">
                <h3 className="font-serif text-base text-forest-900 mb-1">Como está o seu corpo e sua mente agora?</h3>
                <p className="text-sm text-ink-soft mb-4">Atualize seus indicadores do momento.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SliderField label="Humor" value={moodScore} onChange={setMoodScore} />
                  {fieldOn('energy') && <SliderField label="Energia" value={energy} onChange={setEnergy} />}
                  {fieldOn('anxiety_level') && <SliderField label="Ansiedade" value={anxietyLevel} onChange={setAnxietyLevel} />}
                  {fieldOn('stress_level') && <SliderField label="Estresse" value={stressLevel} onChange={setStressLevel} />}
                  {/* Sono e Autoestima também no Essencial: o Mapa Emocional mostra essas métricas (§ mapa completo). */}
                  {fieldOn('sleep_quality') && <SliderField label="Sono" value={sleepQuality} onChange={setSleepQuality} />}
                  {fieldOn('self_esteem') && <SliderField label="Autoestima" value={selfEsteem} onChange={setSelfEsteem} />}
                  {isPlus && fieldOn('irritability') && <SliderField label="Irritabilidade" value={irritability} onChange={setIrritability} />}
                  {isPlus && fieldOn('overload') && <SliderField label="Sobrecarga" value={overload} onChange={setOverload} />}
                </div>

                {fieldOn('emotional_tags') && (
                  <div className="mt-4">
                    <label className="text-xs text-ink-soft font-medium block mb-2">Marque o que aparecer</label>
                    <div className="flex flex-wrap gap-2">
                      {emotionalTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selectedTags.includes(tag) ? 'bg-forest-900 text-white border-forest-900' : 'border-line text-ink-soft hover:border-forest-300 bg-white'}`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  {fieldOn('gratitude') && <input type="text" value={gratitude} onChange={e => setGratitude(e.target.value)} placeholder="Pelo que você sente gratidão hoje?" className="border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />}
                  {fieldOn('small_pride') && <input type="text" value={smallPride} onChange={e => setSmallPride(e.target.value)} placeholder="Um pequeno orgulho do dia…" className="border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />}
                </div>
                {isPlus && (
                  <div className="grid gap-3 mt-3">
                    {fieldOn('emotional_triggers') && <input type="text" value={emotionalTriggers} onChange={e => setEmotionalTriggers(e.target.value)} placeholder="Gatilhos emocionais de hoje…" className="border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />}
                    {fieldOn('recurring_thoughts') && <input type="text" value={recurringThoughts} onChange={e => setRecurringThoughts(e.target.value)} placeholder="Pensamentos recorrentes…" className="border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />}
                    {fieldOn('emotional_need') && <input type="text" value={emotionalNeed} onChange={e => setEmotionalNeed(e.target.value)} placeholder="Necessidade emocional principal…" className="border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />}
                    {fieldOn('relationships') && <input type="text" value={relationships} onChange={e => setRelationships(e.target.value)} placeholder="Relações e limites hoje…" className="border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />}
                    {fieldOn('habits') && <input type="text" value={habits} onChange={e => setHabits(e.target.value)} placeholder="Hábitos do dia…" className="border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-coral text-sm mt-4">{error}</p>}
            {saveBlockedByLimit && (
              <div className="text-sm text-ink-soft mt-4 bg-mint/40 border border-line rounded-2xl p-3.5 leading-relaxed">
                Você usou seus <strong>{entryLimit} registros de diário</strong> deste mês. Seus <strong>check-ins continuam liberados</strong> — é só trocar para "Check-in rápido" acima.
                {plan === 'free' && onNavigatePricing && (
                  <div className="mt-2">
                    Para diário ilimitado, <button onClick={onNavigatePricing} className="text-forest-700 underline font-medium">conheça o Essencial</button>.
                  </div>
                )}
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-wrap gap-3 mt-5">
              <button
                onClick={handleSave}
                disabled={saving || saveBlockedByLimit}
                className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar entrada'}
              </button>
              {canExportPDF && (
                <button
                  onClick={handleExportSummary}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 border border-line text-forest-700 text-sm font-medium px-5 py-2.5 rounded-2xl hover:bg-mint/50 transition-colors disabled:opacity-60"
                >
                  <FileDown className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} /> {exporting ? 'Gerando…' : 'Exportar resumo'}
                </button>
              )}
            </div>
          </section>

          {/* Lista de entradas */}
          <section ref={entriesRef} className="bg-paper-soft border border-line rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-serif text-lg sm:text-xl text-forest-900">Suas entradas</h2>
              <div className="flex items-center gap-2">
                {(['all', 'diary', 'questionnaire'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === f ? 'bg-forest-900 text-white border-forest-900' : 'border-line text-ink-soft hover:border-forest-300 bg-white'}`}
                  >
                    {f === 'all' ? 'Tudo' : f === 'diary' ? 'Diário' : 'Avaliações'}
                  </button>
                ))}
                <button onClick={fetchEntries} className="p-1.5 text-ink-soft hover:text-forest-700" title="Atualizar"><RefreshCw className="w-4 h-4" /></button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-mint/40 animate-pulse rounded-2xl" />)}</div>
            ) : filteredEntries.length === 0 ? (
              <p className="text-center py-10 text-ink-soft text-sm">Nenhum registro ainda. Comece escrevendo acima. 🌿</p>
            ) : (
              <div className="space-y-2">
                {filteredEntries.map(entry => {
                  const moodObj = moodOptions.find(m => m.label === entry.mood || m.value === entry.mood)
                  const isOpen = expanded === entry.id
                  return (
                    <div key={entry.id} className="bg-white border border-line rounded-2xl overflow-hidden">
                      <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-mint/30 transition-colors" onClick={() => setExpanded(isOpen ? null : entry.id)}>
                        <span className="text-xl">{moodObj?.emoji || '📝'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-forest-700">{entry.mood}</span>
                            {entry.entry_type === 'questionnaire' && <span className="text-[10px] bg-mint text-forest-700 px-2 py-0.5 rounded-full">Avaliação</span>}
                          </div>
                          <p className="text-xs text-ink-soft mt-0.5 capitalize">{formatDate(entry.date ?? '')}</p>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-ink-soft flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-ink-soft flex-shrink-0" />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 border-t border-line">
                          <p className="text-sm text-ink leading-relaxed whitespace-pre-line mt-3">{entry.text}</p>
                          {entry.emotional_tags && entry.emotional_tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {entry.emotional_tags.map(tag => <span key={tag} className="text-xs bg-mint text-forest-700 px-2 py-0.5 rounded-full">{tag}</span>)}
                            </div>
                          )}
                          {entry.gratitude && <p className="text-xs text-ink-soft mt-2">🙏 Gratidão: {entry.gratitude}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* ─── Coluna lateral ─── */}
        <aside className="space-y-5">
          {/* Registros recentes */}
          <div className="bg-paper-soft border border-line rounded-3xl p-5">
            <h2 className="font-serif text-lg text-forest-900 mb-3">Seus registros recentes</h2>
            {entries.length === 0 ? (
              <p className="text-sm text-ink-soft">Seus registros aparecerão aqui.</p>
            ) : (
              <ul className="space-y-2.5">
                {entries.slice(0, 5).map(e => {
                  const moodObj = moodOptions.find(m => m.label === e.mood || m.value === e.mood)
                  return (
                    <li key={e.id} className="flex items-center gap-2.5 text-sm">
                      <span>{moodObj?.emoji || '📝'}</span>
                      <span className="text-ink-soft capitalize flex-1 min-w-0 truncate">{formatShort(e.date ?? '')}</span>
                      <span className="text-xs text-forest-700">{e.mood}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Sua jornada */}
          <div className="bg-paper-soft border border-line rounded-3xl p-5">
            <h2 className="font-serif text-lg text-forest-900 flex items-center gap-2"><Sprout className="w-4 h-4 text-forest-500" /> Sua jornada</h2>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="font-serif text-3xl text-forest-900">{streak}</span>
              <span className="text-sm text-ink-soft">{streak === 1 ? 'dia de escrita' : 'dias de escrita seguidos'}</span>
            </div>
            <p className="mt-3 text-xs text-ink-soft bg-mint/50 rounded-xl px-3 py-2.5 leading-relaxed">
              {streak > 0 ? 'Manter o hábito transforma. Você está criando algo que faz bem para você. 🌿' : 'Um registro por dia já é um ato de cuidado. Comece hoje. 🌿'}
            </p>
          </div>

          {/* Acompanhamento Plus — o diário alimenta os recursos Plus (§8.5) */}
          {isPlus && (
            <div className="bg-forest-900 text-white rounded-3xl p-5">
              <h2 className="font-serif text-lg flex items-center gap-2"><Sprout className="w-4 h-4 text-forest-300" /> Usar no acompanhamento Plus</h2>
              <p className="text-sm text-forest-50/90 mt-2 leading-relaxed">
                Suas reflexões podem ajudar a compor seu relatório mensal, seu plano de autocuidado e sua orientação por mensagem.
              </p>
            </div>
          )}

          {/* Limite do plano */}
          {entryLimit != null && (
            <div className="bg-paper-soft border border-line rounded-3xl p-5">
              <h2 className="font-serif text-lg text-forest-900">Limite do plano gratuito</h2>
              <p className="text-sm text-ink-soft mt-1">Você utilizou <strong>{freeEntryCount} de {entryLimit}</strong> registros de <strong>diário</strong> este mês.</p>
              <div className="h-2 bg-mint rounded-full overflow-hidden mt-3">
                <div className={`h-full rounded-full transition-all ${atLimit ? 'bg-coral' : 'bg-forest-600'}`} style={{ width: `${Math.min((freeEntryCount / entryLimit) * 100, 100)}%` }} />
              </div>
              <p className="text-xs text-forest-600 mt-2.5 flex items-center gap-1.5">
                <Sprout className="w-3.5 h-3.5 flex-shrink-0" /> Os check-ins rápidos são ilimitados e não entram nessa conta.
              </p>
              {plan === 'free' && onNavigatePricing && (
                <button onClick={onNavigatePricing} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-forest-900 text-white text-sm font-medium px-4 py-2.5 rounded-2xl hover:bg-forest-800 transition-colors">
                  Ter registros ilimitados
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
