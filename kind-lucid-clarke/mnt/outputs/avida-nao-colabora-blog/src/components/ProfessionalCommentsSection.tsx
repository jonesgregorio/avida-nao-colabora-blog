import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Star, Loader2, BookOpen, Info } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { normalizePlan } from '../lib/officialPlans'

// Comentário profissional foi descontinuado como recurso comercial ativo do
// Plus. Esta tela deixou de oferecer/gerar novos comentários; ela só existe
// para preservar o acesso a comentários já enviados no passado (histórico) e
// para não quebrar a URL antiga (/comentarios-profissional).

interface Props {
  user: User | null
  profile: Profile | null
  onNavigateDiary?: () => void
  onNavigateGuidance?: () => void
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

function DiscontinuedNotice({ onNavigateGuidance }: { onNavigateGuidance?: () => void }) {
  return (
    <div className="bg-white border border-stone-100 rounded-2xl p-5 flex items-start gap-3">
      <Info className="w-5 h-5 text-stone-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-forest-800">Este recurso foi descontinuado</p>
        <p className="text-xs text-forest-500 mt-1">
          O comentário individual do profissional não é mais gerado para novos relatórios. Comentários enviados anteriormente continuam disponíveis abaixo.
        </p>
        {onNavigateGuidance && (
          <button onClick={onNavigateGuidance} className="text-xs text-forest-700 hover:underline font-medium mt-2">
            Conhecer a Orientação Mensal
          </button>
        )}
      </div>
    </div>
  )
}

export default function ProfessionalCommentsSection({ user, profile, onNavigateDiary, onNavigateGuidance }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  const allowed = normalizePlan(profile?.plan) === 'plus'

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (!allowed) {
    return <DiscontinuedNotice onNavigateGuidance={onNavigateGuidance} />
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 text-forest-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DiscontinuedNotice onNavigateGuidance={onNavigateGuidance} />
      {comments.length > 0 && (
        <h3 className="text-sm font-semibold text-forest-700 flex items-center gap-2">
          <Star className="w-4 h-4 text-forest-400" />
          Comentários recebidos anteriormente
        </h3>
      )}
      {comments.map(c => (
        <div key={c.id} className="bg-white border border-forest-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold text-forest-700 capitalize">{monthLabel(c.report_month)}</p>
              {c.professional_name && (
                <p className="text-[10px] text-stone-400 mt-0.5">{c.professional_name}</p>
              )}
            </div>
            <span className="text-[10px] text-stone-400 flex-shrink-0">
              {new Date(c.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <p className="text-sm text-forest-700 leading-relaxed whitespace-pre-wrap">{c.comment_text}</p>
          {onNavigateDiary && (
            <button
              onClick={onNavigateDiary}
              className="mt-3 flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-900 font-medium transition-colors"
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
