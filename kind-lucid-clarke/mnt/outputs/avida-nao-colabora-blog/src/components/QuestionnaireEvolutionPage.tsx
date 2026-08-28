import { useEffect, useState } from 'react'
import { ArrowLeft, TrendingUp, HelpCircle } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  formatCompletionLabels, describeQuestionnaireSeries,
  type QuestionnaireCompletion, type QuestionnaireEvolutionSeries,
} from '../lib/questionnaireEvolution'

interface Props {
  user: User | null
  onBack: () => void
}

interface CatalogRow { id: string; title: string; category: string }
interface ResponseRow { questionnaire_id: string | null; total_score: number | null; result_title: string | null; completed_at: string | null }

export default function QuestionnaireEvolutionPage({ user, onBack }: Props) {
  const [series, setSeries] = useState<QuestionnaireEvolutionSeries[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let active = true
    ;(async () => {
      const [{ data: catalogData }, { data: responseData }] = await Promise.all([
        supabase.rpc('get_questionnaire_catalog'),
        supabase.from('questionnaire_responses')
          .select('questionnaire_id, total_score, result_title, completed_at')
          .eq('user_id', user.id).eq('status', 'completed')
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: true }),
      ])
      if (!active) return
      const catalog = new Map(((catalogData ?? []) as CatalogRow[]).map(c => [c.id, c]))
      const byQuestionnaire = new Map<string, QuestionnaireCompletion[]>()
      for (const r of (responseData ?? []) as ResponseRow[]) {
        if (!r.questionnaire_id || !r.completed_at) continue
        const list = byQuestionnaire.get(r.questionnaire_id) ?? []
        list.push({ completedAt: r.completed_at, totalScore: r.total_score ?? 0, resultTitle: r.result_title })
        byQuestionnaire.set(r.questionnaire_id, list)
      }
      const result: QuestionnaireEvolutionSeries[] = []
      for (const [questionnaireId, completions] of byQuestionnaire) {
        if (completions.length < 2) continue // só faz sentido "evolução" com 2+ preenchimentos
        const meta = catalog.get(questionnaireId)
        result.push({
          questionnaireId,
          title: meta?.title ?? 'Questionário',
          category: meta?.category ?? '',
          completions,
        })
      }
      setSeries(result)
      setLoading(false)
    })()
    return () => { active = false }
  }, [user])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-forest-700 hover:text-forest-900 mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar aos questionários
      </button>

      <header className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">
          Minha evolução <TrendingUp className="w-6 h-6 text-forest-400" />
        </h1>
        <p className="mt-2 text-ink-soft max-w-xl">
          Como suas respostas mudaram ao longo do tempo, nos questionários que você respondeu mais de uma vez.
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-28 bg-paper-soft border border-line rounded-2xl animate-pulse" />)}
        </div>
      ) : series.length === 0 ? (
        <div className="text-center py-16 text-ink-soft">
          <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-forest-900 mb-2">Ainda não há evolução para mostrar.</p>
          <p className="text-xs max-w-sm mx-auto">Responda o mesmo questionário mais de uma vez, em momentos diferentes, para ver como suas respostas mudam aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {series.map(s => {
            const labels = formatCompletionLabels(s.completions)
            const summary = describeQuestionnaireSeries(s)
            return (
              <div key={s.questionnaireId} className="bg-paper-soft border border-line rounded-2xl p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="font-serif text-lg text-forest-900">{s.title}</h2>
                  {s.category && <span className="text-[11px] text-forest-700 bg-mint px-2 py-0.5 rounded-full flex-shrink-0">{s.category}</span>}
                </div>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  {labels.map((label, i) => (
                    <span key={i} className="flex items-center gap-2">
                      <span className="bg-white border border-line rounded-full px-3 py-1 text-forest-800">{label}</span>
                      {i < labels.length - 1 && <span className="text-ink-soft">→</span>}
                    </span>
                  ))}
                </div>
                {summary && <p className="mt-3 text-sm text-ink-soft leading-relaxed">{summary}</p>}
              </div>
            )
          })}
          <p className="text-xs text-ink-soft/70 pt-2">
            Isto é uma leitura de autopercepção com base no que você mesmo respondeu — não é uma avaliação clínica nem substitui acompanhamento profissional.
          </p>
        </div>
      )}
    </div>
  )
}
