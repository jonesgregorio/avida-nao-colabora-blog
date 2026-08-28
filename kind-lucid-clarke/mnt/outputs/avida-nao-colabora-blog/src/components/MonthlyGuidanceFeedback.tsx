import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, MessageCircleMore, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type GuidanceFeedback = 'helpful' | 'partial' | 'not_for_me'

type FeedbackRow = {
  id: string
  feedback: GuidanceFeedback
  tags: string[] | null
}

const OPTIONS: Array<{ value: GuidanceFeedback; label: string }> = [
  { value: 'helpful', label: 'Me ajudou' },
  { value: 'partial', label: 'Em parte' },
  { value: 'not_for_me', label: 'Não combinou comigo' },
]

const TAGS: Record<GuidanceFeedback, Array<{ value: string; label: string }>> = {
  helpful: [
    { value: 'clear', label: 'Foi clara' },
    { value: 'practical', label: 'Trouxe passos práticos' },
    { value: 'organized_ideas', label: 'Ajudou a organizar ideias' },
    { value: 'felt_relevant', label: 'Combinou com meu momento' },
  ],
  partial: [
    { value: 'clear', label: 'Teve partes claras' },
    { value: 'practical', label: 'Teve algo prático' },
    { value: 'too_generic', label: 'Ficou genérica em alguns pontos' },
    { value: 'missing_practical_steps', label: 'Faltaram passos mais práticos' },
  ],
  not_for_me: [
    { value: 'too_generic', label: 'Ficou genérica' },
    { value: 'not_applicable', label: 'Não combinou com meu momento' },
    { value: 'unclear', label: 'Faltou clareza' },
    { value: 'missing_practical_steps', label: 'Faltaram passos práticos' },
  ],
}

export default function MonthlyGuidanceFeedback({ userId, guidanceRequestId }: {
  userId: string
  guidanceRequestId: string
}) {
  const [row, setRow] = useState<FeedbackRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !guidanceRequestId) { setLoading(false); return }
    let active = true
    supabase
      .from('monthly_guidance_feedback')
      .select('id,feedback,tags')
      .eq('user_id', userId)
      .eq('guidance_request_id', guidanceRequestId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setRow((data as FeedbackRow | null) ?? null)
        setLoading(false)
      })
    return () => { active = false }
  }, [userId, guidanceRequestId])

  const selectedTags = useMemo(() => new Set(row?.tags ?? []), [row?.tags])

  async function choose(feedback: GuidanceFeedback) {
    if (saving) return
    setSaving(true)
    setError(null)

    if (row?.feedback === feedback) {
      const { error: deleteError } = await supabase
        .from('monthly_guidance_feedback')
        .delete()
        .eq('guidance_request_id', guidanceRequestId)
        .eq('user_id', userId)
      if (deleteError) setError('Não foi possível remover sua avaliação agora.')
      else setRow(null)
      setSaving(false)
      return
    }

    const allowedTags = new Set(TAGS[feedback].map(item => item.value))
    const tags = (row?.tags ?? []).filter(tag => allowedTags.has(tag)).slice(0, 3)
    const { data, error: saveError } = await supabase
      .from('monthly_guidance_feedback')
      .upsert({ user_id: userId, guidance_request_id: guidanceRequestId, feedback, tags }, { onConflict: 'guidance_request_id' })
      .select('id,feedback,tags')
      .single()
    if (saveError || !data) setError('Não foi possível salvar sua avaliação agora.')
    else setRow(data as FeedbackRow)
    setSaving(false)
  }

  async function toggleTag(tag: string) {
    if (!row || saving) return
    const allowed = new Set(TAGS[row.feedback].map(item => item.value))
    if (!allowed.has(tag)) return
    const next = new Set(row.tags ?? [])
    if (next.has(tag)) next.delete(tag)
    else if (next.size < 3) next.add(tag)
    const tags = [...next]

    setSaving(true)
    setError(null)
    const { data, error: saveError } = await supabase
      .from('monthly_guidance_feedback')
      .update({ tags })
      .eq('guidance_request_id', guidanceRequestId)
      .eq('user_id', userId)
      .select('id,feedback,tags')
      .single()
    if (saveError || !data) setError('Não foi possível atualizar sua avaliação agora.')
    else setRow(data as FeedbackRow)
    setSaving(false)
  }

  if (loading) return <div className="mt-4 h-16 rounded-xl bg-stone-50 animate-pulse" aria-hidden="true" />

  return (
    <div className="mt-4 rounded-xl border border-forest-100 bg-mint/20 p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-forest-600">
          <MessageCircleMore className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-forest-800">Como essa orientação chegou para você?</p>
          <p className="mt-1 text-[11px] leading-relaxed text-forest-700/80">
            Seu retorno ajuda a entender o que foi mais útil. Ele não abre uma nova conversa e você pode mudar sua escolha quando quiser.
          </p>

          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Avaliar orientação mensal">
            {OPTIONS.map(option => {
              const active = row?.feedback === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={saving}
                  aria-pressed={active}
                  onClick={() => choose(option.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${active ? 'border-forest-500 bg-forest-700 text-white' : 'border-forest-200 bg-white text-forest-700 hover:border-forest-400'}`}
                >
                  {active && <Check className="h-3 w-3" />}
                  {option.label}
                </button>
              )
            })}
            {saving && <Loader2 className="mt-1.5 h-4 w-4 animate-spin text-forest-500" aria-label="Salvando avaliação" />}
          </div>

          {row && (
            <div className="mt-3 border-t border-forest-100 pt-3">
              <p className="text-[11px] font-medium text-forest-700">Se quiser, marque até 3 pontos:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TAGS[row.feedback].map(item => {
                  const active = selectedTags.has(item.value)
                  return (
                    <button
                      key={item.value}
                      type="button"
                      disabled={saving}
                      aria-pressed={active}
                      onClick={() => toggleTag(item.value)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${active ? 'border-forest-400 bg-white text-forest-800' : 'border-transparent bg-forest-50 text-forest-600 hover:border-forest-200'}`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => choose(row.feedback)}
                className="mt-3 inline-flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-600 disabled:opacity-50"
              >
                <X className="h-3 w-3" /> Remover avaliação
              </button>
            </div>
          )}

          {error && <p className="mt-2 text-[11px] text-red-600" role="status">{error}</p>}
        </div>
      </div>
    </div>
  )
}
