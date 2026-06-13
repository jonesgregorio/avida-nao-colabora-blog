import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MiniChallenge } from '../types'
import { Trophy, ArrowLeft, ChevronRight, Star } from 'lucide-react'

interface MiniChallengesProps {
  onBack: () => void
}

export default function MiniChallenges({ onBack }: MiniChallengesProps) {
  const [challenges, setChallenges] = useState<MiniChallenge[]>([])
  const [selected, setSelected] = useState<MiniChallenge | null>(null)
  const [activeDay, setActiveDay] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('mini_challenges')
      .select('*')
      .then(({ data }) => { setChallenges(data || []); setLoading(false) })
  }, [])

  if (selected) {
    const day = selected.days[activeDay - 1]
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar aos desafios
        </button>

        <div className="bg-white rounded-2xl border border-sand-100 shadow-sm overflow-hidden">
          <div className="bg-sage-600 px-6 py-5 text-white">
            <h2 className="font-serif text-2xl mb-1">{selected.title}</h2>
            <p className="text-sage-200 text-sm">{selected.description}</p>
          </div>

          {/* Day selector */}
          <div className="flex overflow-x-auto px-4 py-3 gap-2 border-b border-sand-100">
            {selected.days.map(d => (
              <button
                key={d.day}
                onClick={() => setActiveDay(d.day)}
                className={`flex-shrink-0 w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                  activeDay === d.day
                    ? 'bg-sage-600 text-white'
                    : 'bg-sand-50 text-sage-500 hover:bg-sage-50'
                }`}
              >
                {d.day}
              </button>
            ))}
          </div>

          {/* Day content */}
          {day && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-sand-400" />
                <span className="text-xs text-sage-400 font-medium uppercase tracking-wide">Dia {day.day}</span>
              </div>
              <h3 className="font-serif text-2xl text-sage-800 mb-2">{day.title}</h3>
              <p className="text-sage-600 text-sm mb-4 leading-relaxed">{day.description}</p>

              <div className="bg-sage-50 rounded-xl p-4 mb-4">
                <p className="text-xs text-sage-500 font-medium uppercase tracking-wide mb-2">Atividade do dia</p>
                <p className="text-sage-700 text-sm leading-relaxed">{day.activity}</p>
              </div>

              <div className="bg-sand-50 rounded-xl p-4">
                <p className="text-xs text-sand-500 font-medium uppercase tracking-wide mb-2">💡 Dica</p>
                <p className="text-sage-600 text-sm leading-relaxed italic">{day.tip}</p>
              </div>

              <div className="flex justify-between mt-6">
                <button
                  onClick={() => setActiveDay(d => Math.max(1, d - 1))}
                  disabled={activeDay === 1}
                  className="text-sm text-sage-500 disabled:opacity-40 hover:text-sage-700"
                >
                  ← Dia anterior
                </button>
                <button
                  onClick={() => setActiveDay(d => Math.min(selected.duration_days, d + 1))}
                  disabled={activeDay === selected.duration_days}
                  className="text-sm text-sage-600 font-medium hover:text-sage-800 disabled:opacity-40"
                >
                  Próximo dia →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="text-center mb-10">
        <Trophy className="w-8 h-8 text-sand-400 mx-auto mb-3" />
        <h1 className="font-serif text-4xl text-sage-800 mb-2">Mini-Desafios</h1>
        <p className="text-sage-500 text-sm">Pequenas práticas diárias para grandes transformações.</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-sand-100 animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {challenges.map(c => (
            <button
              key={c.id}
              onClick={() => { setSelected(c); setActiveDay(1) }}
              className="text-left bg-white border border-sand-100 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-sage-200 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs bg-sage-50 text-sage-500 px-2 py-0.5 rounded-full">{c.duration_days} dias</span>
                <ChevronRight className="w-4 h-4 text-sage-300 group-hover:text-sage-500 transition-colors" />
              </div>
              <h3 className="font-serif text-xl text-sage-800 mb-1">{c.title}</h3>
              <p className="text-sage-500 text-sm">{c.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
