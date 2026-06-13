import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { GuidedMeditation } from '../types'
import { Moon, ArrowLeft, Clock } from 'lucide-react'

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

interface GuidedMeditationsProps {
  onBack: () => void
}

export default function GuidedMeditations({ onBack }: GuidedMeditationsProps) {
  const [meditations, setMeditations] = useState<GuidedMeditation[]>([])
  const [selected, setSelected] = useState<GuidedMeditation | null>(null)
  const [loading, setLoading] = useState(true)

  const today = new Date().getDay()

  useEffect(() => {
    supabase
      .from('guided_meditations')
      .select('*')
      .order('day_of_week')
      .then(({ data }) => { setMeditations(data || []); setLoading(false) })
  }, [])

  if (selected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar às meditações
        </button>
        <div className="bg-white rounded-2xl border border-sand-100 shadow-sm p-8">
          <div className="flex items-center gap-2 mb-2">
            <Moon className="w-5 h-5 text-ocean-400" />
            <span className="text-xs text-ocean-500">{dayNames[selected.day_of_week]}</span>
          </div>
          <h2 className="font-serif text-3xl text-sage-800 mb-1">{selected.title}</h2>
          <p className="text-sage-500 text-sm mb-6">{selected.subtitle}</p>
          <div className="prose prose-sage">
            {selected.content.split('\n').map((line, i) =>
              line === '' ? <br key={i} /> : <p key={i} className="text-sage-600 leading-relaxed mb-3">{line}</p>
            )}
          </div>
          <div className="mt-6 flex items-center gap-2 text-sage-400 text-xs">
            <Clock className="w-3.5 h-3.5" /> {selected.duration_minutes} minutos
          </div>
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
        <Moon className="w-8 h-8 text-ocean-400 mx-auto mb-3" />
        <h1 className="font-serif text-4xl text-sage-800 mb-2">Meditações Guiadas</h1>
        <p className="text-sage-500 text-sm">Uma meditação para cada dia da semana. Hoje é {dayNames[today]}.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-sand-100 animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meditations.map(m => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className={`text-left p-5 rounded-xl border transition-all shadow-sm hover:shadow-md ${
                m.day_of_week === today
                  ? 'bg-ocean-50 border-ocean-200 ring-2 ring-ocean-100'
                  : 'bg-white border-sand-100 hover:border-sage-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  m.day_of_week === today ? 'bg-ocean-100 text-ocean-600' : 'bg-sage-50 text-sage-500'
                }`}>
                  {dayNames[m.day_of_week]}
                  {m.day_of_week === today && ' ← Hoje'}
                </span>
                <span className="text-xs text-sage-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {m.duration_minutes}min
                </span>
              </div>
              <h3 className="font-serif text-lg text-sage-800 mb-1">{m.title}</h3>
              <p className="text-sage-500 text-xs">{m.subtitle}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
