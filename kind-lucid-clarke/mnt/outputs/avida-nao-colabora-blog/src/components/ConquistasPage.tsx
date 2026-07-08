import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { Trophy, Flame, Sprout, BookOpen, Bookmark, Award, Lock, CheckCircle2 } from 'lucide-react'

interface Props {
  user: User | null
  profile: Profile | null
  onNavigate: (v: string) => void
}

// Conquistas derivadas de dados reais do usuário (sem números inventados).
export default function ConquistasPage({ user, onNavigate }: Props) {
  const [stats, setStats] = useState({ entries: 0, streak: 0, questionnaires: 0, saved: 0, loaded: false })

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const [entriesRes, savedRes, qRes] = await Promise.all([
        supabase.from('diary_entries').select('date,entry_type').eq('user_id', user.id),
        supabase.from('saved_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('questionnaire_responses').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'completed'),
      ])
      if (!active) return
      const diary = (entriesRes.data ?? []).filter(e => (e as { entry_type?: string }).entry_type === 'diary')
      const days = new Set(diary.map(e => String((e as { date?: string }).date ?? '').slice(0, 10)))
      const d = new Date()
      if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1)
      let streak = 0
      while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1) }
      setStats({ entries: diary.length, streak, questionnaires: qRes.count ?? 0, saved: savedRes.count ?? 0, loaded: true })
    })()
    return () => { active = false }
  }, [user])

  const achievements = [
    { key: 'first',     Icon: Sprout,   title: 'Primeiro passo',        desc: 'Fez seu primeiro registro no diário.', value: stats.entries,        goal: 1 },
    { key: 'streak7',   Icon: Flame,    title: 'Constância',            desc: '7 dias seguidos de diário.',           value: stats.streak,         goal: 7 },
    { key: 'quest',     Icon: Award,    title: 'Autoconhecimento',      desc: 'Concluiu um questionário.',            value: stats.questionnaires, goal: 1 },
    { key: 'saved3',    Icon: Bookmark, title: 'Curadoria do cuidado',  desc: 'Salvou 3 conteúdos.',                  value: stats.saved,          goal: 3 },
    { key: 'entries30', Icon: BookOpen, title: 'Reflexão profunda',     desc: '30 registros no diário.',              value: stats.entries,        goal: 30 },
    { key: 'streak30',  Icon: Trophy,   title: 'Presença',              desc: '30 dias seguidos de diário.',          value: stats.streak,         goal: 30 },
  ]
  const unlocked = achievements.filter(a => a.value >= a.goal).length

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">
          Conquistas <Trophy className="w-6 h-6 text-forest-400" />
        </h1>
        <p className="mt-2 text-ink-soft">
          Pequenos passos que merecem ser celebrados.{stats.loaded && ` ${unlocked} de ${achievements.length} conquistas.`}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {achievements.map(a => {
          const done = a.value >= a.goal
          const progress = Math.min(a.value, a.goal)
          return (
            <div key={a.key} className={`rounded-3xl border p-5 ${done ? 'bg-mint/40 border-forest-200' : 'bg-paper-soft border-line'}`}>
              <div className="flex items-center justify-between">
                <span className={`w-11 h-11 rounded-full flex items-center justify-center ${done ? 'bg-forest-900 text-white' : 'bg-mint text-forest-500'}`}>
                  <a.Icon className="w-5 h-5" />
                </span>
                {done ? <CheckCircle2 className="w-5 h-5 text-forest-600" /> : <Lock className="w-4 h-4 text-ink-soft/40" />}
              </div>
              <p className="font-serif text-lg text-forest-900 mt-3">{a.title}</p>
              <p className="text-sm text-ink-soft mt-1 leading-relaxed">{a.desc}</p>
              {!done && (
                <div className="mt-3">
                  <div className="h-1.5 bg-mint rounded-full overflow-hidden">
                    <div className="h-full bg-forest-500 rounded-full transition-all" style={{ width: `${(progress / a.goal) * 100}%` }} />
                  </div>
                  <p className="text-[11px] text-ink-soft mt-1">{progress} de {a.goal}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-line bg-mint/40 px-5 sm:px-6 py-4 flex items-center gap-4">
        <span className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0 text-forest-600"><Sprout className="w-5 h-5" /></span>
        <p className="text-sm text-forest-800 leading-relaxed">
          Cada conquista é um lembrete de que você está cuidando de você. Siga no seu ritmo.{' '}
          <button onClick={() => onNavigate('diary')} className="text-forest-700 underline font-medium">Registrar hoje</button>
        </p>
      </div>
    </div>
  )
}
