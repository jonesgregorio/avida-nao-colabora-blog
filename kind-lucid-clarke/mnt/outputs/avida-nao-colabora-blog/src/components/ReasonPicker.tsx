import { REASON_OPTIONS, REASON_LABELS, type ReasonSlug } from '../lib/cancelReasons'

interface Props {
  reasons: string[]
  comment: string
  onChangeReasons: (r: string[]) => void
  onChangeComment: (c: string) => void
  error?: string | null
}

// Motivo de cancelamento/downgrade — seleção MÚLTIPLA e obrigatória (§9/§11).
// Compartilhado pelas duas modais para que a regra não divirja entre elas.
// A validação real vive em lib/cancelReasons.validateReasons e é repetida no
// back-end: o front sozinho não é barreira.
export default function ReasonPicker({ reasons, comment, onChangeReasons, onChangeComment, error }: Props) {
  const outroSelecionado = reasons.includes('other')

  function toggle(slug: ReasonSlug) {
    if (reasons.includes(slug)) onChangeReasons(reasons.filter((r) => r !== slug))
    else onChangeReasons([...reasons, slug])
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-stone-800">Por qual motivo você está fazendo essa mudança?</p>
        <p className="text-xs text-stone-500 mt-0.5">Você pode selecionar mais de uma opção.</p>
      </div>

      <div className="space-y-1.5">
        {REASON_OPTIONS.map((slug) => {
          const marcado = reasons.includes(slug)
          return (
            <label
              key={slug}
              className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                marcado ? 'border-forest-300 bg-mint/40' : 'border-stone-200 hover:bg-stone-50'
              }`}
            >
              <input
                type="checkbox"
                checked={marcado}
                onChange={() => toggle(slug)}
                className="mt-0.5 w-4 h-4 rounded border-stone-300 text-forest-700 focus:ring-forest-500"
              />
              <span className="text-xs text-stone-700 leading-snug">{REASON_LABELS[slug]}</span>
            </label>
          )
        })}
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1">
          Quer contar mais detalhes?
          {outroSelecionado
            ? <span className="text-red-600 font-normal"> (obrigatório para “Outro motivo”)</span>
            : <span className="text-stone-400 font-normal"> (opcional)</span>}
        </label>
        <textarea
          value={comment}
          onChange={(e) => onChangeComment(e.target.value)}
          rows={3}
          placeholder="Conte rapidamente o que influenciou sua decisão…"
          className="w-full text-xs border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-400 resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  )
}
