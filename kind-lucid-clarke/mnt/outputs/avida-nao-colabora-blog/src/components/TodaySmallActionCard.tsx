import { CheckCircle2, HeartHandshake, X } from 'lucide-react'
import type { TodaySmallAction } from '../lib/todaySmallAction'
import { trackRetentionEvent } from '../lib/retentionAnalytics'

export type SmallActionStatus = 'idle' | 'accepted' | 'done'

interface Props {
  action: TodaySmallAction
  status: SmallActionStatus
  onAccept: () => void
  onDone: () => void
  onDismiss: () => void
}

export default function TodaySmallActionCard({ action, status, onAccept, onDone, onDismiss }: Props) {
  function accept() {
    trackRetentionEvent('small_action_accepted', {
      dedupeKey: action.id,
      metadata: { surface: 'home' },
    })
    onAccept()
  }

  function done() {
    trackRetentionEvent('small_action_completed', {
      dedupeKey: action.id,
      metadata: { surface: 'home' },
    })
    onDone()
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-forest-100 bg-gradient-to-br from-mint/60 via-paper-soft to-sand-50 p-5 sm:p-6" aria-labelledby="small-action-title">
      {status !== 'done' && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Ocultar esta pequena ação hoje"
          className="absolute right-4 top-4 rounded-xl p-2 text-ink-soft hover:bg-white/70 hover:text-forest-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-start gap-4 pr-8">
        <span className="w-11 h-11 rounded-2xl bg-white border border-forest-100 text-forest-700 flex items-center justify-center flex-shrink-0">
          {status === 'done' ? <CheckCircle2 className="w-5 h-5" /> : <HeartHandshake className="w-5 h-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">{action.eyebrow}</p>
          <h2 id="small-action-title" className="font-serif text-2xl text-forest-900 mt-1">
            {status === 'done' ? 'Feito por você hoje' : action.title}
          </h2>

          {status === 'done' ? (
            <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-3xl">{action.doneMessage}</p>
          ) : (
            <>
              <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-3xl">{action.description}</p>
              <p className="text-xs text-ink-soft mt-3 leading-relaxed max-w-3xl">{action.reason}</p>
            </>
          )}

          {status === 'idle' && (
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={accept}
                className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors"
              >
                {action.cta}
              </button>
              <button type="button" onClick={onDismiss} className="text-sm font-medium text-forest-700 px-3 py-2.5 rounded-xl hover:bg-white/70 transition-colors">
                Agora não
              </button>
            </div>
          )}

          {status === 'accepted' && (
            <div className="mt-4 rounded-2xl border border-forest-100 bg-white/70 p-4">
              <p className="text-sm text-forest-900 font-medium">Sem pressa. Isso não vira obrigação.</p>
              <p className="text-xs text-ink-soft mt-1">Quando fizer sentido, você pode apenas marcar que fez. Não há pontos, sequência ou recompensa.</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={done}
                  className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-4 py-2.5 rounded-2xl transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" /> Marcar como feito
                </button>
                <button type="button" onClick={onDismiss} className="text-sm font-medium text-forest-700 px-3 py-2.5 rounded-xl hover:bg-white transition-colors">
                  Deixar para outro momento
                </button>
              </div>
            </div>
          )}

          <p className="text-[11px] text-ink-soft mt-4 leading-relaxed">
            Sugestão baseada apenas em sinais estruturados do seu registro de hoje. Nenhum trecho do texto do Diário é usado aqui.
          </p>
        </div>
      </div>
    </section>
  )
}
