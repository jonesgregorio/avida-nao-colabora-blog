import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { CalendarDays, Check, Leaf, X } from 'lucide-react'
import LoggedHomeLegacy from './LoggedHomeLegacy'
import { MOODS } from './user/moods'
import { MoodChip } from './user/ui'

interface LoggedHomeProps { user: User | null; profile: Profile | null; onNavigate: (section: string, articleSlug?: string) => void }
const COLLABORATION = [{ score: 1, emoji: '😣', label: 'Nem um pouco' }, { score: 2, emoji: '😕', label: 'Fez o mínimo' }, { score: 3, emoji: '😐', label: 'Sobrevivemos' }, { score: 4, emoji: '🙂', label: 'Até que tentou' }, { score: 5, emoji: '😄', label: 'Colaborou' }] as const
const MAX_CUSTOM_TAGS = 5
const MAX_CUSTOM_TAG_LENGTH = 24

function todayKey() {
  const date = new Date()
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}
function todayLabel() { return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()) }
function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite' }
type CollaborationRow = { score: number; feeling_tags?: string[] | null; custom_tags?: string[] | null }

export default function LoggedHome({ user, profile, onNavigate }: LoggedHomeProps) {
  const name = profile?.preferred_name || profile?.display_name || profile?.full_name?.split(' ')[0] || 'você'
  const [score, setScore] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsSaved, setDetailsSaved] = useState(false)
  const [showFeelings, setShowFeelings] = useState(false)
  const [showCustomTag, setShowCustomTag] = useState(false)
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([])
  const [customTags, setCustomTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    void supabase.from('daily_life_collaboration').select('score,feeling_tags,custom_tags').eq('user_id', user.id).eq('date', todayKey()).maybeSingle().then(({ data }) => {
      const row = data as unknown as CollaborationRow | null
      if (!active) return
      setScore(typeof row?.score === 'number' ? row.score : null)
      setSelectedFeelings(Array.isArray(row?.feeling_tags) ? row.feeling_tags : [])
      setCustomTags(Array.isArray(row?.custom_tags) ? row.custom_tags : [])
    })
    return () => { active = false }
  }, [user])

  async function chooseScore(nextScore: number) {
    if (!user || saving) return
    const previous = score
    setScore(nextScore)
    setSaving(true)
    setDetailsSaved(false)
    const payload = { user_id: user.id, date: todayKey(), score: nextScore, updated_at: new Date().toISOString() } as never
    const { error } = await supabase.from('daily_life_collaboration').upsert(payload, { onConflict: 'user_id,date' })
    if (error) setScore(previous)
    else setShowFeelings(true)
    setSaving(false)
  }

  function toggleFeeling(key: string) {
    setDetailsSaved(false)
    setSelectedFeelings(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }

  function addCustomTag() {
    const tag = customTagInput.trim().replace(/\s+/g, ' ').slice(0, MAX_CUSTOM_TAG_LENGTH)
    if (!tag || customTags.length >= MAX_CUSTOM_TAGS) return
    const duplicate = customTags.some(item => item.toLocaleLowerCase('pt-BR') === tag.toLocaleLowerCase('pt-BR'))
    if (duplicate) {
      setCustomTagInput('')
      return
    }
    setDetailsSaved(false)
    setCustomTags(current => [...current, tag])
    setCustomTagInput('')
  }

  function removeCustomTag(tag: string) {
    setDetailsSaved(false)
    setCustomTags(current => current.filter(item => item !== tag))
  }

  async function saveCheckinDetails() {
    if (!user || score == null || savingDetails) return
    setSavingDetails(true)
    const payload = {
      user_id: user.id,
      date: todayKey(),
      score,
      feeling_tags: selectedFeelings,
      custom_tags: customTags,
      updated_at: new Date().toISOString(),
    } as never
    const { error } = await supabase.from('daily_life_collaboration').upsert(payload, { onConflict: 'user_id,date' })
    setDetailsSaved(!error)
    setSavingDetails(false)
  }

  const selected = COLLABORATION.find(item => item.score === score)
  const featuredMoodKeys = new Set(['bem_estar', 'tranquilidade', 'cansaco', 'ansiedade', 'sobrecarga', 'tristeza', 'irritacao'])
  const featuredMoods = MOODS.filter(mood => featuredMoodKeys.has(mood.key))

  return <>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 lg:pt-8">
      <section className="relative overflow-hidden rounded-[30px] border border-line bg-gradient-to-br from-mint via-paper-soft to-sand-50 p-5 sm:p-7 lg:p-8">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/50 blur-2xl" aria-hidden />
        <div className="relative max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft mb-4">
            <span className="inline-flex items-center gap-1.5 bg-white/70 border border-line rounded-full px-3 py-1.5 capitalize"><CalendarDays className="w-3.5 h-3.5 text-forest-600" /> {todayLabel()}</span>
            <span className="inline-flex items-center gap-1.5"><Leaf className="w-3.5 h-3.5 text-forest-500" /> Seu espaço de hoje</span>
          </div>

          <p className="text-sm font-medium text-forest-700">{greeting()}, <span className="capitalize">{name}</span>.</p>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] leading-[1.08] text-forest-900 mt-1.5">E aí, a vida colaborou hoje?</h1>
          <p className="text-sm sm:text-base text-ink-soft mt-3 max-w-2xl leading-relaxed">Escolha o que chega mais perto do seu dia. Você pode seguir sem explicar nada.</p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-6" aria-label="Quanto a vida colaborou hoje">
            {COLLABORATION.map(item => {
              const active = score === item.score
              return <button key={item.score} type="button" disabled={saving} onClick={() => void chooseScore(item.score)} aria-pressed={active} className={`relative rounded-2xl border px-3 py-4 text-center transition-all ${active ? 'border-forest-900 bg-forest-900 text-white shadow-sm' : 'border-line bg-white/80 text-forest-900 hover:border-forest-300 hover:bg-white'} disabled:opacity-60`}>
                {active && <Check className="absolute right-2 top-2 w-3.5 h-3.5" />}
                <span className="block text-2xl" aria-hidden>{item.emoji}</span>
                <span className="block text-sm font-medium mt-1.5">{item.label}</span>
              </button>
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => setShowFeelings(value => !value)} className="rounded-2xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white">Registrar meu check-in</button>
            <button type="button" onClick={() => onNavigate('diary')} className="rounded-2xl border border-line bg-white/85 px-4 py-2.5 text-sm font-medium text-forest-800">Quero escrever no diário</button>
            {selected && <span className="text-xs text-ink-soft sm:ml-1">Hoje: {selected.emoji} {selected.label}</span>}
          </div>

          {showFeelings && <div className="mt-4 rounded-2xl border border-white bg-white/65 p-4">
            <p className="text-sm font-semibold text-forest-900">Como isso apareceu em você?</p>
            <p className="text-xs text-ink-soft mt-1">Opcional. Escolha quantas tags fizerem sentido. O check-in continua rápido e sem texto longo.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {featuredMoods.map(mood => <MoodChip key={mood.key} mood={mood} active={selectedFeelings.includes(mood.key)} onClick={() => toggleFeeling(mood.key)} />)}
              <button type="button" onClick={() => setShowCustomTag(value => !value)} className="inline-flex items-center rounded-full border border-dashed border-forest-300 bg-white px-3.5 py-2 text-sm font-medium text-forest-800 hover:bg-mint/40">+ Outro</button>
            </div>

            {customTags.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Tags personalizadas">
              {customTags.map(tag => <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-soft px-3 py-1.5 text-sm text-forest-800">{tag}<button type="button" onClick={() => removeCustomTag(tag)} aria-label={`Remover tag ${tag}`} className="rounded-full p-0.5 text-ink-soft hover:text-forest-900"><X className="h-3.5 w-3.5" /></button></span>)}
            </div>}

            {showCustomTag && <div className="mt-3 flex flex-col sm:flex-row gap-2 max-w-xl">
              <div className="flex-1">
                <label htmlFor="home-checkin-custom-tag" className="sr-only">Outra tag</label>
                <input id="home-checkin-custom-tag" value={customTagInput} maxLength={MAX_CUSTOM_TAG_LENGTH} onChange={event => setCustomTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCustomTag() } }} placeholder="Ex.: desânimo, saudade, alívio" className="w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-100" />
                <p className="mt-1 text-[11px] text-ink-soft">Até {MAX_CUSTOM_TAGS} tags personalizadas, com no máximo {MAX_CUSTOM_TAG_LENGTH} caracteres cada.</p>
              </div>
              <button type="button" onClick={addCustomTag} disabled={!customTagInput.trim() || customTags.length >= MAX_CUSTOM_TAGS} className="h-fit rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-forest-900 disabled:opacity-50">Adicionar</button>
            </div>}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void saveCheckinDetails()} disabled={score == null || savingDetails} className="rounded-2xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{savingDetails ? 'Salvando…' : 'Salvar meu check-in'}</button>
              {score == null && <span className="text-xs text-ink-soft">Escolha primeiro como a vida colaborou hoje.</span>}
              {detailsSaved && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-700"><Check className="h-3.5 w-3.5" /> Check-in salvo</span>}
            </div>
          </div>}
        </div>
      </section>
    </div>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6">
      <section className="rounded-3xl border border-line bg-white overflow-hidden">
        <button type="button" onClick={() => setDetailsOpen(value => !value)} aria-expanded={detailsOpen} className="w-full text-left p-5 sm:p-6 flex items-start sm:items-center justify-between gap-4 hover:bg-mint/20 transition-colors">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Quando quiser olhar com mais distância</p>
            <h2 className="font-serif text-xl sm:text-2xl text-forest-900 mt-1">Olhar minha semana</h2>
            <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-3xl">Continuidade, descobertas, foco e conteúdos continuam aqui — mas só aparecem quando você quiser aprofundar.</p>
          </div>
          <span className="w-10 h-10 rounded-2xl bg-mint text-forest-700 flex items-center justify-center flex-shrink-0"><CalendarDays className="w-5 h-5" /></span>
        </button>
        {detailsOpen && <div className="border-t border-line">
          <style>{`.avnc-legacy-home > div > section:first-child { display: none !important; } .avnc-legacy-home > div { padding-top: 1rem !important; }`}</style>
          <div className="avnc-legacy-home"><LoggedHomeLegacy user={user} profile={profile} onNavigate={onNavigate} /></div>
        </div>}
      </section>
    </div>
  </>
}
