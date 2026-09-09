import { useCallback, useEffect, useRef, useState } from 'react'
import { UserPlus, Crown, ArrowUpRight, ArrowDownRight, Ban, X } from 'lucide-react'
import {
  fetchActivityEvents,
  markActivityEventRead,
  subscribeActivityEvents,
  activityRelativeTime,
  type AdminActivityEvent,
} from '../../lib/adminActivityEvents'
import { PLAN_LABELS } from '../../lib/planConstants'

// Pop-up BLOQUEANTE: aparece sempre que há eventos administrativos não lidos
// (novo usuário, nova assinatura, mudança de plano). Só fecha no X ou no OK —
// não fecha por clique fora nem por Esc. "OK" marca os eventos como lidos;
// "X" apenas fecha (os eventos seguem não lidos no sino e o pop-up não reabre
// para os MESMOS eventos nesta sessão, só para eventos realmente novos).

const POPUP_TYPES = new Set([
  'user_signup',
  'subscription_started',
  'plan_upgraded',
  'plan_downgraded',
  'subscription_cancelled',
])

function visual(type: string) {
  switch (type) {
    case 'subscription_started': return { Icon: Crown, cls: 'bg-coral text-[#c05f3c]' }
    case 'plan_upgraded': return { Icon: ArrowUpRight, cls: 'bg-coral text-[#c05f3c]' }
    case 'plan_downgraded': return { Icon: ArrowDownRight, cls: 'bg-[#fbf1d5] text-[#c9971f]' }
    case 'subscription_cancelled': return { Icon: Ban, cls: 'bg-[#fbf1d5] text-[#c9971f]' }
    default: return { Icon: UserPlus, cls: 'bg-mint text-forest-700' }
  }
}

export default function AdminActivityPopup() {
  const [queue, setQueue] = useState<AdminActivityEvent[]>([])
  const [busy, setBusy] = useState(false)
  const dismissedRef = useRef<Set<string>>(new Set())
  const okRef = useRef<HTMLButtonElement>(null)

  const check = useCallback(async () => {
    try {
      const page = await fetchActivityEvents('unread', 50, 0)
      const fresh = page.rows.filter(
        r => POPUP_TYPES.has(r.event_type) && !dismissedRef.current.has(r.id),
      )
      setQueue(fresh)
    } catch {
      /* silencioso: o sino continua sendo a fonte confiável */
    }
  }, [])

  useEffect(() => {
    void check()
    const unsub = subscribeActivityEvents(() => { void check() })
    const poll = window.setInterval(() => { void check() }, 60_000)
    return () => { unsub(); window.clearInterval(poll) }
  }, [check])

  useEffect(() => {
    if (queue.length > 0) {
      const t = window.setTimeout(() => okRef.current?.focus(), 30)
      return () => window.clearTimeout(t)
    }
  }, [queue.length])

  // Bloqueia o Esc enquanto o pop-up está aberto.
  useEffect(() => {
    if (queue.length === 0) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [queue.length])

  if (queue.length === 0) return null

  function closeOnly() {
    queue.forEach(ev => dismissedRef.current.add(ev.id))
    setQueue([])
  }

  async function confirmOk() {
    setBusy(true)
    const ids = queue.map(ev => ev.id)
    ids.forEach(id => dismissedRef.current.add(id))
    setQueue([])
    try {
      await Promise.all(ids.map(id => markActivityEventRead(id)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-forest-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-activity-popup-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line">
          <div>
            <p id="admin-activity-popup-title" className="font-serif text-lg text-forest-900">
              {queue.length === 1 ? 'Nova atividade' : `${queue.length} novas atividades`}
            </p>
            <p className="text-[11px] text-stone-400 mt-0.5">Novos usuários e mudanças de plano</p>
          </div>
          <button
            type="button"
            onClick={closeOnly}
            aria-label="Fechar"
            className="p-1.5 -mr-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto divide-y divide-line">
          {queue.map(ev => {
            const { Icon, cls } = visual(ev.event_type)
            const plan = (ev.metadata?.plan as string | undefined) ?? ev.user_plan ?? null
            return (
              <div key={ev.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cls}`} aria-hidden="true">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-forest-900">{ev.title}</p>
                    {plan && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
                        {PLAN_LABELS[plan] ?? plan}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">{ev.message}</p>
                  <p className="text-[11px] text-stone-400 mt-1">{activityRelativeTime(ev.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line bg-stone-50">
          <button
            type="button"
            onClick={closeOnly}
            className="text-sm px-4 py-2 rounded-xl border border-line text-stone-600 hover:bg-white"
          >
            Fechar
          </button>
          <button
            ref={okRef}
            type="button"
            onClick={() => void confirmOk()}
            disabled={busy}
            className="text-sm font-medium px-5 py-2 rounded-xl bg-forest-900 text-white hover:bg-forest-800 disabled:opacity-50"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
