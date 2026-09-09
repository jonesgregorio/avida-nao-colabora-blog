import { useCallback, useEffect, useRef, useState } from 'react'
import { UserPlus, Crown, Loader2, CheckCheck, Sparkles } from 'lucide-react'
import {
  fetchActivityEvents,
  fetchActivityUnreadCount,
  markActivityEventRead,
  markAllActivityEventsRead,
  subscribeActivityEvents,
  activityRelativeTime,
  type AdminActivityEvent,
  type AdminActivityFilter,
} from '../../lib/adminActivityEvents'
import { PLAN_LABELS } from '../../lib/planConstants'

const PAGE = 15

const FILTERS: { key: AdminActivityFilter; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'user_signup', label: 'Cadastros' },
  { key: 'subscription_started', label: 'Assinaturas' },
  { key: 'unread', label: 'Não lidos' },
]

function isSubscription(t: string) {
  return t === 'subscription_started'
}

function EventRow({
  ev, onOpenUser, onRead,
}: {
  ev: AdminActivityEvent
  onOpenUser?: (userId: string) => void
  onRead: (id: string) => void
}) {
  const sub = isSubscription(ev.event_type)
  const plan = (ev.metadata?.plan as string | undefined) ?? ev.user_plan ?? null
  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${ev.read_at ? '' : 'bg-mint/25'}`}>
      <span
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          sub ? 'bg-coral text-[#c05f3c]' : 'bg-mint text-forest-700'
        }`}
        aria-hidden="true"
      >
        {sub ? <Crown className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-forest-900">{ev.title}</p>
          {plan && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
              {PLAN_LABELS[plan] ?? plan}
            </span>
          )}
          {!ev.read_at && <span className="w-1.5 h-1.5 rounded-full bg-forest-600" aria-label="não lido" />}
        </div>
        <p className="text-xs text-stone-500 mt-0.5">{ev.message}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[11px] text-stone-400">{activityRelativeTime(ev.created_at)}</span>
          {ev.user_id && onOpenUser && (
            <button
              type="button"
              onClick={() => { onOpenUser(ev.user_id as string); if (!ev.read_at) onRead(ev.id) }}
              className="text-[11px] text-forest-700 hover:text-forest-900 underline"
            >
              Ver usuário
            </button>
          )}
          {!ev.read_at && (
            <button
              type="button"
              onClick={() => onRead(ev.id)}
              className="text-[11px] text-stone-400 hover:text-forest-700"
            >
              Marcar como lido
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminActivityAlerts({ onOpenUser }: { onOpenUser?: (userId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [filter, setFilter] = useState<AdminActivityFilter>('all')
  const [rows, setRows] = useState<AdminActivityEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const firstLoadRef = useRef(true)

  const refreshCount = useCallback(async () => {
    setUnread(await fetchActivityUnreadCount())
  }, [])

  const load = useCallback(async (f: AdminActivityFilter, offset: number) => {
    if (offset > 0) setLoadingMore(true); else setLoading(true)
    try {
      const page = await fetchActivityEvents(f, PAGE, offset)
      setTotal(page.total)
      setUnread(page.unread)
      setRows(prev => (offset > 0 ? [...prev, ...page.rows] : page.rows))
    } catch {
      if (offset === 0) setRows([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { void refreshCount() }, [refreshCount])

  // Realtime + fallback de polling leve (3 min) caso o canal não conecte.
  useEffect(() => {
    const unsub = subscribeActivityEvents(() => {
      void (async () => {
        const before = seenIdsRef.current
        const page = await fetchActivityEvents('all', PAGE, 0)
        setUnread(page.unread)
        const fresh = page.rows.find(r => !before.has(r.id))
        if (fresh && !firstLoadRef.current) {
          setToast(fresh.title + (fresh.user_name ? ` — ${fresh.user_name}` : ''))
          window.setTimeout(() => setToast(null), 6000)
        }
        page.rows.forEach(r => before.add(r.id))
        firstLoadRef.current = false
        if (open) { setRows(page.rows); setTotal(page.total) }
      })()
    })
    const poll = window.setInterval(() => { void refreshCount() }, 180_000)
    return () => { unsub(); window.clearInterval(poll) }
  }, [open, refreshCount])

  useEffect(() => {
    if (open) void load(filter, 0)
  }, [open, filter, load])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function handleRead(id: string) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, read_at: new Date().toISOString() } : r)))
    setUnread(n => Math.max(0, n - 1))
    await markActivityEventRead(id)
  }

  async function handleReadAll() {
    setRows(prev => prev.map(r => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })))
    setUnread(0)
    await markAllActivityEventsRead()
    if (filter === 'unread') void load('unread', 0)
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 rounded-full border border-[#ded5c8] bg-[#fffdf9] flex items-center justify-center text-[#637069] hover:bg-[#f5efe6]"
        aria-label="Novos usuários e assinaturas"
        aria-expanded={open}
      >
        <Sparkles className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-forest-700 text-white text-[9px] font-semibold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {toast && (
        <div className="fixed top-[70px] right-4 z-[60] flex items-center gap-2 bg-forest-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          <Sparkles className="w-4 h-4 text-mint" />
          {toast}
        </div>
      )}

      {open && (
        <div className="absolute right-0 top-[calc(100%+12px)] w-[min(420px,90vw)] rounded-2xl border border-line bg-white shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-forest-900">Novidades</p>
              <p className="text-[11px] text-stone-400">Novos cadastros e novas assinaturas</p>
            </div>
            <button
              type="button"
              onClick={handleReadAll}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 text-xs text-forest-700 hover:text-forest-900 disabled:opacity-40"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Marcar tudo
            </button>
          </div>

          <div className="px-3 py-2 border-b border-line flex gap-1.5 overflow-x-auto">
            {FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                  filter === f.key ? 'bg-forest-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="px-4 py-8 flex items-center justify-center gap-2 text-sm text-stone-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-stone-500">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhum evento por aqui ainda.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto divide-y divide-line">
              {rows.map(ev => (
                <EventRow key={ev.id} ev={ev} onOpenUser={onOpenUser} onRead={handleRead} />
              ))}
              {rows.length < total && (
                <button
                  type="button"
                  onClick={() => void load(filter, rows.length)}
                  disabled={loadingMore}
                  className="w-full py-2.5 text-xs text-forest-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  {loadingMore ? 'Carregando…' : `Carregar mais (${total - rows.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
