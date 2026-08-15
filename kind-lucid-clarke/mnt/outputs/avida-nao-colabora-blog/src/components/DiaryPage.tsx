import { useState, useEffect, useCallback, useRef } from 'react'
import { exportElementToPdf } from '../lib/exportPdf'
import { supabase } from '../lib/supabase'
import { DiaryEntry, Plan } from '../types'
import { ChevronDown, ChevronUp, RefreshCw, Lightbulb, FileDown, Save, Sprout, CalendarDays, CheckCircle2, Plus, Home } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { emailDiaryLimitWarningForUser, emailDiaryLimitReachedForUser } from '../lib/emailTriggers'
import { fetchDiaryConfig, defaultDiaryConfig, type DiaryPlanConfig } from '../lib/diaryConfig'
import { hasPlanAccess } from '../lib/officialPlans'
import { signalFromEntry, signalFromTags, topThemes, THEMES, type Signal } from '../lib/contentRecommendation'
import { ymd } from '../lib/reportPeriods'
import RecommendedContent from './RecommendedContent'
import DiaryTagChip from './DiaryTagChip'
import type { TagCategory } from '../lib/tagCategories'
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

// Baseado na Feelings Wheel (Gloria Willcox, 1982) — referência clássica em
// terapia para nomear emoções, organizada em 6 núcleos: triste, com raiva,
// com medo, alegre, forte e em paz. Cobrimos os 6 (não só os difíceis) para
// que qualquer marcação — inclusive as leves — gere sugestão de conteúdo.
const emotionalTags = [
  'ansiedade', 'medo', 'preocupação', 'insegurança',
  'tristeza', 'desânimo', 'solidão', 'culpa',
  'irritação', 'raiva', 'frustração', 'cansaço', 'sobrecarga', 'confusão',
  'calma', 'esperança', 'alegria', 'gratidão',
]

// Tags básicas do Gratuito (§2.1): subconjunto curado, não o catálogo completo acima.
const FREE_EMOTIONAL_TAGS = ['ansiedade', 'tristeza', 'cansaço', 'sobrecarga', 'calma', 'gratidão']

// Onde isso apareceu / o que precisa / o que ajuda — Essencial+ (§7/§8/§9).
const contextTagOptions = ['trabalho', 'família', 'relacionamento', 'amizades', 'dinheiro', 'saúde', 'corpo', 'casa', 'estudos', 'redes sociais', 'solidão', 'rotina', 'futuro', 'autoimagem', 'sono', 'alimentação', 'responsabilidades']
const needTagOptions = ['descanso', 'acolhimento', 'clareza', 'silêncio', 'conversa', 'limite', 'organização', 'ajuda', 'pausa', 'leveza', 'segurança', 'coragem', 'paciência', 'presença', 'menos cobrança']
const careActionTagOptions = ['tomar banho', 'beber água', 'respirar', 'ouvir música', 'caminhar', 'dormir mais cedo', 'conversar com alguém', 'organizar uma tarefa', 'ficar em silêncio', 'escrever mais', 'ver um conteúdo guiado', 'reduzir redes sociais', 'fazer uma pausa', 'comer algo leve', 'pedir ajuda']

interface EntryTag { tag: string; category?: TagCategory }
// Junta as 4 categorias de tag de um registro numa lista só, pra exibição no histórico.
function entryTags(e: { emotional_tags?: string[]; context_tags?: string[]; need_tags?: string[]; care_action_tags?: string[] }): EntryTag[] {
  return [
    ...(e.emotional_tags ?? []).map(tag => ({ tag })),
    ...(e.context_tags ?? []).map(tag => ({ tag, category: 'context' as TagCategory })),
    ...(e.need_tags ?? []).map(tag => ({ tag, category: 'need' as TagCategory })),
    ...(e.care_action_tags ?? []).map(tag => ({ tag, category: 'care_action' as TagCategory })),
  ]
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
  /** Abre um conteúdo guiado recomendado após salvar. */
  onOpenArticle?: (slug: string) => void
}

// §6: sliders opcionais não podem salvar um valor "3/5" que o usuário nunca
// escolheu de fato. `touched` diz se a pessoa já interagiu; enquanto não
// interage, mostra "Não informado" (o thumb fica visualmente no meio, mas
// isso é só a posição inicial — não é uma resposta real até `onChange` disparar).
function SliderField({ label, value, onChange, touched = true, onClear, min = 1, max = 5 }: {
  label: string; value: number; onChange: (v: number) => void
  touched?: boolean; onClear?: () => void; min?: number; max?: number
}) {
  const pct = ((value - min) / (max - min)) * 100
  const emoji = pct < 30 ? '😟' : pct < 60 ? '😐' : '😊'
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-ink-soft font-medium">{label}</label>
        <span className="text-xs text-forest-500 flex items-center gap-1.5">
          {touched ? <>{emoji} {value}/{max}</> : <span className="text-ink-soft/70">Não informado</span>}
          {touched && onClear && (
            <button type="button" onClick={onClear} className="text-[10px] text-ink-soft/60 hover:text-forest-700 underline underline-offset-2">Limpar</button>
          )}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={touched ? `${value} de ${max}` : 'não informado'}
        className={`w-full accent-forest-600 ${touched ? '' : 'opacity-50'}`}
      />
    </div>
  )
}

// Sequência de dias consecutivos de escrita, terminando hoje ou ontem.
// Usa data LOCAL (ymd) — toISOString() é UTC e, à noite no Brasil (UTC-3),
// já conta como o dia seguinte, quebrando a sequência incorretamente.
function calcStreak(days: Set<string>): number {
  const d = new Date()
  if (!days.has(ymd(d))) d.setDate(d.getDate() - 1)
  let s = 0
  while (days.has(ymd(d))) { s++; d.setDate(d.getDate() - 1) }
  return s
}

// §11.5: nunca buscar o histórico inteiro de uma vez — pesado pra quem tem
// centenas/milhares de registros. Paginação simples por range.
const ENTRIES_PAGE_SIZE = 30
const ENTRIES_SELECT = 'id,user_id,mood,date,entry_type,created_at,text,emotional_tags,gratitude,energy,anxiety_level,sleep_quality,mood_score,stress_level,self_esteem,small_pride,context_tags,need_tags,care_action_tags'

export default function DiaryPage({ user, plan, onBack, onNavigatePricing, initialMood, promptContext, onClearPromptContext, onOpenArticle }: DiaryPageProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreEntries, setHasMoreEntries] = useState(true)
  // Contagem do mês (só importa pro Gratuito) via COUNT dedicado — não pode
  // depender da lista paginada, que só tem os registros mais recentes.
  const [monthDiaryCount, setMonthDiaryCount] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'checkin' | 'diary' | 'questionnaire'>('all')
  // Dois modos (brief §8.1/§8.2): check-in rápido (curto) e diário completo (detalhado).
  const [entryMode, setEntryMode] = useState<'quick' | 'full'>('quick')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  // Recap para a tela de confirmação exibida após salvar um registro.
  const [savedConfirm, setSavedConfirm] = useState<null | { kind: 'checkin' | 'diary'; mood: string; emoji: string; energy: number | null; anxiety: number | null; signal: Signal }>(null)
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
  const [showOtherTag, setShowOtherTag] = useState(false)
  const [otherTagInput, setOtherTagInput] = useState('')
  // §5.1: "Qual emoção marcou seu dia?" é redundante com os chips de humor —
  // vira opcional/recolhido em vez de aparecer sempre aberto.
  const [showMainEmotion, setShowMainEmotion] = useState(false)
  const [contextTags, setContextTags] = useState<string[]>([])
  const [needTags, setNeedTags] = useState<string[]>([])
  const [careActionTags, setCareActionTags] = useState<string[]>([])

  // §6: sliders opcionais só contam como resposta real depois que o usuário
  // interage — evita salvar "3/5" (valor visual inicial) como se fosse dado.
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set())
  const touch = (key: string) => setTouchedFields(prev => prev.has(key) ? prev : new Set(prev).add(key))
  const untouch = (key: string) => setTouchedFields(prev => { if (!prev.has(key)) return prev; const n = new Set(prev); n.delete(key); return n })
  // Props prontos pra um SliderField opcional — evita repetir onChange/touched/onClear em cada um.
  const sliderProps = (key: string, val: number, setVal: (v: number) => void) => ({
    value: val,
    onChange: (v: number) => { setVal(v); touch(key) },
    touched: touchedFields.has(key),
    onClear: () => { setVal(3); untouch(key) },
  })

  // Plus advanced fields — escala 1–5, default 3 (meio)
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

  // Configuração do diário por plano (admin → "Diário por Plano"). Fallback = padrão do plano.
  const [cfg, setCfg] = useState<DiaryPlanConfig>(() => defaultDiaryConfig(plan))
  useEffect(() => { fetchDiaryConfig(plan).then(setCfg) }, [plan])
  const fieldOn = (key: string) => cfg.fields[key] !== false
  const canExportPDF = cfg.exportPDF

  // Limite conta APENAS entradas reais de diário (brief §8.3): não contam
  // check-ins técnicos, respostas de questionário nem eventos automáticos.
  // Vem de monthDiaryCount (COUNT dedicado) — a lista `entries` é paginada
  // e não pode ser usada pra contar o mês com segurança (§11.5).
  const entryLimit = cfg.entriesPerMonth // null = ilimitado
  const freeEntryCount = monthDiaryCount
  const atLimit = entryLimit != null && freeEntryCount >= entryLimit
  // O limite bloqueia SÓ o diário completo. Check-in rápido é ilimitado (§8):
  // não conta e nunca é bloqueado, mesmo com os 5 registros do mês já usados.
  const saveBlockedByLimit = atLimit && entryMode !== 'quick'

  const writeDays = new Set(entries.filter(e => e.entry_type === 'diary').map(e => String(e.date ?? '').slice(0, 10)))
  const streak = calcStreak(writeDays)

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from('diary_entries')
      .select(ENTRIES_SELECT)
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, ENTRIES_PAGE_SIZE - 1)
    setEntries(data || [])
    setHasMoreEntries((data?.length ?? 0) === ENTRIES_PAGE_SIZE)
    setLoading(false)
  }, [user])

  const loadMoreEntries = useCallback(async () => {
    setLoadingMore(true)
    const { data } = await supabase
      .from('diary_entries')
      .select(ENTRIES_SELECT)
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(entries.length, entries.length + ENTRIES_PAGE_SIZE - 1)
    setEntries(prev => [...prev, ...(data ?? [])])
    setHasMoreEntries((data?.length ?? 0) === ENTRIES_PAGE_SIZE)
    setLoadingMore(false)
  }, [user, entries.length])

  // Contagem do mês (Gratuito) — separada da lista paginada de propósito (§11.5/§8.3).
  const fetchMonthCount = useCallback(async () => {
    if (plan !== 'free') { setMonthDiaryCount(0); return }
    const monthStart = ymd(new Date()).slice(0, 7) + '-01'
    const { count } = await supabase.from('diary_entries').select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id).eq('entry_type', 'diary').gte('date', monthStart)
    setMonthDiaryCount(count ?? 0)
  }, [user, plan])

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
    fetchMonthCount()
  }, [fetchEntries, fetchPrompt, fetchMonthCount])

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

  // Toggle genérico para as 3 novas categorias de tag (contexto/necessidade/cuidado).
  const toggleInArray = (arr: string[], setArr: (v: string[]) => void, tag: string) => {
    setArr(arr.includes(tag) ? arr.filter(t => t !== tag) : [...arr, tag])
  }

  const addOtherTag = () => {
    const t = otherTagInput.trim().toLowerCase()
    if (t && !selectedTags.includes(t)) setSelectedTags(prev => [...prev, t])
    setOtherTagInput('')
    setShowOtherTag(false)
  }

  // Prévia local — mesmo motor que gera as sugestões após salvar (§ RecommendedContent),
  // mas calculada na hora, sem chamada ao servidor: mostra que a marcação já "faz
  // alguma coisa" no momento em que a pessoa toca no chip, não só depois de salvar.
  const tagPreviewThemes = selectedTags.length > 0
    ? topThemes(signalFromTags(selectedTags), 2).map(t => THEMES[t].label)
    : []

  const selectChip = (chipKey: string) => {
    setCheckinChip(chipKey)
    setMood(CHIP_TO_MOOD[chipKey] ?? 'outro')
  }

  const resetForm = () => {
    setMood('outro'); setCheckinChip(null); setMainEmotion(''); setWhatHappened(''); setWhatINeed(''); setSmallThing('')
    setMoodScore(3); setEnergy(3); setAnxietyLevel(3); setStressLevel(3)
    setGratitude(''); setSmallPride(''); setFreeNote(''); setSelectedTags([])
    setShowOtherTag(false); setOtherTagInput('')
    setSleepQuality(3); setSelfEsteem(3); setIrritability(3); setOverload(3)
    setEmotionalTriggers(''); setRecurringThoughts(''); setEmotionalNeed(''); setRelationships(''); setHabits('')
    setContextTags([]); setNeedTags([]); setCareActionTags([])
    setTouchedFields(new Set())
    setShowMainEmotion(false)
    setError('')
  }

  const handleSave = async () => {
    if (entryMode === 'quick') {
      // Check-in (spec §6): basta o estado emocional (chip). Energia e ansiedade
      // percebida têm valor sempre (sliders); a nota é OPCIONAL — nunca exige texto.
      if (!checkinChip) {
        setError('Escolha um estado emocional para registrar seu check-in.')
        return
      }
    } else if (!whatHappened.trim() && !mainEmotion.trim() && !freeNote.trim()) {
      setError('Escreva algo antes de salvar seu diário.')
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
      // Data LOCAL do usuário — toISOString() é UTC, então à noite no Brasil
      // (UTC-3) um registro feito "hoje" ficava salvo com a data de amanhã.
      date: ymd(new Date()),
      mood: moodObj.label,
      // Escala oficial 1–5 (§7). normalizeScale garante inteiro válido no banco.
      // Humor: se a pessoa mexeu no slider "Humor" (Essencial+), usa esse valor;
      // senão deriva da emoção marcada nos chips — nunca um 3/5 não escolhido (§6).
      mood_score: normalizeScale(isEssential && touchedFields.has('mood_score') ? moodScore : moodObj.score, 3),
      text: entryText,
      // Check-in rápido NÃO conta como diário (§8): salva como 'checkin'.
      entry_type: isCheckin ? 'checkin' : 'diary',
    }

    // Check-in rápido (§8.1/§6): energia e ansiedade são opcionais — só salvam
    // se a pessoa realmente tocou no slider, nunca o valor visual inicial.
    if (isCheckin) {
      if (touchedFields.has('energy')) payload.energy = normalizeScale(energy, 3)
      if (touchedFields.has('anxiety_level')) payload.anxiety_level = normalizeScale(anxietyLevel, 3)
    } else {
      // Tags emocionais: disponíveis também no Gratuito (versão básica curada) —
      // não são exclusivas do Essencial+, então salvam fora do bloco abaixo.
      if (fieldOn('emotional_tags')) payload.emotional_tags = selectedTags.length > 0 ? selectedTags : undefined
      if (isEssential) {
        if (fieldOn('energy') && touchedFields.has('energy')) payload.energy = normalizeScale(energy, 3)
        if (fieldOn('anxiety_level') && touchedFields.has('anxiety_level')) payload.anxiety_level = normalizeScale(anxietyLevel, 3)
        if (fieldOn('stress_level') && touchedFields.has('stress_level')) payload.stress_level = normalizeScale(stressLevel, 3)
        if (fieldOn('sleep_quality') && touchedFields.has('sleep_quality')) payload.sleep_quality = normalizeScale(sleepQuality, 3)
        if (fieldOn('self_esteem') && touchedFields.has('self_esteem')) payload.self_esteem = normalizeScale(selfEsteem, 3)
        if (fieldOn('gratitude')) payload.gratitude = gratitude || undefined
        if (fieldOn('small_pride')) payload.small_pride = smallPride || undefined
        if (fieldOn('free_note')) payload.free_note = freeNote || undefined
        if (fieldOn('context_tags')) payload.context_tags = contextTags.length > 0 ? contextTags : undefined
        if (fieldOn('need_tags')) payload.need_tags = needTags.length > 0 ? needTags : undefined
        if (fieldOn('care_action_tags')) payload.care_action_tags = careActionTags.length > 0 ? careActionTags : undefined
      }
    }

    if (!isCheckin && isPlus) {
      if (fieldOn('irritability') && touchedFields.has('irritability')) payload.irritability = normalizeScale(irritability, 3)
      if (fieldOn('overload') && touchedFields.has('overload')) payload.overload = normalizeScale(overload, 3)
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
      // Aviso de limite do diário — apenas plano Gratuito, 1x/mês por status.
      // Usa monthDiaryCount (COUNT dedicado, §11.5) como fonte de verdade —
      // não dá pra contar pela lista paginada.
      if (!isCheckin && plan === 'free') {
        const newCount = monthDiaryCount + 1
        setMonthDiaryCount(newCount)
        if (entryLimit != null) {
          const monthKey = ymd(new Date()).slice(0, 7)
          if (newCount === entryLimit - 1) void emailDiaryLimitWarningForUser(user!.id, monthKey)
          else if (newCount >= entryLimit) void emailDiaryLimitReachedForUser(user!.id, monthKey)
        }
      }
      // Guarda o recap e dispara a tela de confirmação explícita. O sinal do
      // registro recém-salvo alimenta a recomendação de conteúdos (§9.1/§9.2).
      setSavedConfirm({
        kind: isCheckin ? 'checkin' : 'diary',
        mood: moodObj.label, emoji: moodObj.emoji,
        energy: touchedFields.has('energy') ? energy : null,
        anxiety: touchedFields.has('anxiety_level') ? anxietyLevel : null,
        signal: signalFromEntry(payload),
      })
    }
    resetForm()
    setSaving(false)
    if (onClearPromptContext) onClearPromptContext()
  }

  const filteredEntries = entries.filter(e => filter === 'all' ? true : e.entry_type === filter)

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

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
          {isCheckinConfirm ? 'Check-in registrado 💚' : 'Diário salvo 💚'}
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
          {isCheckinConfirm && savedConfirm.energy != null && (
            <span className="bg-paper-soft border border-line rounded-full px-3.5 py-1.5 text-sm text-ink">
              Energia <strong className="text-forest-800">{savedConfirm.energy}/5</strong>
            </span>
          )}
          {isCheckinConfirm && savedConfirm.anxiety != null && (
            <span className="bg-paper-soft border border-line rounded-full px-3.5 py-1.5 text-sm text-ink">
              Ansiedade <strong className="text-forest-800">{savedConfirm.anxiety}/5</strong>
            </span>
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

        {/* Conteúdos que podem fazer sentido agora (§9.1/§9.2) — a partir do que
            acabou de ser registrado. Se houver linguagem de risco, o próprio
            componente mostra orientação de ajuda em vez de conteúdo (§15). */}
        {onOpenArticle && (
          <div className="mt-12 text-left">
            <RecommendedContent
              user={user ? { id: user.id } : null}
              profile={{ plan }}
              signal={savedConfirm.signal}
              source={isCheckinConfirm ? 'checkin' : 'diary'}
              limit={2}
              variant="compact"
              title={isCheckinConfirm ? 'Conteúdos que podem fazer sentido agora' : 'Com base no que você registrou'}
              description={isCheckinConfirm
                ? 'Selecionamos algo leve para este momento.'
                : 'Estes conteúdos guiados podem ajudar você agora.'}
              onOpen={onOpenArticle}
            />
          </div>
        )}
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
                <SliderField label="Energia" {...sliderProps('energy', energy, setEnergy)} />
                <SliderField label="Ansiedade percebida" {...sliderProps('anxiety_level', anxietyLevel, setAnxietyLevel)} />
              </div>
            )}

            {/* Uma pergunta guiada por vez, com botão pra trocar (§10) — nada de
                mostrar várias ao mesmo tempo. Só no diário completo (§3). */}
            {entryMode === 'full' && prompt && (
              <div className="bg-mint/40 border border-line rounded-2xl p-3 mb-4 flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-forest-500 mt-0.5 flex-shrink-0" />
                <p className="flex-1 text-sm text-forest-800 italic">"{prompt}"</p>
                <button onClick={fetchPrompt} className="text-xs font-medium text-forest-700 hover:text-forest-900 underline underline-offset-2 flex-shrink-0" title="Ver outra pergunta">Outra pergunta</button>
              </div>
            )}

            {/* Nota — grande e livre no diário completo; curta e opcional no check-in (§3) */}
            <div className="relative">
              {entryMode === 'quick' && (
                <label className="text-xs text-ink-soft font-medium block mb-1">Nota rápida (opcional)</label>
              )}
              <textarea
                value={whatHappened}
                onChange={e => setWhatHappened(e.target.value)}
                placeholder={entryMode === 'quick' ? 'Quer deixar uma nota curta? Não é obrigatório.' : 'Escreva aqui o que está sentindo…'}
                rows={entryMode === 'quick' ? 3 : 6}
                disabled={saveBlockedByLimit}
                className="w-full border border-line rounded-2xl px-4 py-3 text-sm resize-none bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 focus:border-forest-300 disabled:opacity-60"
              />
              <span className="absolute bottom-3 right-4 text-[11px] text-ink-soft/70">{whatHappened.length} caracteres</span>
            </div>

            {/* Campos livres complementares — só no diário completo (§8.2) */}
            {entryMode === 'full' && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <input type="text" value={whatINeed} onChange={e => setWhatINeed(e.target.value)} placeholder="O que você precisa agora?" className="border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />
                <input type="text" value={smallThing} onChange={e => setSmallThing(e.target.value)} placeholder="Uma coisa pequena que consegui fazer hoje…" className="border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />
                {/* §5.1: redundante com os chips de humor — some por padrão. */}
                <div className="sm:col-span-2">
                  {!showMainEmotion ? (
                    <button type="button" onClick={() => setShowMainEmotion(true)} className="text-xs text-ink-soft hover:text-forest-700 underline underline-offset-2">
                      Quer descrever melhor essa emoção?
                    </button>
                  ) : (
                    <input type="text" autoFocus value={mainEmotion} onChange={e => setMainEmotion(e.target.value)} placeholder="Quer descrever melhor essa emoção?" className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />
                  )}
                </div>
              </div>
            )}

            {/* Tags emocionais básicas — Gratuito (§2.1/§4): versão curada, sem o
                catálogo completo nem os blocos de contexto/necessidade/cuidado
                (Essencial+, mais abaixo). */}
            {entryMode === 'full' && !isEssential && fieldOn('emotional_tags') && (
              <div className="mt-4">
                <label className="text-xs text-ink-soft font-medium block mb-1">Quais sentimentos você reconhece agora?</label>
                <p className="text-[11px] text-ink-soft/80 mb-2">Marque quantos quiser.</p>
                <div className="flex flex-wrap gap-2">
                  {FREE_EMOTIONAL_TAGS.map(tag => (
                    <DiaryTagChip key={tag} label={tag} selected={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
                  ))}
                </div>
              </div>
            )}

            {/* Indicadores — Essencial+ (só no diário completo) */}
            {entryMode === 'full' && isEssential && (
              <div className="border-t border-line pt-5 mt-5">
                <h3 className="font-serif text-base text-forest-900 mb-1">Como está o seu corpo e sua mente agora?</h3>
                <p className="text-sm text-ink-soft mb-4">Atualize seus indicadores do momento.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SliderField label="Humor" {...sliderProps('mood_score', moodScore, setMoodScore)} />
                  {fieldOn('energy') && <SliderField label="Energia" {...sliderProps('energy', energy, setEnergy)} />}
                  {fieldOn('anxiety_level') && <SliderField label="Ansiedade" {...sliderProps('anxiety_level', anxietyLevel, setAnxietyLevel)} />}
                  {isPlus && fieldOn('stress_level') && <SliderField label="Estresse" {...sliderProps('stress_level', stressLevel, setStressLevel)} />}
                  {/* Sono é Essencial+: o Mapa Emocional mostra essa métrica desde o plano Essencial. */}
                  {fieldOn('sleep_quality') && <SliderField label="Sono" {...sliderProps('sleep_quality', sleepQuality, setSleepQuality)} />}
                  {isPlus && fieldOn('self_esteem') && <SliderField label="Autoestima" {...sliderProps('self_esteem', selfEsteem, setSelfEsteem)} />}
                  {isPlus && fieldOn('irritability') && <SliderField label="Irritabilidade" {...sliderProps('irritability', irritability, setIrritability)} />}
                  {isPlus && fieldOn('overload') && <SliderField label="Sobrecarga" {...sliderProps('overload', overload, setOverload)} />}
                </div>

                {fieldOn('emotional_tags') && (
                  <div className="mt-4">
                    <label className="text-xs text-ink-soft font-medium block mb-1">Quais sentimentos você reconhece agora?</label>
                    <p className="text-[11px] text-ink-soft/80 mb-2">Marque quantos quiser. Isso ajuda a sugerir conteúdos que combinam com o seu momento.</p>
                    <div className="flex flex-wrap gap-2">
                      {emotionalTags.map(tag => (
                        <DiaryTagChip key={tag} label={tag} selected={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
                      ))}
                      {selectedTags.filter(t => !emotionalTags.includes(t)).map(tag => (
                        <DiaryTagChip key={tag} label={tag} selected onClick={() => toggleTag(tag)} />
                      ))}
                      {showOtherTag ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="text"
                            autoFocus
                            value={otherTagInput}
                            onChange={e => setOtherTagInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOtherTag() } if (e.key === 'Escape') { setShowOtherTag(false); setOtherTagInput('') } }}
                            onBlur={addOtherTag}
                            placeholder="Digite e pressione Enter"
                            className="text-xs px-3 py-1.5 rounded-full border border-forest-300 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 w-40"
                          />
                        </span>
                      ) : (
                        <button
                          onClick={() => setShowOtherTag(true)}
                          className="text-xs px-3 py-1.5 rounded-full border border-dashed border-line text-ink-soft hover:border-forest-300 hover:text-forest-700 transition-colors"
                        >
                          + Outros
                        </button>
                      )}
                    </div>
                    {tagPreviewThemes.length > 0 && (
                      <p className="text-xs text-forest-700 bg-mint/50 rounded-xl px-3 py-2 mt-2.5 leading-relaxed">
                        Isso pode se relacionar com <strong>{tagPreviewThemes.join(' e ')}</strong> — ao salvar, você vê conteúdos que conversam com isso.
                      </p>
                    )}
                  </div>
                )}

                {/* Onde isso apareceu? (§7) — Essencial+ */}
                {fieldOn('context_tags') && (
                  <div className="mt-4">
                    <label className="text-xs text-ink-soft font-medium block mb-1">Onde isso apareceu?</label>
                    <p className="text-[11px] text-ink-soft/80 mb-2">Marque os contextos que mais tiveram relação com o seu dia.</p>
                    <div className="flex flex-wrap gap-2">
                      {contextTagOptions.map(tag => (
                        <DiaryTagChip key={tag} label={tag} category="context" selected={contextTags.includes(tag)} onClick={() => toggleInArray(contextTags, setContextTags, tag)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* O que eu preciso agora? (§8) — Essencial+ */}
                {fieldOn('need_tags') && (
                  <div className="mt-4">
                    <label className="text-xs text-ink-soft font-medium block mb-1">O que você sente que precisa agora?</label>
                    <p className="text-[11px] text-ink-soft/80 mb-2">Escolha uma ou mais necessidades que combinam com este momento.</p>
                    <div className="flex flex-wrap gap-2">
                      {needTagOptions.map(tag => (
                        <DiaryTagChip key={tag} label={tag} category="need" selected={needTags.includes(tag)} onClick={() => toggleInArray(needTags, setNeedTags, tag)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* O que pode me ajudar? (§9) — Essencial+ */}
                {fieldOn('care_action_tags') && (
                  <div className="mt-4">
                    <label className="text-xs text-ink-soft font-medium block mb-1">O que pode te ajudar um pouco?</label>
                    <p className="text-[11px] text-ink-soft/80 mb-2">Escolha pequenas possibilidades de cuidado. Não precisa virar obrigação.</p>
                    <div className="flex flex-wrap gap-2">
                      {careActionTagOptions.map(tag => (
                        <DiaryTagChip key={tag} label={tag} category="care_action" selected={careActionTags.includes(tag)} onClick={() => toggleInArray(careActionTags, setCareActionTags, tag)} />
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
                <Save className="w-4 h-4" /> {saving ? 'Salvando…' : entryMode === 'quick' ? 'Salvar check-in' : 'Salvar diário'}
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
                {(['all', 'checkin', 'diary', 'questionnaire'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === f ? 'bg-forest-900 text-white border-forest-900' : 'border-line text-ink-soft hover:border-forest-300 bg-white'}`}
                  >
                    {f === 'all' ? 'Tudo' : f === 'checkin' ? 'Check-ins' : f === 'diary' ? 'Diário' : 'Avaliações'}
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
                            {entry.entry_type === 'checkin' && <span className="text-[10px] bg-sky text-[#3d6ea5] px-2 py-0.5 rounded-full">Check-in</span>}
                            {entry.entry_type === 'questionnaire' && <span className="text-[10px] bg-mint text-forest-700 px-2 py-0.5 rounded-full">Avaliação</span>}
                            {entry.entry_type === 'diary' && <span className="text-[10px] bg-coral/40 text-[#8a3b23] px-2 py-0.5 rounded-full">Diário</span>}
                          </div>
                          <p className="text-xs text-ink-soft mt-0.5 capitalize">{formatDate(entry.date ?? '')}</p>
                          {(() => {
                            const tags = entryTags(entry)
                            if (tags.length === 0) return null
                            const shown = tags.slice(0, 5)
                            const extra = tags.length - shown.length
                            return (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {shown.map((t, i) => <DiaryTagChip key={i} label={t.tag} category={t.category} size="sm" />)}
                                {extra > 0 && <span className="text-[10px] text-ink-soft px-1">+{extra}</span>}
                              </div>
                            )
                          })()}
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-ink-soft flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-ink-soft flex-shrink-0" />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 border-t border-line">
                          {(!!entry.energy || !!entry.anxiety_level) && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {!!entry.energy && <span className="text-xs bg-mint text-forest-700 px-2.5 py-1 rounded-full">Energia: {entry.energy}/5</span>}
                              {!!entry.anxiety_level && <span className="text-xs bg-coral/40 text-[#8a3b23] px-2.5 py-1 rounded-full">Ansiedade: {entry.anxiety_level}/5</span>}
                            </div>
                          )}
                          {entry.text && <p className="text-sm text-ink leading-relaxed whitespace-pre-line mt-3">{entry.text}</p>}
                          {entryTags(entry).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {entryTags(entry).map((t, i) => <DiaryTagChip key={i} label={t.tag} category={t.category} size="sm" />)}
                            </div>
                          )}
                          {entry.gratitude && <p className="text-xs text-ink-soft mt-2">🙏 Gratidão: {entry.gratitude}</p>}
                          {entry.small_pride && <p className="text-xs text-ink-soft mt-1">✨ Pequeno orgulho: {entry.small_pride}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {/* §11.5: nunca carrega tudo de uma vez — só mais uma página por clique. */}
            {hasMoreEntries && filteredEntries.length > 0 && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={loadMoreEntries}
                  disabled={loadingMore}
                  className="text-sm font-medium text-forest-700 border border-line px-4 py-2 rounded-xl hover:bg-mint/40 disabled:opacity-60"
                >
                  {loadingMore ? 'Carregando…' : 'Carregar mais'}
                </button>
              </div>
            )}
          </section>
        </div>

        {/* ─── Coluna lateral ─── */}
        <aside className="space-y-5">
          {/* (§12) "Seus registros recentes" foi removido daqui — duplicava "Suas
              entradas" na coluna principal, com o mesmo conteúdo. */}

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
