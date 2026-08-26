import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  BookOpen, ChevronDown, ChevronUp, FileDown, Home,
  Loader2, Maximize2, Mic, Minimize2, RefreshCw, Save, Sparkles,
  SlidersHorizontal, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { DiaryEntry, Plan } from '../types'
import { fetchDiaryConfig, defaultDiaryConfig, type DiaryPlanConfig } from '../lib/diaryConfig'
import { hasPlanAccess } from '../lib/officialPlans'
import { ymd } from '../lib/reportPeriods'
import { exportElementToPdf } from '../lib/exportPdf'
import { emailDiaryLimitReachedForUser, emailDiaryLimitWarningForUser } from '../lib/emailTriggers'
import { signalFromEntry, type Signal } from '../lib/contentRecommendation'
import { askDiaryCompanion, type DiaryMirror, type DiarySuggestedTags } from '../lib/diaryCompanion'
import DiaryTagChip from './DiaryTagChip'
import { QuickScaleField } from './DiaryFormFields'
import DiarySavedReflection from './DiarySavedReflection'
import DiaryMoodSelector from './DiaryMoodSelector'
import DiaryDetailsDrawer from './DiaryDetailsDrawer'
import { MOODS } from './user/moods'

interface DiaryExperienceProps {
  user: User | null
  plan: Plan
  onBack: () => void
  onNavigatePricing?: () => void
  initialMood?: string | null
  promptContext?: { prompt: string; articleTitle: string; articleSlug: string; category: string } | null
  onClearPromptContext?: () => void
  onOpenArticle?: (slug: string) => void
}

type DiaryEntryV2 = DiaryEntry & {
  deepened_at?: string | null
  ai_disabled?: boolean
  ai_title?: string | null
  ai_reflection?: DiaryMirror | null
  ai_suggested_tags?: DiarySuggestedTags | null
  ai_processed_at?: string | null
}

type EntryMode = 'diary' | 'quick' | 'main-saved'
type PageTab = 'write' | 'history'
type Filter = 'all' | 'checkin' | 'diary' | 'questionnaire'
type PeriodFilter = 'all' | '7d' | '30d' | 'month'

type ScaleName = 'moodScore' | 'energy' | 'anxiety' | 'sleep' | 'stress' | 'selfEsteem' | 'irritability' | 'overload'

const moodOptions = [
  { value: 'bem_estar', emoji: '😊', label: 'Bem-estar', score: 5 },
  { value: 'tranquilidade', emoji: '😌', label: 'Tranquilidade', score: 5 },
  { value: 'cansaco', emoji: '😪', label: 'Cansaço', score: 2 },
  { value: 'sem_energia', emoji: '🪫', label: 'Sem energia', score: 2 },
  { value: 'ansiedade', emoji: '😰', label: 'Ansiedade', score: 2 },
  { value: 'sobrecarga', emoji: '😩', label: 'Sobrecarga', score: 1 },
  { value: 'tristeza', emoji: '😔', label: 'Tristeza', score: 1 },
  { value: 'irritacao', emoji: '😤', label: 'Irritação', score: 2 },
  { value: 'desanimo', emoji: '😞', label: 'Desânimo', score: 1 },
  { value: 'confusao', emoji: '😵‍💫', label: 'Confusão', score: 2 },
  { value: 'outro', emoji: '😐', label: 'Outro', score: 3 },
]
const CHIP_TO_MOOD: Record<string, string> = {
  bem_estar: 'bem_estar', tranquilidade: 'tranquilidade', cansaco: 'cansaco', sem_energia: 'sem_energia', ansiedade: 'ansiedade', sobrecarga: 'sobrecarga', tristeza: 'tristeza', irritacao: 'irritacao', desanimo: 'desanimo', confusao: 'confusao', outro: 'outro',
  bem: 'bem_estar', 'bem-estar': 'bem_estar', tranquila: 'tranquilidade', tranquilo: 'tranquilidade', ansiosa: 'ansiedade', ansioso: 'ansiedade', cansada: 'cansaco', cansado: 'cansaco', sobrecarregada: 'sobrecarga', sobrecarregado: 'sobrecarga', triste: 'tristeza', irritada: 'irritacao', irritado: 'irritacao', neutro: 'outro', neutra: 'outro',
}
const quickContextTags = ['trabalho','família','relacionamento','saúde','dinheiro','sono','rotina','estudos','outro']
const PAGE_SIZE = 30

const normalizeScale = (value: number) => Math.min(5, Math.max(1, Math.round(value)))
const unique = (items: string[]) => [...new Set(items.filter(Boolean))]

function moodMeta(value: string | number | undefined) {
  return moodOptions.find(m => m.value === value || m.label === value) ?? moodOptions[moodOptions.length - 1]
}
function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}
function dayLabel(date: string) {
  const today = ymd(new Date())
  const yesterday = ymd(new Date(Date.now() - 86400000))
  const parsed = new Date(`${date}T12:00:00`)
  const basic = parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  if (date === today) return `Hoje · ${basic}`
  if (date === yesterday) return `Ontem · ${basic}`
  return parsed.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}
function effectiveMoodLabel(mood: string | number | undefined, otherLabel: string | null | undefined): string {
  const m = String(mood ?? '')
  return m.toLowerCase() === 'outro' && otherLabel?.trim() ? otherLabel.trim() : m
}

function deriveTitle(entry: DiaryEntryV2) {
  if (entry.ai_title) return entry.ai_title
  const mood = effectiveMoodLabel(entry.mood, entry.mood_other_label)
  if (entry.entry_type === 'checkin') return `Check-in · ${mood}`
  const clean = String(entry.text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return `Registro · ${mood}`
  const first = clean.split(/[.!?]/)[0] || clean
  return first.length > 68 ? `${first.slice(0, 68).trim()}…` : first
}
function localStartPrompt(mood: string) {
  const m = mood.toLowerCase()
  if (m.includes('ansied')) return 'O que está ocupando mais espaço na sua cabeça agora?'
  if (m.includes('cansa') || m.includes('energia')) return 'O que mais consumiu sua energia hoje?'
  if (m.includes('sobrec')) return 'Se você pudesse tirar uma coisa da sua cabeça agora, qual seria?'
  if (m.includes('trist') || m.includes('desân')) return 'O que mais pesou no seu dia, mesmo que pareça pequeno?'
  if (m.includes('bem') || m.includes('tranq')) return 'O que aconteceu hoje que você gostaria de lembrar quando reler este dia?'
  return 'Complete sem pensar muito: “Se eu pudesse colocar uma coisa para fora agora, seria…”'
}
function moodWeightSentence(mood: string): string {
  const m = mood.trim().toLowerCase()
  if (!m || m === 'outro') return 'Seu registro colocou em palavras algo deste momento.'
  return `Seu registro colocou em palavras algo ligado a ${m}.`
}

function localMirror(text: string, mood: string): DiaryMirror {
  const clean = text.replace(/\s+/g, ' ').trim()
  const first = clean.split(/[.!?]/)[0] || clean
  return {
    title: first ? (first.length > 70 ? `${first.slice(0, 70)}…` : first) : 'Meu registro de hoje',
    weight: moodWeightSentence(mood),
    observation: clean ? `Uma parte que ganhou espaço foi: “${clean.slice(0, 180)}${clean.length > 180 ? '…' : ''}”` : 'Você reservou um momento para perceber como estava.',
    strength: 'O próprio ato de escrever já transforma uma sensação difusa em algo que pode ser observado com mais calma.',
    question: 'O que você gostaria de levar deste registro para amanhã?',
    suggested_tags: { emotions: [], contexts: [], needs: [], care_actions: [], triggers: [] },
    ai_used: false,
  }
}

interface RecognitionResultLike { 0: { transcript: string }; isFinal: boolean }
interface RecognitionEventLike { results: ArrayLike<RecognitionResultLike> }
interface RecognitionErrorEventLike { error?: string; message?: string }
interface RecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((event: RecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((event: RecognitionErrorEventLike) => void) | null
  start: () => void; stop: () => void
}
type RecognitionCtor = new () => RecognitionLike

function voiceErrorMessage(code?: string) {
  const normalized = String(code || '').toLowerCase()
  if (normalized === 'not-allowed' || normalized === 'service-not-allowed') return 'O acesso ao microfone foi bloqueado. Autorize o microfone nas configurações do navegador e tente novamente.'
  if (normalized === 'audio-capture') return 'Não foi possível acessar um microfone. Verifique se ele está conectado, selecionado e liberado para este navegador.'
  if (normalized === 'no-speech') return 'Não detectei nenhuma fala. Tente novamente e fale um pouco mais perto do microfone.'
  if (normalized === 'network') return 'O reconhecimento de voz perdeu a conexão. Verifique sua internet e tente novamente.'
  if (normalized === 'language-not-supported') return 'O reconhecimento de voz em português não está disponível neste navegador.'
  return 'O ditado foi interrompido. Verifique o microfone e tente novamente. Seu texto digitado continua salvo nesta tela.'
}

export default function DiaryExperience({ user, plan, onBack, onNavigatePricing, initialMood, promptContext, onClearPromptContext, onOpenArticle }: DiaryExperienceProps) {
  const [cfg, setCfg] = useState<DiaryPlanConfig>(() => defaultDiaryConfig(plan))
  const [tab, setTab] = useState<PageTab>('write')
  const [mode, setMode] = useState<EntryMode>('quick')
  const [entries, setEntries] = useState<DiaryEntryV2[]>([])
  const [monthRows, setMonthRows] = useState<DiaryEntryV2[]>([])
  const [todayMain, setTodayMain] = useState<DiaryEntryV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [monthDiaryCount, setMonthDiaryCount] = useState(0)
  const [focusMode, setFocusMode] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [plusDetailsOpen, setPlusDetailsOpen] = useState(false)
  const [starterOpen, setStarterOpen] = useState(false)
  const [helperPrompt, setHelperPrompt] = useState('')
  const [helperLoading, setHelperLoading] = useState(false)
  const [aiAllowed, setAiAllowed] = useState(true)
  const [organizing, setOrganizing] = useState(false)
  const [organizedCandidate, setOrganizedCandidate] = useState('')
  const [voiceActive, setVoiceActive] = useState(false)
  const recognitionRef = useRef<RecognitionLike | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [saved, setSaved] = useState<null | { entry: DiaryEntryV2; signal: Signal; mirror: DiaryMirror | null; processing: boolean; kind: 'diary' | 'checkin' }>(null)
  const [suggestionsApplied, setSuggestionsApplied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const historyRef = useRef<HTMLElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const [mood, setMood] = useState('outro')
  const [moodChip, setMoodChip] = useState<string | null>(null)
  const [moodOtherLabel, setMoodOtherLabel] = useState('')
  const [draft, setDraft] = useState('')
  const [quickNote, setQuickNote] = useState('')
  const [quickContextOpen, setQuickContextOpen] = useState(false)
  const [quickContext, setQuickContext] = useState<string | null>(null)
  const [energy, setEnergy] = useState(3)
  const [anxiety, setAnxiety] = useState(3)
  const [sleep, setSleep] = useState(3)
  const [moodScore, setMoodScore] = useState(3)
  const [stress, setStress] = useState(3)
  const [selfEsteem, setSelfEsteem] = useState(3)
  const [irritability, setIrritability] = useState(3)
  const [overload, setOverload] = useState(3)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [emotions, setEmotions] = useState<string[]>([])
  const [contexts, setContexts] = useState<string[]>([])
  const [needs, setNeeds] = useState<string[]>([])
  const [careActions, setCareActions] = useState<string[]>([])
  const [triggers, setTriggers] = useState<string[]>([])

  const isEssential = hasPlanAccess(plan, 'essential')
  const isPlus = hasPlanAccess(plan, 'plus')
  const isFree = plan === 'free'
  const entryLimit = cfg.entriesPerMonth
  const atLimit = entryLimit != null && monthDiaryCount >= entryLimit
  const today = ymd(new Date())
  const todayDeepened = Boolean(todayMain?.deepened_at)
  const selectedMood = moodMeta(mood)
  const moodForAi = effectiveMoodLabel(selectedMood.label, moodOtherLabel)
  const fieldOn = (key: string) => cfg.fields[key] !== false

  useEffect(() => { fetchDiaryConfig(plan).then(setCfg) }, [plan])

  const fetchEntries = useCallback(async (reset = true) => {
    if (!user) return
    if (reset) setLoading(true); else setLoadingMore(true)
    const from = reset ? 0 : entries.length
    let query = supabase.from('diary_entries').select('*').eq('user_id', user.id).order('date', { ascending: false }).order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1)
    if (filter !== 'all') query = query.eq('entry_type', filter)
    if (periodFilter === '7d') query = query.gte('date', ymd(new Date(Date.now() - 7 * 86400000)))
    if (periodFilter === '30d') query = query.gte('date', ymd(new Date(Date.now() - 30 * 86400000)))
    if (periodFilter === 'month') query = query.gte('date', `${today.slice(0, 7)}-01`).lte('date', today)
    const { data } = await query
    const rows = (data || []) as DiaryEntryV2[]
    setEntries(prev => reset ? rows : [...prev, ...rows])
    setHasMore(rows.length === PAGE_SIZE)
    setLoading(false); setLoadingMore(false)
  }, [user, entries.length, filter, periodFilter, today])

  const fetchMonthPresence = useCallback(async () => {
    if (!user) return
    const start = `${today.slice(0, 7)}-01`
    const { data } = await supabase.from('diary_entries').select('*').eq('user_id', user.id).gte('date', start).lte('date', today).order('date', { ascending: true })
    setMonthRows((data || []) as DiaryEntryV2[])
  }, [user, today])

  const fetchTodayMain = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('diary_entries').select('*').eq('user_id', user.id).eq('entry_type', 'diary').eq('date', today).or('diary_kind.in.(basic,main),diary_kind.is.null').order('created_at', { ascending: false }).limit(1).maybeSingle()
    setTodayMain((data as DiaryEntryV2 | null) || null)
  }, [user, today])

  const fetchFreeCount = useCallback(async () => {
    if (!user || !isFree) { setMonthDiaryCount(0); return }
    const { count } = await supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('entry_type', 'diary').eq('diary_kind', 'basic').gte('date', `${today.slice(0, 7)}-01`)
    setMonthDiaryCount(count || 0)
  }, [user, isFree, today])

  useEffect(() => { void fetchEntries(true) }, [filter, periodFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchMonthPresence(); void fetchTodayMain(); void fetchFreeCount() }, [fetchMonthPresence, fetchTodayMain, fetchFreeCount])

  useEffect(() => {
    if (initialMood && CHIP_TO_MOOD[initialMood]) {
      setMoodChip(initialMood); setMood(CHIP_TO_MOOD[initialMood])
    }
  }, [initialMood])
  useEffect(() => {
    if (promptContext && !todayMain && !atLimit) {
      setMode('diary'); setDraft(promptContext.prompt); setHelperPrompt(promptContext.prompt)
    }
  }, [promptContext, todayMain, atLimit])

  const toggle = (items: string[], setter: (v: string[]) => void, value: string) => setter(items.includes(value) ? items.filter(x => x !== value) : [...items, value])
  const touch = (key: string, setter: (v: number) => void, value: number) => { setter(value); setTouched(prev => new Set(prev).add(key)) }
  const clearTouch = (key: string, setter: (v: number) => void) => { setter(3); setTouched(prev => { const n = new Set(prev); n.delete(key); return n }) }
  const chooseMood = (key: string) => { setMoodChip(key); setMood(CHIP_TO_MOOD[key] || 'outro') }

  const handleScaleChange = (name: ScaleName, value: number) => {
    if (name === 'moodScore') touch(name, setMoodScore, value)
    else if (name === 'energy') touch(name, setEnergy, value)
    else if (name === 'anxiety') touch(name, setAnxiety, value)
    else if (name === 'sleep') touch(name, setSleep, value)
    else if (name === 'stress') touch(name, setStress, value)
    else if (name === 'selfEsteem') touch(name, setSelfEsteem, value)
    else if (name === 'irritability') touch(name, setIrritability, value)
    else touch(name, setOverload, value)
  }
  const handleScaleClear = (name: ScaleName) => {
    if (name === 'moodScore') clearTouch(name, setMoodScore)
    else if (name === 'energy') clearTouch(name, setEnergy)
    else if (name === 'anxiety') clearTouch(name, setAnxiety)
    else if (name === 'sleep') clearTouch(name, setSleep)
    else if (name === 'stress') clearTouch(name, setStress)
    else if (name === 'selfEsteem') clearTouch(name, setSelfEsteem)
    else if (name === 'irritability') clearTouch(name, setIrritability)
    else clearTouch(name, setOverload)
  }

  const resetComposer = () => {
    setDraft(''); setQuickNote(''); setQuickContextOpen(false); setQuickContext(null); setHelperPrompt(''); setStarterOpen(false); setDetailsOpen(false); setPlusDetailsOpen(false); setOrganizedCandidate('')
    setMood('outro'); setMoodChip(null); setMoodOtherLabel(''); setEnergy(3); setAnxiety(3); setSleep(3); setMoodScore(3); setStress(3); setSelfEsteem(3); setIrritability(3); setOverload(3); setTouched(new Set())
    setEmotions([]); setContexts([]); setNeeds([]); setCareActions([]); setTriggers([])
    setAiAllowed(true); setError(''); setEditingEntryId(null)
  }

  const hydrateForDeepening = (entry: DiaryEntryV2, question?: string) => {
    const meta = moodMeta(entry.mood)
    setMood(meta.value); setMoodChip(MOODS.find(m => CHIP_TO_MOOD[m.key] === meta.value)?.key || null); setMoodOtherLabel(entry.mood_other_label || '')
    setDraft(`${entry.text || ''}${question ? `\n\n${question}\n` : ''}`)
    setEnergy(entry.energy || 3); setAnxiety(entry.anxiety_level || 3); setSleep(entry.sleep_quality || 3); setMoodScore(entry.mood_score || 3); setStress(entry.stress_level || 3); setSelfEsteem(entry.self_esteem || 3); setIrritability(entry.irritability || 3); setOverload(entry.overload || 3)
    const nextTouched = new Set<string>(); if (entry.energy) nextTouched.add('energy'); if (entry.anxiety_level) nextTouched.add('anxiety'); if (entry.sleep_quality) nextTouched.add('sleep'); if (entry.mood_score) nextTouched.add('moodScore'); if (entry.stress_level) nextTouched.add('stress'); if (entry.self_esteem) nextTouched.add('selfEsteem'); if (entry.irritability) nextTouched.add('irritability'); if (entry.overload) nextTouched.add('overload'); setTouched(nextTouched)
    setEmotions(entry.emotional_tags || []); setContexts(entry.context_tags || []); setNeeds(entry.need_tags || []); setCareActions(entry.care_action_tags || []); setTriggers(entry.trigger_tags || [])
    setAiAllowed(entry.ai_disabled !== true); setEditingEntryId(entry.id); setMode('diary'); setTab('write'); setDetailsOpen(Boolean(entry.energy || entry.anxiety_level || entry.emotional_tags?.length || question)); setError('')
    setTimeout(() => editorRef.current?.focus(), 80)
  }

  const startDeepening = async (question?: string) => {
    const entry = todayMain
    if (!entry) return
    if (entry.deepened_at) { setError('Você já aprofundou seu registro de hoje. Amanhã um novo diário fica disponível.'); return }
    hydrateForDeepening(entry, question)
  }

  const requestStartHelp = async () => {
    setHelperLoading(true); setStarterOpen(false); setError('')
    const fallback = localStartPrompt(moodForAi)
    if (!aiAllowed) {
      setHelperPrompt(fallback); setHelperLoading(false); setMode('diary'); setTimeout(() => editorRef.current?.focus(), 60)
      return
    }
    try {
      const response = await askDiaryCompanion({ action: 'start', mood: moodForAi, hour: new Date().getHours() })
      setHelperPrompt(response.prompt || fallback)
    } catch { setHelperPrompt(fallback) }
    setHelperLoading(false); setMode('diary'); setTimeout(() => editorRef.current?.focus(), 60)
  }

  const starterChoice = (kind: string) => {
    const prompts: Record<string, string> = {
      crowded: 'Se eu pudesse tirar uma coisa da minha cabeça agora, seria…',
      happened: 'O que aconteceu hoje que ainda está ecoando em você?',
      worried: 'Qual preocupação está pedindo mais espaço na sua atenção agora?',
      good: 'O que aconteceu hoje que você gostaria de guardar?',
      unclear: 'Sem tentar explicar: qual palavra chega mais perto do que está acontecendo dentro de você?',
    }
    setHelperPrompt(prompts[kind] || localStartPrompt(moodForAi)); setStarterOpen(false); setTimeout(() => editorRef.current?.focus(), 50)
  }

  const organizeWriting = async () => {
    if (!aiAllowed) { setOrganizedCandidate(''); setError('A leitura complementar está desativada para este registro. Seu texto permanece salvo normalmente.'); return }
    if (!draft.trim() || organizing) return
    setOrganizing(true); setError('')
    try {
      const response = await askDiaryCompanion({ action: 'organize', mood: moodForAi, text: draft })
      setOrganizedCandidate(response.organized_text || '')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível organizar a escrita agora.') }
    setOrganizing(false)
  }

  const toggleVoice = () => {
    if (voiceActive) { recognitionRef.current?.stop(); setVoiceActive(false); return }
    const w = window as typeof window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) { setError('Ditado por voz não está disponível neste navegador. Você pode continuar digitando normalmente.'); return }
    const recognition = new Ctor(); recognition.lang = 'pt-BR'; recognition.continuous = true; recognition.interimResults = false
    recognition.onresult = event => {
      let addition = ''
      for (let i = 0; i < event.results.length; i++) if (event.results[i].isFinal) addition += `${event.results[i][0].transcript} `
      if (addition.trim()) setDraft(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${addition.trim()}`)
    }
    recognition.onend = () => { setVoiceActive(false); recognitionRef.current = null }
    recognition.onerror = event => {
      setVoiceActive(false); recognitionRef.current = null
      if (event.error === 'aborted') return
      setError(voiceErrorMessage(event.error))
    }
    recognitionRef.current = recognition
    try {
      recognition.start(); setVoiceActive(true); setError('')
    } catch {
      recognitionRef.current = null; setVoiceActive(false)
      setError('Não foi possível iniciar o ditado. Verifique a permissão do microfone e tente novamente.')
    }
  }

  async function persistAiMetadata(entryId: string, mirror: DiaryMirror | null, disabled: boolean) {
    const payload = disabled
      ? { ai_disabled: true, ai_title: null, ai_reflection: null, ai_suggested_tags: null, ai_processed_at: null }
      : { ai_disabled: false, ai_title: mirror?.title || null, ai_reflection: mirror, ai_suggested_tags: mirror?.suggested_tags || null, ai_processed_at: new Date().toISOString() }
    await supabase.from('diary_entries').update(payload).eq('id', entryId)
  }

  const runMirror = async (entry: DiaryEntryV2) => {
    if (!aiAllowed || !String(entry.text || '').trim()) {
      void persistAiMetadata(entry.id, null, true)
      setSaved(prev => prev ? { ...prev, mirror: null, processing: false } : prev)
      return
    }
    const moodText = effectiveMoodLabel(entry.mood, entry.mood_other_label) || 'seu momento'
    const fallback = localMirror(String(entry.text || ''), moodText)
    let mirror = fallback
    try {
      const response = await askDiaryCompanion({ action: 'mirror', mood: moodText, text: String(entry.text || ''), entry_id: entry.id })
      if (response.mirror) mirror = response.mirror
    } catch { /* fallback local mantém a recompensa pós-escrita */ }
    void persistAiMetadata(entry.id, mirror, false)
    const enriched = { ...entry, ai_title: mirror.title, ai_reflection: mirror, ai_suggested_tags: mirror.suggested_tags, ai_processed_at: new Date().toISOString() }
    setEntries(prev => prev.map(e => e.id === entry.id ? enriched : e)); setMonthRows(prev => prev.map(e => e.id === entry.id ? enriched : e)); setTodayMain(prev => prev?.id === entry.id ? enriched : prev)
    setSaved(prev => prev ? { ...prev, entry: enriched, mirror, processing: false } : prev)
  }

  async function savePayload(payload: Record<string, unknown>, editingId: string | null) {
    const write = (p: Record<string, unknown>) => editingId
      ? supabase.from('diary_entries').update(p).eq('id', editingId).select().single()
      : supabase.from('diary_entries').insert(p).select().single()
    let result = await write(payload)
    if (result.error && /ai_disabled|schema cache|column/i.test(`${result.error.message} ${result.error.details || ''}`)) {
      const compatible = { ...payload }; delete compatible.ai_disabled
      result = await write(compatible)
    }
    return result
  }

  const handleSave = async () => {
    if (!user) return
    const isCheckin = mode === 'quick'
    if (!moodChip) { setError('Escolha como você está se sentindo antes de salvar.'); return }
    if (!isCheckin && !draft.trim()) { setError('Escreva ao menos uma frase antes de salvar seu diário.'); return }
    if (!isCheckin && !editingEntryId && atLimit) { setError('Você atingiu o limite de registros de diário deste mês. Seus check-ins continuam liberados.'); return }
    setSaving(true); setError('')
    const meta = selectedMood
    const payload: Record<string, unknown> = {
      user_id: user.id, date: today, mood: meta.label, mood_score: normalizeScale(touched.has('moodScore') ? moodScore : meta.score), text: isCheckin ? quickNote.trim() : draft.trim(), entry_type: isCheckin ? 'checkin' : 'diary', ai_disabled: isCheckin ? true : !aiAllowed,
      ...(!isCheckin ? { diary_kind: isFree ? 'basic' : 'main' } : {}),
      ...(moodChip === 'outro' && moodOtherLabel.trim() ? { mood_other_label: moodOtherLabel.trim().slice(0, 80) } : {}),
    }
    if (isCheckin) {
      if (isEssential && touched.has('energy')) payload.energy = normalizeScale(energy)
      if (isEssential && touched.has('stress')) payload.stress_level = normalizeScale(stress)
      if (isEssential && mood === 'ansiedade' && touched.has('anxiety')) payload.anxiety_level = normalizeScale(anxiety)
      if (isEssential && quickContext) payload.context_tags = [quickContext]
    } else {
      if (fieldOn('emotional_tags') && emotions.length) payload.emotional_tags = emotions
      if (isEssential) {
        if (fieldOn('energy') && touched.has('energy')) payload.energy = normalizeScale(energy)
        if (fieldOn('anxiety_level') && touched.has('anxiety')) payload.anxiety_level = normalizeScale(anxiety)
        if (fieldOn('sleep_quality') && touched.has('sleep')) payload.sleep_quality = normalizeScale(sleep)
        if (fieldOn('context_tags') && contexts.length) payload.context_tags = contexts
        if (fieldOn('need_tags') && needs.length) payload.need_tags = needs
        if (fieldOn('care_action_tags') && careActions.length) payload.care_action_tags = careActions
      }
      if (isPlus) {
        if (fieldOn('stress_level') && touched.has('stress')) payload.stress_level = normalizeScale(stress)
        if (fieldOn('self_esteem') && touched.has('selfEsteem')) payload.self_esteem = normalizeScale(selfEsteem)
        if (fieldOn('irritability') && touched.has('irritability')) payload.irritability = normalizeScale(irritability)
        if (fieldOn('overload') && touched.has('overload')) payload.overload = normalizeScale(overload)
        if (fieldOn('trigger_tags') && triggers.length) payload.trigger_tags = triggers
      }
    }
    const wasEditing = Boolean(editingEntryId)
    const { data, error: saveError } = await savePayload(payload, editingEntryId)
    if (saveError || !data) {
      const raw = `${saveError?.message || ''} ${saveError?.details || ''}`.toLowerCase()
      setError(raw.includes('aprofund') ? 'Você já aprofundou seu registro de hoje.' : raw.includes('limit') || raw.includes('limite') ? 'Você atingiu o limite de registros de diário deste mês.' : 'Não foi possível salvar agora. Tente novamente em instantes.')
      setSaving(false); return
    }
    const entry = data as DiaryEntryV2
    setEntries(prev => wasEditing ? prev.map(e => e.id === entry.id ? entry : e) : [entry, ...prev])
    setMonthRows(prev => wasEditing ? prev.map(e => e.id === entry.id ? entry : e) : [...prev, entry])
    if (!isCheckin) {
      const main = wasEditing ? { ...entry, deepened_at: entry.deepened_at || new Date().toISOString() } : entry
      setTodayMain(main)
      if (isFree && !wasEditing) {
        const next = monthDiaryCount + 1; setMonthDiaryCount(next)
        if (entryLimit != null) {
          const monthKey = today.slice(0, 7)
          if (next === entryLimit - 1) void emailDiaryLimitWarningForUser(user.id, monthKey)
          else if (next >= entryLimit) void emailDiaryLimitReachedForUser(user.id, monthKey)
        }
      }
    }
    const signal = signalFromEntry(payload)
    setSaved({ entry, signal, mirror: null, processing: !isCheckin && aiAllowed, kind: isCheckin ? 'checkin' : 'diary' })
    setSuggestionsApplied(false)
    if (!isCheckin) void runMirror(entry)
    resetComposer(); setSaving(false); if (onClearPromptContext) onClearPromptContext()
  }

  const applySuggestions = async () => {
    const current = saved?.entry; const tags = saved?.mirror?.suggested_tags
    if (!current || !tags) return
    const update = {
      emotional_tags: unique([...(current.emotional_tags || []), ...tags.emotions]),
      context_tags: unique([...(current.context_tags || []), ...tags.contexts]),
      need_tags: unique([...(current.need_tags || []), ...tags.needs]),
      care_action_tags: unique([...(current.care_action_tags || []), ...tags.care_actions]),
      trigger_tags: isPlus ? unique([...(current.trigger_tags || []), ...tags.triggers]) : current.trigger_tags,
    }
    const { data } = await supabase.from('diary_entries').update(update).eq('id', current.id).select().single()
    if (data) {
      const row = data as DiaryEntryV2; setSaved(prev => prev ? { ...prev, entry: row } : prev); setEntries(prev => prev.map(e => e.id === row.id ? row : e)); setMonthRows(prev => prev.map(e => e.id === row.id ? row : e)); setTodayMain(prev => prev?.id === row.id ? row : prev); setSuggestionsApplied(true)
    }
  }

  const askFollowUp = async () => {
    const entry = saved?.entry
    if (!entry || !isEssential) return
    let question = saved?.mirror?.question || 'O que neste registro você sente que ainda ficou sem palavras?'
    if (entry.ai_disabled !== true) {
      try {
        const response = await askDiaryCompanion({ action: 'continue', mood: effectiveMoodLabel(entry.mood, entry.mood_other_label), text: String(entry.text || '') })
        if (response.prompt) question = response.prompt
      } catch { /* usa pergunta já gerada */ }
    }
    setSaved(null); await startDeepening(question)
  }

  const continueFromCheckin = () => {
    const entry = saved?.kind === 'checkin' ? saved.entry : null
    if (!entry) return
    setSaved(null)
    if (todayMain) {
      setMode('main-saved'); setTab('write'); setError('')
      return
    }
    resetComposer()
    const meta = moodMeta(entry.mood)
    setMood(meta.value); setMoodChip(MOODS.find(m => CHIP_TO_MOOD[m.key] === meta.value)?.key || null); setMoodOtherLabel(entry.mood_other_label || '')
    setEnergy(entry.energy || 3); setStress(entry.stress_level || 3); setAnxiety(entry.anxiety_level || 3)
    const carried = new Set<string>(); if (entry.energy) carried.add('energy'); if (entry.stress_level) carried.add('stress'); if (entry.anxiety_level) carried.add('anxiety'); setTouched(carried)
    setContexts(entry.context_tags || [])
    const note = String(entry.text || '').trim()
    const moodWord = effectiveMoodLabel(entry.mood, entry.mood_other_label).toLowerCase()
    setHelperPrompt(note ? `No seu check-in você anotou: “${note.slice(0, 140)}${note.length > 140 ? '…' : ''}”. Se quiser, conte um pouco mais sobre isso.` : `Você marcou ${moodWord}. O que está por trás deste momento?`)
    setMode('diary'); setTab('write'); setError('')
    setTimeout(() => editorRef.current?.focus(), 80)
  }

  const monthKey = today.slice(0, 7)
  const monthCheckins = monthRows.filter(e => e.entry_type === 'checkin').length
  const activeDays = new Set(monthRows.map(e => String(e.date || '').slice(0, 10)).filter(Boolean)).size
  const monthMoments = monthRows.length
  const daysInMonth = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate()
  const firstWeekday = new Date(`${monthKey}-01T12:00:00`).getDay()
  const moodByDay = new Map<string, string>()
  for (const row of monthRows) moodByDay.set(String(row.date || '').slice(0, 10), moodMeta(row.mood).emoji)
  const monthTitle = new Date(`${monthKey}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const groupedHistory = useMemo(() => {
    const map = new Map<string, DiaryEntryV2[]>()
    for (const entry of entries) { const d = String(entry.date || '').slice(0, 10); map.set(d, [...(map.get(d) || []), entry]) }
    return [...map.entries()]
  }, [entries])

  async function exportHistory() {
    if (!historyRef.current || exporting) return
    setExporting(true)
    try { await exportElementToPdf(historyRef.current, `diario-${monthKey}.pdf`) } finally { setExporting(false) }
  }

  if (saved) {
    return (
      <DiarySavedReflection
        saved={saved}
        user={user}
        plan={plan}
        isEssential={isEssential}
        todayDeepened={todayDeepened}
        suggestionsApplied={suggestionsApplied}
        onOpenArticle={onOpenArticle}
        moodMeta={moodMeta}
        onApplySuggestions={() => void applySuggestions()}
        onAskFollowUp={() => void askFollowUp()}
        onFinishCheckin={() => { setSaved(null); setMode('quick'); setTab('write') }}
        onContinueFromCheckin={continueFromCheckin}
        onViewHistory={() => { setSaved(null); setTab('history') }}
        onBack={onBack}
      />
    )
  }

  const shell = focusMode ? 'fixed inset-0 z-50 bg-[#f8f5ef] overflow-y-auto' : ''
  const contentWidth = focusMode ? 'max-w-3xl py-8 sm:py-12' : tab === 'write' ? 'max-w-4xl py-6 sm:py-9' : 'max-w-6xl py-6 sm:py-9'

  return (
    <div className={shell}>
      <div className={`${contentWidth} mx-auto px-4 sm:px-6`}>
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-forest-600">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
            <h1 className="font-serif text-3xl sm:text-4xl text-forest-900 mt-1">{greeting()}. Como você chegou até aqui hoje?</h1>
            {!focusMode && <p className="text-sm text-ink-soft mt-2 max-w-2xl">{mode === 'diary' ? 'Escreva do seu jeito. Se quiser, adicione detalhes depois.' : mode === 'quick' ? 'Comece com um check-in rápido. Se quiser, aprofunde escrevendo depois.' : 'Seu registro de hoje continua disponível para um único aprofundamento.'}</p>}
          </div>
          <button onClick={() => setFocusMode(v => !v)} className="flex-shrink-0 rounded-xl border border-line bg-white p-2.5 text-forest-800" title={focusMode ? 'Sair do modo foco' : 'Modo foco'} aria-label={focusMode ? 'Sair do modo foco' : 'Ativar modo foco'}>{focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
        </header>

        {!focusMode && (
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div className="inline-flex rounded-full border border-line bg-white p-1">
              <button onClick={() => setTab('write')} className={`px-4 py-1.5 rounded-full text-sm ${tab === 'write' ? 'bg-forest-900 text-white' : 'text-ink-soft'}`}>Escrever</button>
              <button onClick={() => setTab('history')} className={`px-4 py-1.5 rounded-full text-sm ${tab === 'history' ? 'bg-forest-900 text-white' : 'text-ink-soft'}`}>Histórico</button>
            </div>
            <button onClick={onBack} className="text-sm text-ink-soft hover:text-forest-900 inline-flex items-center gap-1.5"><Home className="w-4 h-4" /> Início</button>
          </div>
        )}

        {tab === 'write' ? (
          <div className={focusMode ? '' : 'mx-auto max-w-3xl'}>
            <main className="min-w-0">
              {!focusMode && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <button onClick={() => setMode('quick')} className={`rounded-full px-4 py-2 text-sm border ${mode === 'quick' ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-forest-800'}`}>Check-in rápido</button>
                  <button onClick={() => setMode(todayMain ? 'main-saved' : 'diary')} className={`rounded-full px-4 py-2 text-sm border ${mode !== 'quick' ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-forest-800'}`}>Meu diário</button>
                </div>
              )}

              {mode === 'main-saved' && todayMain ? (
                <section className="rounded-3xl border border-line bg-paper-soft p-6 sm:p-8">
                  <p className="text-xs uppercase tracking-[0.14em] text-forest-600">Registro de hoje</p>
                  <h2 className="font-serif text-2xl text-forest-900 mt-1">Você já colocou algo no papel hoje.</h2>
                  <p className="text-sm text-ink-soft mt-2 leading-relaxed">{todayDeepened ? 'Seu registro já foi aprofundado uma vez hoje. Seus check-ins continuam disponíveis, e amanhã começa uma nova página.' : 'Se algo ainda ficou sem palavras, você pode aprofundar este mesmo registro uma única vez hoje.'}</p>
                  <blockquote className="mt-5 border-l-2 border-forest-300 pl-4 text-sm text-ink-soft whitespace-pre-line line-clamp-5">{todayMain.text || 'Registro sem texto.'}</blockquote>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {!todayDeepened && <button onClick={() => void startDeepening()} className="rounded-xl bg-forest-900 text-white px-4 py-2.5 text-sm font-medium">Aprofundar meu registro</button>}
                    <button onClick={() => setMode('quick')} className="rounded-xl border border-line bg-white text-forest-900 px-4 py-2.5 text-sm">Fazer check-in rápido</button>
                  </div>
                </section>
              ) : (
                <section className={`${focusMode ? 'bg-transparent' : 'bg-paper-soft border border-line rounded-[2rem]'} p-4 sm:p-7`}>
                  {promptContext && mode === 'diary' && <div className="mb-5 rounded-2xl bg-mint/50 border border-forest-100 p-4"><p className="text-xs text-forest-600">Pergunta do conteúdo “{promptContext.articleTitle}”</p><p className="text-sm text-forest-900 mt-1">{promptContext.prompt}</p></div>}

                  <DiaryMoodSelector selectedKey={moodChip} otherLabel={moodOtherLabel} onSelect={chooseMood} onOtherLabelChange={setMoodOtherLabel} />

                  {mode === 'quick' ? (
                    <>
                      <p className="text-sm text-ink-soft mb-4">Leva menos de um minuto. Escolha uma emoção e, se quiser, acrescente alguns sinais deste momento.</p>
                      {isEssential && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4"><QuickScaleField label="Energia" value={energy} touched={touched.has('energy')} labels={['Muito baixa','Baixa','Média','Boa','Alta']} onChange={v => touch('energy', setEnergy, v)} onClear={() => clearTouch('energy', setEnergy)} /><QuickScaleField label="Tensão/estresse" value={stress} touched={touched.has('stress')} labels={['Muito baixa','Baixa','Média','Alta','Muito alta']} onChange={v => touch('stress', setStress, v)} onClear={() => clearTouch('stress', setStress)} />{mood === 'ansiedade' && <QuickScaleField label="Intensidade da ansiedade" value={anxiety} touched={touched.has('anxiety')} labels={['Muito baixa','Baixa','Média','Alta','Muito alta']} onChange={v => touch('anxiety', setAnxiety, v)} onClear={() => clearTouch('anxiety', setAnxiety)} />}</div>}
                      {isEssential && <div className="mb-4"><button type="button" onClick={() => setQuickContextOpen(v => !v)} className="inline-flex items-center gap-2 text-sm font-medium text-forest-800"><SlidersHorizontal className="w-4 h-4" /> Quero contar um pouco mais {quickContextOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>{quickContextOpen && <div className="mt-3 rounded-2xl border border-line bg-white p-4"><p className="text-sm font-semibold text-forest-900">O que mais está influenciando você agora?</p><p className="text-xs text-ink-soft mt-1">Escolha só uma opção, se fizer sentido.</p><div className="flex flex-wrap gap-2 mt-3">{quickContextTags.map(tag => <button key={tag} type="button" onClick={() => setQuickContext(prev => prev === tag ? null : tag)} className={`rounded-full border px-3 py-1.5 text-xs ${quickContext === tag ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-forest-800'}`}>{tag.charAt(0).toUpperCase() + tag.slice(1)}</button>)}</div></div>}</div>}
                      <label className="text-sm font-semibold text-forest-900">Quer deixar uma nota rápida? <span className="font-normal text-ink-soft">(opcional)</span></label>
                      <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)} rows={3} placeholder="Uma frase já basta…" aria-label="Nota rápida do check-in" className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-4 text-base resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />
                    </>
                  ) : (
                    <>
                      {helperPrompt && <div className="mb-4 rounded-2xl border border-forest-100 bg-mint/45 p-4 flex gap-3"><Sparkles className="w-4 h-4 text-forest-600 mt-0.5 flex-shrink-0" /><div className="flex-1"><p className="text-sm text-forest-900">{helperPrompt}</p><button type="button" onClick={() => void requestStartHelp()} className="text-xs text-forest-700 mt-2">Quero outra pergunta</button></div><button onClick={() => setHelperPrompt('')} className="text-ink-soft" aria-label="Fechar pergunta"><X className="w-4 h-4" /></button></div>}

                      <div className={`${focusMode ? 'min-h-[58vh]' : ''}`}>
                        <textarea ref={editorRef} value={draft} onChange={e => setDraft(e.target.value)} rows={focusMode ? 18 : 13} placeholder="Escreva do seu jeito. Pode ser uma frase, um desabafo ou tudo que estiver na sua cabeça…" aria-label="Texto do diário" className={`w-full bg-transparent px-1 py-3 font-serif text-lg sm:text-xl leading-relaxed resize-none focus:outline-none placeholder:text-ink-soft/55 ${focusMode ? 'min-h-[55vh]' : 'min-h-[320px] sm:min-h-[380px]'}`} />
                        <div className="border-t border-line/70 pt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={toggleVoice} className={`hidden sm:inline-flex rounded-xl px-3 py-2 text-xs items-center gap-1.5 ${voiceActive ? 'bg-coral/50 text-[#8a3b23]' : 'bg-white border border-line text-forest-800'}`}><Mic className="w-3.5 h-3.5" /> {voiceActive ? 'Parar ditado' : 'Prefiro falar'}</button>
                            {!editingEntryId && <button type="button" onClick={() => setStarterOpen(v => !v)} className={`rounded-xl border px-3 py-2 text-xs inline-flex items-center gap-1.5 ${starterOpen ? 'bg-mint border-forest-100 text-forest-900' : 'bg-white border-line text-forest-800'}`}><Sparkles className="w-3.5 h-3.5" /> Preciso de ajuda para começar</button>}
                          </div>
                          <span className="text-[11px] text-ink-soft">{draft.length} caracteres</span>
                        </div>
                      </div>

                      {starterOpen && !editingEntryId && <div className="mt-3 rounded-2xl border border-line bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-forest-900">Ajuda para começar</p><p className="text-xs text-ink-soft mt-0.5">Escolha só uma ajuda. Seu espaço de escrita continua sendo o principal.</p></div><button type="button" onClick={() => setStarterOpen(false)} className="text-ink-soft" aria-label="Fechar ajuda para começar"><X className="w-4 h-4" /></button></div><div className="flex flex-wrap gap-2 mt-3"><button type="button" onClick={() => void requestStartHelp()} disabled={helperLoading} className="rounded-xl bg-mint border border-forest-100 px-3 py-2 text-xs text-forest-900 inline-flex items-center gap-1.5 disabled:opacity-60">{helperLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Sugira uma pergunta</button>{[['crowded','Minha cabeça está cheia'],['happened','Aconteceu alguma coisa hoje'],['worried','Estou preocupado com algo'],['good','Estou bem e quero registrar'],['unclear','Nem sei explicar']].map(([key,label]) => <button key={key} type="button" onClick={() => starterChoice(key)} className="rounded-full border border-line px-3 py-1.5 text-xs text-forest-800 hover:bg-mint/40">{label}</button>)}</div>{isEssential && aiAllowed && draft.trim().length >= 10 && <button type="button" onClick={() => void organizeWriting()} disabled={organizing} className="mt-3 rounded-xl border border-line bg-white px-3 py-2 text-xs text-forest-800 inline-flex items-center gap-1.5 disabled:opacity-60">{organizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Organizar o que já escrevi</button>}</div>}

                      {organizedCandidate && <div className="mt-4 rounded-2xl border border-forest-100 bg-mint/35 p-4"><p className="text-xs font-semibold text-forest-700">Uma versão organizada para consultar</p><p className="text-xs text-ink-soft mt-1">Seu texto original permanece intacto no editor. Esta versão não substitui nem altera o que você escreveu.</p><p className="text-sm text-ink mt-3 whitespace-pre-line leading-relaxed">{organizedCandidate}</p><div className="flex gap-2 mt-3"><button onClick={() => setOrganizedCandidate('')} className="rounded-xl border border-line bg-white px-3 py-2 text-xs">Fechar versão organizada</button></div></div>}

                      <div className="mt-5 border-t border-line/70 pt-4">
                        <button type="button" onClick={() => setDetailsOpen(true)} className="inline-flex items-center gap-2 text-sm text-forest-800 font-medium"><SlidersHorizontal className="w-4 h-4" /> Adicionar detalhes opcionais <ChevronUp className="hidden w-4 h-4" /></button>
                      </div>

                      {detailsOpen && (
                        <DiaryDetailsDrawer
                          isEssential={isEssential}
                          isPlus={isPlus}
                          isFree={isFree}
                          fieldOn={fieldOn}
                          touched={touched}
                          values={{ moodScore, energy, anxiety, sleep, stress, selfEsteem, irritability, overload }}
                          onScaleChange={handleScaleChange}
                          onScaleClear={handleScaleClear}
                          emotions={emotions}
                          contexts={contexts}
                          needs={needs}
                          careActions={careActions}
                          triggers={triggers}
                          onToggleEmotion={tag => toggle(emotions, setEmotions, tag)}
                          onToggleContext={tag => toggle(contexts, setContexts, tag)}
                          onToggleNeed={tag => toggle(needs, setNeeds, tag)}
                          onToggleCareAction={tag => toggle(careActions, setCareActions, tag)}
                          onToggleTrigger={tag => toggle(triggers, setTriggers, tag)}
                          plusDetailsOpen={plusDetailsOpen}
                          onTogglePlusDetails={() => setPlusDetailsOpen(value => !value)}
                          onClose={() => setDetailsOpen(false)}
                        />
                      )}

                      <div className="mt-4 flex flex-col items-start gap-1">
                        <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer">
                          <input type="checkbox" checked={!aiAllowed} onChange={e => { const disabled = e.target.checked; setAiAllowed(!disabled); if (disabled) setOrganizedCandidate(''); setError('') }} className="accent-forest-700" aria-describedby="diary-ai-privacy-help" />
                          <span className="font-medium text-forest-800">Salvar sem leitura complementar</span>
                        </label>
                        <p id="diary-ai-privacy-help" className="text-[11px] leading-relaxed text-ink-soft">{aiAllowed ? 'Opcional. Seu registro continua salvo normalmente.' : 'Leitura complementar desativada: seu registro será salvo normalmente.'}</p>
                        {isFree && entryLimit != null && <p className="mt-1 text-[11px] text-ink-soft">Plano Gratuito: {monthDiaryCount} de {entryLimit} registros de diário usados neste mês. Check-ins continuam ilimitados.</p>}
                      </div>
                    </>
                  )}

                  {error && <div className="mt-4 rounded-xl bg-coral/30 px-4 py-3 text-sm text-[#8a3b23]">{error}</div>}
                  <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line/70 bg-[#f8f5ef]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
                    {!focusMode && mode === 'diary' && atLimit && !editingEntryId ? <div className="mr-auto"><p className="text-sm text-ink-soft">Você usou {monthDiaryCount} de {entryLimit} registros neste mês.</p>{onNavigatePricing && <button onClick={onNavigatePricing} className="text-xs text-forest-700 font-medium mt-1">Ver registros ilimitados</button>}</div> : <span className="mr-auto" />}
                    {mode === 'diary' && <button type="button" onClick={toggleVoice} aria-label={voiceActive ? 'Parar ditado' : 'Usar microfone'} className={`sm:hidden rounded-xl border p-3 ${voiceActive ? 'border-coral bg-coral/40 text-[#8a3b23]' : 'border-line bg-white text-forest-800'}`}><Mic className="h-4 w-4" /></button>}
                    {mode === 'diary' && <button type="button" onClick={() => setDetailsOpen(true)} aria-label="Abrir detalhes opcionais" className="sm:hidden rounded-xl border border-line bg-white p-3 text-forest-800"><SlidersHorizontal className="h-4 w-4" /></button>}
                    <button onClick={() => void handleSave()} disabled={saving || (!moodChip) || (mode === 'diary' && !draft.trim())} className="rounded-2xl bg-forest-900 text-white px-5 py-3 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {editingEntryId ? 'Salvar aprofundamento' : mode === 'quick' ? 'Salvar check-in' : 'Guardar meu registro'}</button>
                  </div>
                </section>
              )}
            </main>
          </div>
        ) : (
          <section ref={historyRef}>
            <div className="rounded-[2rem] border border-line bg-paper-soft p-5 sm:p-7 mb-5">
              <div className="flex items-start justify-between gap-4 flex-wrap"><div><p className="text-xs uppercase tracking-[0.14em] text-forest-600 capitalize">{monthTitle}</p><h2 className="font-serif text-2xl sm:text-3xl text-forest-900 mt-1">Sua história deste mês, até aqui</h2><p className="text-sm text-ink-soft mt-2">{activeDays} dias de presença · {monthMoments} momentos registrados · {monthCheckins} check-ins. Sem pontuação, sem sequência para quebrar.</p></div>{cfg.exportPDF && <button onClick={() => void exportHistory()} disabled={exporting} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-800 inline-flex items-center gap-2 disabled:opacity-60"><FileDown className="w-4 h-4" /> {exporting ? 'Gerando…' : 'Exportar PDF'}</button>}</div>
              <div className="mt-5 grid grid-cols-7 gap-1.5 max-w-md">{Array.from({ length: firstWeekday }).map((_,i) => <span key={`blank-${i}`} />)}{Array.from({ length: daysInMonth }).map((_,i) => { const day = i + 1; const date = `${monthKey}-${String(day).padStart(2,'0')}`; const emoji = moodByDay.get(date); const future = date > today; return <div key={date} title={date} className={`aspect-square rounded-xl border flex flex-col items-center justify-center text-[11px] ${future ? 'opacity-25 border-line' : emoji ? 'bg-mint/60 border-forest-100 text-forest-900' : 'bg-white border-line text-ink-soft'}`}><span>{day}</span>{emoji && <span className="text-sm leading-none mt-0.5">{emoji}</span>}</div> })}</div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap mb-4"><div className="flex flex-wrap gap-2">{(['all','diary','checkin','questionnaire'] as Filter[]).map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1.5 text-xs ${filter === f ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-ink-soft'}`}>{f === 'all' ? 'Tudo' : f === 'diary' ? 'Diários' : f === 'checkin' ? 'Check-ins' : 'Avaliações'}</button>)}<select value={periodFilter} onChange={e => setPeriodFilter(e.target.value as PeriodFilter)} aria-label="Filtrar período do histórico" className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink-soft"><option value="all">Todos os períodos</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="month">Mês atual</option></select></div><button onClick={() => void fetchEntries(true)} className="p-2 text-ink-soft" title="Atualizar" aria-label="Atualizar histórico"><RefreshCw className="w-4 h-4" /></button></div>

            {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-3xl bg-mint/30 animate-pulse" />)}</div> : groupedHistory.length === 0 ? <div className="rounded-3xl border border-line bg-white p-10 text-center"><BookOpen className="w-6 h-6 text-forest-500 mx-auto" /><p className="text-sm text-ink-soft mt-3">Ainda não há registros neste período.</p></div> : <div className="space-y-3">{groupedHistory.map(([date, rows]) => <div key={date} className="rounded-3xl border border-line bg-white overflow-hidden"><div className="px-5 pt-4 pb-2"><p className="text-xs text-forest-600 capitalize">{dayLabel(date)}</p></div><div className="divide-y divide-line/70">{rows.map(entry => { const open = expanded === entry.id; const meta = moodMeta(entry.mood); const tags = [...(entry.emotional_tags || []), ...(entry.context_tags || []), ...(entry.need_tags || [])]; return <div key={entry.id}><button onClick={() => setExpanded(open ? null : entry.id)} className="w-full text-left px-5 py-4 flex gap-3 items-start hover:bg-mint/20"><span className="text-xl">{meta.emoji}</span><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-serif text-lg text-forest-900">{deriveTitle(entry)}</h3><span className="text-[10px] rounded-full bg-mint px-2 py-0.5 text-forest-700">{entry.entry_type === 'checkin' ? 'Check-in' : entry.entry_type === 'questionnaire' ? 'Avaliação' : 'Diário'}</span></div>{entry.text && <p className="text-sm text-ink-soft mt-1 line-clamp-2">{entry.text}</p>}{tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{tags.slice(0,4).map((t,i) => <DiaryTagChip key={`${t}-${i}`} label={t} size="sm" />)}{tags.length > 4 && <span className="text-[10px] text-ink-soft">+{tags.length - 4}</span>}</div>}</div>{open ? <ChevronUp className="w-4 h-4 text-ink-soft" /> : <ChevronDown className="w-4 h-4 text-ink-soft" />}</button>{open && <div className="px-5 pb-5 pl-14"><p className="text-sm text-ink whitespace-pre-line leading-relaxed">{entry.text || 'Sem texto adicional.'}</p>{entry.ai_reflection && <div className="mt-4 rounded-2xl bg-mint/35 border border-forest-100 p-4"><p className="text-xs font-semibold text-forest-700 inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Espelho do registro</p><p className="text-sm text-ink-soft mt-2">{entry.ai_reflection.observation}</p>{entry.ai_reflection.question && <p className="text-sm text-forest-900 mt-2 font-medium">{entry.ai_reflection.question}</p>}</div>}</div>}</div>})}</div></div>)}</div>}
            {hasMore && entries.length > 0 && <div className="text-center mt-5"><button onClick={() => void fetchEntries(false)} disabled={loadingMore} className="rounded-xl border border-line bg-white px-4 py-2 text-sm text-forest-800 disabled:opacity-60">{loadingMore ? 'Carregando…' : 'Carregar mais'}</button></div>}
          </section>
        )}
      </div>
    </div>
  )
}
