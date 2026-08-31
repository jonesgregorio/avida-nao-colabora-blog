import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { CalendarDays, Check, Leaf } from 'lucide-react'
import LoggedHomeLegacy from './LoggedHomeLegacy'
import { MOODS } from './user/moods'
import { MoodChip } from './user/ui'

interface LoggedHomeProps { user: User | null; profile: Profile | null; onNavigate: (section: string, articleSlug?: string) => void }
const COLLABORATION = [{ score: 1, emoji: '😣', label: 'Nem um pouco' }, { score: 2, emoji: '😕', label: 'Fez o mínimo' }, { score: 3, emoji: '😐', label: 'Sobrevivemos' }, { score: 4, emoji: '🙂', label: 'Até que tentou' }, { score: 5, emoji: '😄', label: 'Colaborou' }] as const
function todayKey() {
  const date = new Date()
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}
function todayLabel() { return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()) }
function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite' }
type CollaborationRow = { score: number }

export default function LoggedHome({ user, profile, onNavigate }: LoggedHomeProps) {
  const name = profile?.preferred_name || profile?.display_name || profile?.full_name?.split(' ')[0] || 'você'
  const [score, setScore] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [showFeelings, setShowFeelings] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  useEffect(() => {
    if (!user) return
    let active = true
    void supabase.from('daily_life_collaboration').select('score').eq('user_id', user.id).eq('date', todayKey()).maybeSingle().then(({ data }) => {
      const row = data as unknown as CollaborationRow | null
      if (active) setScore(typeof row?.score === 'number' ? row.score : null)
    })
    return () => { active = false }
  }, [user])
  async function chooseScore(nextScore: number) {
    if (!user || saving) return
    const previous = score
    setScore(nextScore)
    setSaving(true)
    const payload = { user_id: user.id, date: todayKey(), score: nextScore, updated_at: new Date().toISOString() } as never
    const { error } = await supabase.from('daily_life_collaboration').upsert(payload, { onConflict: 'user_id,date' })
    if (error) setScore(previous)
    else setShowFeelings(true)
    setSaving(false)
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
            <button type="button" onClick={() => setShowFeelings(value => !value)} className="rounded-2xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white">Registrar como estou</button>
            <button type="button" onClick={() => onNavigate('diary')} className="rounded-2xl border border-line bg-white/85 px-4 py-2.5 text-sm font-medium text-forest-800">Quero escrever</button>
            {selected && <span className="text-xs text-ink-soft sm:ml-1">Hoje: {selected.emoji} {selected.label}</span>}
          </div>

          {showFeelings && <div className="mt-4 rounded-2xl border border-white bg-white/65 p-4">
            <p className="text-sm font-semibold text-forest-900">Como isso apareceu em você?</p>
            <p className="text-xs text-ink-soft mt-1">Opcional. Escolha apenas se ajudar a dar contexto ao seu momento.</p>
            <div className="flex flex-wrap gap-2 mt-3">{featuredMoods.map(mood => <MoodChip key={mood.key} mood={mood} active={false} onClick={() => onNavigate(`diary?mood=${mood.key}`)} />)}</div>
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
