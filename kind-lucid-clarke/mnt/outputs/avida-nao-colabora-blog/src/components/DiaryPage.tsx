import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { DiaryEntry, Plan } from '../types'
import { ArrowLeft, Plus, ChevronDown, ChevronUp, RefreshCw, Lightbulb } from 'lucide-react'

const moodOptions = [
  { value: 'ótimo', score: 10, emoji: '😄', color: 'text-green-500' },
  { value: 'bem', score: 8, emoji: '😊', color: 'text-sage-500' },
  { value: 'neutro', score: 5, emoji: '😐', color: 'text-sand-500' },
  { value: 'difícil', score: 3, emoji: '😔', color: 'text-ocean-400' },
  { value: 'muito difícil', score: 1, emoji: '😢', color: 'text-red-400' },
]

interface DiaryPageProps {
  user: any
  plan: Plan
  onBack: () => void
}

export default function DiaryPage({ user, plan, onBack }: DiaryPageProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'diary' | 'questionnaire'>('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [mood, setMood] = useState('neutro')
  const [text, setText] = useState('')
  const [sleep, setSleep] = useState(5)
  const [pain, setPain] = useState(0)
  const [foodCompulsion, setFoodCompulsion] = useState(0)
  const [triggers, setTriggers] = useState('')

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
    const planFilter = plan === 'therapeutic' ? ['free', 'essential', 'therapeutic'] : plan === 'essential' ? ['free', 'essential'] : ['free']
    const { data } = await supabase
      .from('guided_prompts')
      .select('text')
      .in('plan_level', planFilter)
      .or(`day_of_week.eq.${day},day_of_week.is.null`)
      .limit(20)
    if (data && data.length > 0) {
      setPrompt(data[Math.floor(Math.random() * data.length)].text)
    }
  }, [plan])

  useEffect(() => {
    fetchEntries()
    fetchPrompt()
  }, [fetchEntries, fetchPrompt])

  const handleSave = async () => {
    if (!text.trim()) { setError('Escreva algo antes de salvar.'); return }
    setSaving(true)
    setError('')
    const moodObj = moodOptions.find(m => m.value === mood) || moodOptions[2]
    const payload: any = {
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      mood,
      mood_score: moodObj.score,
      text,
      entry_type: 'diary',
    }
    if (plan === 'therapeutic') {
      payload.sleep_quality = sleep
      payload.pain_intensity = pain
      payload.food_compulsion = foodCompulsion
      payload.emotional_triggers = triggers
    }
    const { data, error: err } = await supabase.from('diary_entries').insert(payload).select().single()
    if (err) { setError('Erro ao salvar. Tente novamente.'); setSaving(false); return }
    if (data) setEntries(prev => [data, ...prev])
    setText(''); setMood('neutro'); setTriggers(''); setShowForm(false)
    setSaving(false)
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
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-sage-600 hover:bg-sage-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova entrada
          </button>
        </div>
      </div>

      {/* Guided prompt */}
      {prompt && (
        <div className="bg-ocean-50 border border-ocean-100 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Lightbulb className="w-4 h-4 text-ocean-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-ocean-500 font-medium mb-1">Reflexão do dia</p>
            <p className="text-sm text-ocean-700 italic">"{prompt}"</p>
          </div>
          <button onClick={fetchPrompt} className="text-ocean-300 hover:text-ocean-500 text-xs">↻</button>
        </div>
      )}

      {/* New entry form */}
      {showForm && (
        <div className="bg-white border border-sand-200 rounded-xl p-5 mb-6 shadow-sm">
          <h3 className="font-serif text-lg text-sage-800 mb-4">Como você está?</h3>

          <div className="mb-4">
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
                  {m.emoji} {m.value}
                </button>
              ))}
            </div>
          </div>

          {plan === 'therapeutic' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-sage-600 font-medium block mb-1">Qualidade do Sono (0-10)</label>
                <input type="range" min={0} max={10} value={sleep} onChange={e => setSleep(+e.target.value)} className="w-full accent-sage-600" />
                <span className="text-xs text-sage-400">{sleep}/10</span>
              </div>
              <div>
                <label className="text-xs text-sage-600 font-medium block mb-1">Intensidade da Dor (0-10)</label>
                <input type="range" min={0} max={10} value={pain} onChange={e => setPain(+e.target.value)} className="w-full accent-sage-600" />
                <span className="text-xs text-sage-400">{pain}/10</span>
              </div>
              <div>
                <label className="text-xs text-sage-600 font-medium block mb-1">Compulsão Alimentar (0-10)</label>
                <input type="range" min={0} max={10} value={foodCompulsion} onChange={e => setFoodCompulsion(+e.target.value)} className="w-full accent-sage-600" />
                <span className="text-xs text-sage-400">{foodCompulsion}/10</span>
              </div>
            </div>
          )}

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={prompt || 'Como foi o seu dia? O que você está sentindo?'}
            rows={4}
            className="w-full border border-sand-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sage-300 mb-3"
          />

          {plan === 'therapeutic' && (
            <input
              type="text"
              value={triggers}
              onChange={e => setTriggers(e.target.value)}
              placeholder="Gatilhos emocionais (opcional)"
              className="w-full border border-sand-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-sage-300"
            />
          )}

          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-sage-600 hover:bg-sage-700 text-white text-sm px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
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
          <button onClick={() => setShowForm(true)} className="text-sage-600 font-medium text-sm hover:underline">
            Criar primeira entrada
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map(entry => {
            const moodObj = moodOptions.find(m => m.value === entry.mood)
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
                      <span className={`text-xs font-medium ${moodObj?.color || 'text-sage-500'}`}>{entry.mood}</span>
                      {entry.entry_type === 'questionnaire' && (
                        <span className="text-xs bg-ocean-100 text-ocean-600 px-2 py-0.5 rounded-full">Avaliação</span>
                      )}
                    </div>
                    <p className="text-xs text-sage-400 mt-0.5">{formatDate(entry.date)}</p>
                  </div>
                  <span className="text-xs text-sage-400 truncate max-w-[120px] hidden sm:block">{entry.text?.slice(0, 40)}...</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-sage-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-sage-400 flex-shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-sand-100">
                    <p className="text-sm text-sage-600 mt-3 leading-relaxed">{entry.text}</p>
                    {entry.sleep_quality !== undefined && entry.sleep_quality !== null && (
                      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-sage-500">
                        <span>💤 Sono: {entry.sleep_quality}/10</span>
                        <span>🩹 Dor: {entry.pain_intensity}/10</span>
                        <span>🍽️ Compulsão: {entry.food_compulsion}/10</span>
                      </div>
                    )}
                    {entry.emotional_triggers && (
                      <p className="text-xs text-sage-400 mt-2">Gatilhos: {entry.emotional_triggers}</p>
                    )}
                    {entry.questionnaire_score !== undefined && (
                      <p className="text-xs text-ocean-500 mt-2">
                        Pontuação: {entry.questionnaire_score}/40 — {entry.questionnaire_category}
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
