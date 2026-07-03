import { BookOpen, Plus } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

interface DiaryCardProps {
  onOpenDiary: () => void
  onNewEntry: () => void
  user: User | null
}

export default function DiaryCard({ onOpenDiary, onNewEntry, user }: DiaryCardProps) {
  if (!user) return null

  return (
    <section id="diary" className="max-w-6xl mx-auto px-4 py-8">
      <div className="relative rounded-2xl overflow-hidden group cursor-pointer" onClick={onOpenDiary}>
        <img
          src="https://images.pexels.com/photos/3807571/pexels-photo-3807571.jpeg?auto=compress&cs=tinysrgb&w=1200"
          alt="Diário de Bem-Estar"
          className="w-full h-56 md:h-64 object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sage-900/80 to-sage-900/30 flex items-center">
          <div className="px-8">
            <p className="text-sage-200 text-sm uppercase tracking-widest mb-2">Seu espaço</p>
            <h2 className="font-serif text-3xl md:text-4xl text-white mb-2">Diário de Bem-Estar</h2>
            <p className="text-sage-200 text-sm max-w-md">
              Registre como você está, acompanhe sua evolução e acesse meditações e avaliações.
            </p>
            <div className="flex items-center gap-2 mt-4 text-white text-sm font-medium">
              <BookOpen className="w-4 h-4" /> Abrir diário →
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-4">
        <button
          onClick={e => { e.stopPropagation(); onNewEntry() }}
          className="flex items-center gap-2 bg-sage-600 hover:bg-sage-700 text-white px-6 py-3 rounded-full text-sm font-medium transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" /> Nova Entrada no Diário
        </button>
      </div>
    </section>
  )
}
