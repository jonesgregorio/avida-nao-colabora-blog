import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { DiaryEntry, Plan } from '../types'
import { ArrowLeft, Plus, ChevronDown, ChevronUp, RefreshCw, Lightbulb, FileDown } from 'lucide-react'

const moodOptions = [
  { value: 'bem', emoji: '😊', label: 'Bem', score: 8 },
  { value: 'neutro', emoji: '😐', label: 'Neutro', score: 5 },
  { value: 'triste', emoji: '😔', label: 'Triste', score: 3 },
  { value: 'ansioso', emoji: '😰', label: 'Ansioso(a)', score: 3 },
  { value: 'irritado', emoji: '😤', label: 'Irritado(a)', score: 3 },
  { value: 'sobrecarregado', emoji: '😩', label: 'Sobrecarregado(a)', score: 2 },
]

const emotionalTags = [
  'ansiedade', 'tristeza', 'alegria', 'irritação', 'medo',
  'esperança', 'cansaço', 'energia', 'calma', 'confusão',
]

interface DiaryPageProps {
  user: any
  plan: Plan
  onBack: () => void
  onNavigatePricing?: () => void
  promptContext?: {
    prompt: string
    articleTitle: string
    articleSlug: string
    category: string
  } | null
  onClearPromptContext?: () => void
}

function SliderField({ label, value, onChange, min = 1, max = 10 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const pct = ((value - min) / (max - min)) * 100
  const emoji = pct < 30 ? '😟' : pct < 60 ? '😐' : '😊'
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-sage-600 font-medium">{label}</label>
        <span className="text-xs text-sage-400">{emoji} {value}/{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-purple-500"
      />
    </div>
  )
}

export default function DiaryPage({ user, plan, onBack, onNavigatePricing, promptContext, onClearPromptContext }: DiaryPageProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'diary' | 'questionnaire'>('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Free fields
  const [mood, setMood] = useState('neutro')
  const [mainEmotion, setMainEmotion] = useState('')
  const [whatHappened, setWhatHappened] = useState('')
  const [whatINeed, setWhatINeed] = useState('')
  const [smallThing, setSmallThing] = useState('')

  // Essencial+ fields
  const [moodScore, setMoodScore] = useState(5)
  const [energy, setEnergy] = useState(5)
  const [anxietyLevel, setAnxietyLevel] = useState(5)
  const [stressLevel, setStressLevel] = useState(5)
  const [gratitude, setGratitude] = useState('')
  const [smallPride, setSmallPride] = useState('')
  const [freeNote, setFreeNote] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Therapeutic+ fields
  const [sleepQuality, setSleepQuality] = useState(5)
  const [selfEsteem, setSelfEsteem] = useState(5)
  const [irritability, setIrritability] = useState(5)
  const [overload, setOverload] = useState(5)
  const [emotionalTriggers, setEmotionalTriggers] = useState('')
  const [recurringThoughts, setRecurringThoughts] = useState('')
  const [emotionalNeed, setEmotionalNeed] = useState('')
  const [relationships, setRelationships] = useState('')
  const [habits, setHabits] = useState('')

  const isEssential = plan === 'essential' || plan === 'therapeutic' || plan === 'therapeutic-plus'
  const isTherapeutic = plan === 'therapeutic' || plan === 'therapeutic-plus'

  const currentMonthEntries = entries.filter(e => {
    const d = new Date(e.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const freeEntryCount = currentMonthEntries.length
  const freeEntryLimit = 5
  const freeAtLimit = plan === 'free' && freeEntryCount >= freeEntryLimit

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }, [user.id])

  const fetchPrompt = useCallback(async () => {
    const day = new Date().getDay()
    const planFilter = isTherapeutic
      ? ['free', 'essential', 'therapeutic']
      : isEssential
      ? ['free', 'essential']
      : ['free']
    const { data } = await supabase
      .from('guided_prompts')
      .select('text')
      .in('plan_level', planFilter)
      .or(`day_of_week.eq.${day},day_of_week.is.null`)
      .limit(20)
    if (data && data.length > 0) {
      setPrompt(data[Math.floor(Math.random() * data.length)].text)
    }
  }, [isEssential, isTherapeutic])

  useEffect(() => {
    fetchEntries()
    fetchPrompt()
  }, [fetchEntries, fetchPrompt])

  // When arriving from article with a prompt context, auto-open form and pre-fill
  useEffect(() => {
    if (promptContext && !freeAtLimit) {
      setShowForm(true)
      setWhatHappened(promptContext.prompt)
    }
  }, [promptContext])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const resetForm = () => {
    setMood('neutro'); setMainEmotion(''); setWhatHappened(''); setWhatINeed(''); setSmallThing('')
    setMoodScore(5); setEnergy(5); setAnxietyLevel(5); setStressLevel(5)
    setGratitude(''); setSmallPride(''); setFreeNote(''); setSelectedTags([])
    setSleepQuality(5); setSelfEsteem(5); setIrritability(5); setOverload(5)
    setEmotionalTriggers(''); setRecurringThoughts(''); setEmotionalNeed(''); setRelationships(''); setHabits('')
    setError('')
  }

  const handleSave = async () => {
    if (!whatHappened.trim() && !mainEmotion.trim() && !freeNote.trim()) {
      setError('Escreva algo antes de salvar.')
      return
    }
    if (freeAtLimit) {
      setError('Você atingiu o limite de 5 entradas para este mês no plano gratuito.')
      return
    }
    setSaving(true)
    setError('')

    const moodObj = moodOptions.find(m => m.value === mood) || moodOptions[1]
    const entryText = [mainEmotion, whatHappened, whatINeed, smallThing, freeNote].filter(Boolean).join('\n\n')

    const payload: Partial<DiaryEntry> & { user_id: string } = {
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      mood: moodObj.label,
      mood_score: isEssential ? moodScore : moodObj.score,
      text: entryText,
      entry_type: 'diary',
    }

    if (isEssential) {
      payload.energy = energy
      payload.anxiety_level = anxietyLevel
      payload.stress_level = stressLevel
      payload.gratitude = gratitude || undefined
      payload.small_pride = smallPride || undefined
      payload.free_note = freeNote || undefined
      payload.emotional_tags = selectedTags.length > 0 ? selectedTags : undefined
    }

    if (isTherapeutic) {
      payload.sleep_quality = sleepQuality
      payload.self_esteem = selfEsteem
      payload.irritability = irritability
      payload.overload = overload
      payload.emotional_triggers = emotionalTriggers || undefined
      payload.recurring_thoughts = recurringThoughts || undefined
      payload.emotional_need = emotionalNeed || undefined
      payload.relationships = relationships || undefined
      payload.habits = habits || undefined
    }

    const { data, error: err } = await supabase.from('diary_entries').insert(payload).select().single()
    if (err) { setError('Erro ao salvar. Tente novamente.'); setSaving(false); return }
    if (data) setEntries(prev => [data, ...prev])
    resetForm()
    setShowForm(false)
    setSaving(false)
    if (onClearPromptContext) onClearPromptContext()
  }

  const filteredEntries = entries.filter(e =>
    filter === 'all' ? true : filter === 'diary' ? e.entry_type === 'diary' : e.entry_type === 'questionnaire'
  )

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-sage-800">Meu Diário</h1>
          <p className="text-sage-500 text-sm mt-1">{entries.length} registros</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchEntries} className="p-2 text-sage-400 hover:text-sage-600">
            <RefreshCw className="w-4 h-4" />
          </button>
          {isEssential && (
            <button
              onClick={() => window.print()}
              title="Exportar como PDF"
              className="flex items-center gap-1 p-2 text-sage-400 hover:text-sage-600"
            >
              <FileDown className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => { if (!freeAtLimit) setShowForm(!showForm) }}
            disabled={freeAtLimit}
            className="flex items-center gap-2 bg-sage-600 hover:bg-sage-700 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Nova entrada
          </button>
        </div>
      </div>

      {/* Free plan usage counter */}
      {plan === 'free' && (
        <div className="bg-sand-50 border border-sand-200 rounded-xl p-4 mb-4">
          <div className="flex justify-between text-xs text-sage-600 mb-2">
            <span>{freeEntryCount} de {freeEntryLimit} entradas usadas neste mês</span>
            <span>{freeEntryLimit - freeEntryCount} restantes</span>
          </div>
          <div className="h-2 bg-sand-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${freeAtLimit ? 'bg-red-400' : 'bg-sage-400'}`}
              style={{ width: `${Math.min((freeEntryCount / freeEntryLimit) * 100, 100)}%` }}
            />
          </div>
          {freeAtLimit && (
            <p className="text-xs text-sage-600 mt-2">
              Você usou todas as entradas do mês. <button onClick={onNavigatePricing} className="text-purple-600 underline font-medium">Faça upgrade para continuar registrando.</button>
            </p>
          )}
        </div>
      )}

      {/* Guided prompt */}
      {prompt && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Lightbulb className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-purple-500 font-medium mb-1">Reflexão do dia</p>
            <p className="text-sm text-purple-700 italic">"{prompt}"</p>
          </div>
          <button onClick={fetchPrompt} className="text-purple-300 hover:text-purple-500 text-xs">↻</button>
        </div>
      )}

      {/* New entry form */}
      {showForm && !freeAtLimit && (
        <div className="bg-white border border-sand-200 rounded-xl p-5 mb-6 shadow-sm">
          <h3 className="font-serif text-lg text-sage-800 mb-5">Como você está hoje?</h3>

          {/* Prompt context from article */}
          {promptContext && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm text-emerald-700 font-medium mb-1">
                    Pergunta do artigo: <span className="italic">"{promptContext.articleTitle}"</span>
                  </p>
                  <p className="text-emerald-800 font-semibold">"{promptContext.prompt}"</p>
                  <p className="text-xs text-emerald-600 mt-2">Escreva sua resposta abaixo</p>
                </div>
                {onClearPromptContext && (
                  <button
                    onClick={onClearPromptContext}
                    className="text-emerald-400 hover:text-emerald-600 text-xs flex-shrink-0"
                    title="Limpar contexto"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mood selector */}
          <div className="mb-5">
            <p className="text-xs text-sage-600 mb-2 font-medium">Humor</p>
            <div className="flex gap-2 flex-wrap">
              {moodOptions.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMood(m.value)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all ${
                    mood === m.value ? 'bg-sage-600 text-white border-sage-600' : 'border-sand-200 text-sage-600 hover:bg-sage-50'
                  }`}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Free plan fields */}
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-sage-600 font-medium block mb-1">Qual emoção marcou meu dia?</label>
              <input
                type="text"
                value={mainEmotion}
                onChange={e => setMainEmotion(e.target.value)}
                placeholder="Ex.: alívio, frustração, nostalgia..."
                className="w-full border border-sand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div>
              <label className="text-xs text-sage-600 font-medium block mb-1">O que aconteceu?</label>
              <textarea
                value={whatHappened}
                onChange={e => setWhatHappened(e.target.value)}
                placeholder={prompt || 'Como foi o seu dia? O que você está sentindo?'}
                rows={3}
                className="w-full border border-sand-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div>
              <label className="text-xs text-sage-600 font-medium block mb-1">O que eu preciso agora?</label>
              <input
                type="text"
                value={whatINeed}
                onChange={e => setWhatINeed(e.target.value)}
                placeholder="Ex.: descanso, uma conversa, silêncio..."
                className="w-full border border-sand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div>
              <label className="text-xs text-sage-600 font-medium block mb-1">Uma coisa pequena que consegui fazer hoje foi…</label>
              <input
                type="text"
                value={smallThing}
                onChange={e => setSmallThing(e.target.value)}
                placeholder="Ex.: tomei água, saí de casa, respirei fundo..."
                className="w-full border border-sand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
          </div>

          {/* Essencial+ fields */}
          {isEssential && (
            <div className="border-t border-sand-100 pt-4 mt-4 space-y-4">
              <p className="text-xs text-sage-400 font-medium uppercase tracking-wider">Marcadores emocionais</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SliderField label="Humor (1-10)" value={moodScore} onChange={setMoodScore} />
                <SliderField label="Energia (1-10)" value={energy} onChange={setEnergy} />
                <SliderField label="Ansiedade (1-10)" value={anxietyLevel} onChange={setAnxietyLevel} />
                <SliderField label="Estresse (1-10)" value={stressLevel} onChange={setStressLevel} />
              </div>

              <div>
                <label className="text-xs text-sage-600 font-medium block mb-2">Tags emocionais</label>
                <div className="flex flex-wrap gap-2">
                  {emotionalTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        selectedTags.includes(tag)
                          ? 'bg-purple-500 text-white border-purple-500'
                          : 'border-sand-200 text-sage-600 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-sage-600 font-medium block mb-1">Gratidão</label>
                <input
                  type="text"
                  value={gratitude}
                  onChange={e => setGratitude(e.target.value)}
                  placeholder="Pelo que você é grato(a) hoje?"
                  className="w-full border border-sand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="text-xs text-sage-600 font-medium block mb-1">Pequeno orgulho do dia</label>
                <input
                  type="text"
                  value={smallPride}
                  onChange={e => setSmallPride(e.target.value)}
                  placeholder="Uma conquista pequena que você celebra..."
                  className="w-full border border-sand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="text-xs text-sage-600 font-medium block mb-1">Nota livre</label>
                <textarea
                  value={freeNote}
                  onChange={e => setFreeNote(e.target.value)}
                  placeholder="Escreva livremente o que quiser..."
                  rows={2}
                  className="w-full border border-sand-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
            </div>
          )}

          {/* Therapeutic+ fields */}
          {isTherapeutic && (
            <div className="border-t border-sand-100 pt-4 mt-4 space-y-4">
              <p className="text-xs text-sage-400 font-medium uppercase tracking-wider">Marcadores avançados</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SliderField label="Qualidade do sono (1-10)" value={sleepQuality} onChange={setSleepQuality} />
                <SliderField label="Autoestima (1-10)" value={selfEsteem} onChange={setSelfEsteem} />
                <SliderField label="Irritabilidade (1-10)" value={irritability} onChange={setIrritability} />
                <SliderField label="Sobrecarga (1-10)" value={overload} onChange={setOverload} />
              </div>
              <div>
                <label className="text-xs text-sage-600 font-medium block mb-1">Gatilhos emocionais</label>
                <textarea
                  value={emotionalTriggers}
                  onChange={e => setEmotionalTriggers(e.target.value)}
                  placeholder="O que desencadeou alguma emoção intensa hoje?"
                  rows={2}
                  className="w-full border border-sand-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="text-xs text-sage-600 font-medium block mb-1">Pensamentos recorrentes</label>
                <textarea
                  value={recurringThoughts}
                  onChange={e => setRecurringThoughts(e.target.value)}
                  placeholder="Algum pensamento que voltou várias vezes?"
                  rows={2}
                  className="w-full border border-sand-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="text-xs text-sage-600 font-medium block mb-1">Necessidade emocional principal</label>
                <input
                  type="text"
                  value={emotionalNeed}
                  onChange={e => setEmotionalNeed(e.target.value)}
                  placeholder="Ex.: ser ouvido(a), ter limites respeitados, descansar..."
                  className="w-full border border-sand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="text-xs text-sage-600 font-medium block mb-1">Relações e limites</label>
                <textarea
                  value={relationships}
                  onChange={e => setRelationships(e.target.value)}
                  placeholder="Como estão suas relações hoje? Algo relacionado a limites?"
                  rows={2}
                  className="w-full border border-sand-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="text-xs text-sage-600 font-medium block mb-1">Hábitos do dia</label>
                <input
                  type="text"
                  value={habits}
                  onChange={e => setHabits(e.target.value)}
                  placeholder="Ex.: dormi bem, me exercitei, tomei remédios..."
                  className="w-full border border-sand-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-xs mt-3">{error}</p>}

          <div className="flex gap-2 mt-5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-sage-600 hover:bg-sage-700 text-white text-sm px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar entrada'}
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm(); if (onClearPromptContext) onClearPromptContext() }}
              className="text-sage-500 text-sm px-4 py-2 rounded-lg hover:bg-sage-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'diary', 'questionnaire'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f ? 'bg-sage-600 text-white border-sage-600' : 'border-sand-200 text-sage-600 hover:bg-sage-50'
            }`}
          >
            {f === 'all' ? 'Tudo' : f === 'diary' ? 'Diário' : 'Avaliações'}
          </button>
        ))}
      </div>

      {/* Entries list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-sand-100 animate-pulse rounded-lg" />)}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-12 text-sage-400">
          <p className="mb-3">Nenhum registro ainda.</p>
          {!freeAtLimit && (
            <button onClick={() => setShowForm(true)} className="text-sage-600 font-medium text-sm hover:underline">
              Criar primeira entrada
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map(entry => {
            const moodObj = moodOptions.find(m => m.label === entry.mood || m.value === entry.mood)
            const isOpen = expanded === entry.id
            return (
              <div key={entry.id} className="bg-white border border-sand-100 rounded-xl overflow-hidden shadow-sm">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-sand-50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                >
                  <span className="text-xl">{moodObj?.emoji || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-sage-600">{entry.mood}</span>
                      {entry.entry_type === 'questionnaire' && (
                        <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Avaliação</span>
                      )}
                    </div>
                    <p className="text-xs text-sage-400 mt-0.5">{formatDate(entry.date ?? '')}</p>
                  </div>
                  <span className="text-xs text-sage-400 truncate max-w-[120px] hidden sm:block">{entry.text?.slice(0, 40)}...</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-sage-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-sage-400 flex-shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-sand-100">
                    <p className="text-sm text-sage-600 mt-3 leading-relaxed whitespace-pre-line">{entry.text}</p>
                    {(entry.energy !== undefined || entry.anxiety_level !== undefined) && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-sage-500">
                        {entry.energy !== undefined && <span>⚡ Energia: {entry.energy}/10</span>}
                        {entry.anxiety_level !== undefined && <span>😰 Ansiedade: {entry.anxiety_level}/10</span>}
                        {entry.stress_level !== undefined && <span>😤 Estresse: {entry.stress_level}/10</span>}
                        {entry.sleep_quality !== undefined && <span>💤 Sono: {entry.sleep_quality}/10</span>}
                        {entry.self_esteem !== undefined && <span>🌟 Autoestima: {entry.self_esteem}/10</span>}
                        {entry.irritability !== undefined && <span>😡 Irritabilidade: {entry.irritability}/10</span>}
                        {entry.overload !== undefined && <span>🎒 Sobrecarga: {entry.overload}/10</span>}
                      </div>
                    )}
                    {entry.emotional_tags && entry.emotional_tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.emotional_tags.map(tag => (
                          <span key={tag} className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                    {entry.emotional_triggers && (
                      <p className="text-xs text-sage-400 mt-2">Gatilhos: {entry.emotional_triggers}</p>
                    )}
                    {entry.gratitude && (
                      <p className="text-xs text-sage-500 mt-1">🙏 Gratidão: {entry.gratitude}</p>
                    )}
                    {entry.questionnaire_score !== undefined && (
                      <p className="text-xs text-purple-500 mt-2">
                        Pontuação: {entry.questionnaire_score} — {entry.questionnaire_category}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
