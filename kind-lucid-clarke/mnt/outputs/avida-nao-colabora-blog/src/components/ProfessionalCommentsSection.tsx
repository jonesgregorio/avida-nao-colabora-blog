import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Star, Loader2, BookOpen } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

interface Props {
  user: User | null
  profile: Profile | null
  onNavigateDiary?: () => void
  onNavigatePricing?: () => void
}

interface Comment {
  id: string
  comment_text: string
  comment?: string
  report_month: string
  professional_name: string | null
  created_at: string
}

function monthLabel(iso: string) {
  const [year, month] = iso.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function ProfessionalCommentsSection({ user, profile, onNavigateDiary, onNavigatePricing }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  const allowed = profile?.plan === 'therapeutic-plus'

  useEffect(() => {
    if (!user || !allowed) { setLoading(false); return }
    supabase
      .from('professional_comments')
      .select('id,comment_text,comment,report_month,professional_name,created_at')
      .eq('user_id', user.id)
      .order('report_month', { ascending: false })
      .then(({ data }) => {
        setComments(((data as Comment[]) ?? []).map(c => ({
          ...c,
          comment_text: c.comment_text || c.comment || '',
        })))
        setLoading(false)
      })
  }, [user])

  if (!allowed) {
    return (
      <div className="bg-white border border-stone-100 rounded-2xl p-6 text-center">
        <Star className="w-8 h-8 text-stone-200 mx-auto mb-3" />
        <p className="text-sm font-semibold text-sage-800 mb-1">Comentário individual do profissional</p>
        <p className="text-xs text-sage-500 mb-4">Disponível no plano Terapêutico Plus — um comentário personalizado sobre seu relatório mensal.</p>
        {onNavigatePricing && (
          <button onClick={onNavigatePricing} className="text-xs text-purple-600 hover:underline font-medium">Ver planos</button>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="bg-white border border-stone-100 rounded-2xl p-6 text-center">
        <Star className="w-8 h-8 text-stone-200 mx-auto mb-3" />
        <p className="text-sm font-semibold text-sage-800 mb-1">Nenhum comentário ainda</p>
        <p className="text-xs text-sage-500">Seu comentário mensal do profissional aparecerá aqui após o primeiro relatório.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-sage-700 flex items-center gap-2">
        <Star className="w-4 h-4 text-purple-400" />
        Comentários do profissional
      </h3>
      {comments.map(c => (
        <div key={c.id} className="bg-white border border-purple-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold text-purple-700 capitalize">{monthLabel(c.report_month)}</p>
              {c.professional_name && (
                <p className="text-[10px] text-stone-400 mt-0.5">{c.professional_name}</p>
              )}
            </div>
            <span className="text-[10px] text-stone-400 flex-shrink-0">
              {new Date(c.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <p className="text-sm text-sage-700 leading-relaxed whitespace-pre-wrap">{c.comment_text}</p>
          {onNavigateDiary && (
            <button
              onClick={onNavigateDiary}
              className="mt-3 flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Responder no diário
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
