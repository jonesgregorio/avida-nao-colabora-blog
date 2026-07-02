import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  Bell, MessageCircle, MessageSquare, Info, BookOpen, Tag, Clock,
  AlertTriangle, Settings, CheckCheck, LogIn,
} from 'lucide-react'

interface Notification {
  id: string
  user_id: string
  title: string
  body: string | null
  type: string
  is_read: boolean
  read_at: string | null
  related_ticket_id: string | null
  action_view: string | null
  action_label: string | null
  created_at: string
}

interface Props {
  user: any
  navigate?: (v: string) => void
  onBack?: () => void
}

type Tab = 'all' | 'unread' | 'read'

function typeIcon(type: string) {
  switch (type) {
    case 'support_reply': return <MessageCircle className="w-5 h-5 text-blue-500" />
    case 'admin_message': return <MessageSquare className="w-5 h-5 text-purple-500" />
    case 'info': return <Info className="w-5 h-5 text-stone-400" />
    case 'content': return <BookOpen className="w-5 h-5 text-emerald-500" />
    case 'promo': return <Tag className="w-5 h-5 text-amber-500" />
    case 'reminder': return <Clock className="w-5 h-5 text-orange-500" />
    case 'alert': return <AlertTriangle className="w-5 h-5 text-red-500" />
    case 'system': return <Settings className="w-5 h-5 text-stone-500" />
    default: return <Bell className="w-5 h-5 text-stone-400" />
  }
}

const TYPE_LABEL: Record<string, string> = {
  support_reply: 'Suporte',
  admin_message: 'Mensagem',
  info: 'Info',
  content: 'Conteúdo',
  promo: 'Promoção',
  reminder: 'Lembrete',
  alert: 'Alerta',
  system: 'Sistema',
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function NotificationsPage({ user, navigate, onBack }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setNotifications(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
  }

  async function markAllRead() {
    if (!user) return
    setMarkingAll(true)
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: n.read_at ?? new Date().toISOString() })))
    setMarkingAll(false)
  }

  function handleAction(n: Notification) {
    if (!navigate) return
    if (n.action_view === 'support-ticket' && n.related_ticket_id) {
      navigate(`support-ticket:${n.related_ticket_id}`)
    } else if (n.action_view) {
      navigate(n.action_view)
    }
  }

  const filtered = notifications.filter(n => {
    if (tab === 'unread') return !n.is_read
    if (tab === 'read') return n.is_read
    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Bell className="w-10 h-10 text-stone-300 mx-auto mb-4" />
        <p className="text-stone-500 mb-4">Faça login para ver suas notificações.</p>
        {navigate && (
          <button
            onClick={() => navigate('auth')}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700"
          >
            <LogIn className="w-4 h-4" /> Entrar
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          {onBack && (
            <button onClick={onBack} className="text-xs text-stone-400 hover:text-stone-600 mb-1">← Voltar</button>
          )}
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <Bell className="w-6 h-6" /> Notificações
            {unreadCount > 0 && (
              <span className="text-sm bg-red-500 text-white rounded-full px-2 py-0.5">{unreadCount}</span>
            )}
          </h1>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-emerald-600 border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {markingAll ? 'Marcando...' : 'Marcar todas como lidas'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'unread', 'read'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm px-4 py-1.5 rounded-full transition-colors ${tab === t ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            {t === 'all' ? 'Todas' : t === 'unread' ? `Não lidas${unreadCount > 0 ? ` (${unreadCount})` : ''}` : 'Lidas'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma notificação{tab === 'unread' ? ' não lida' : tab === 'read' ? ' lida' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div
              key={n.id}
              className={`bg-white rounded-xl border p-4 transition-colors ${!n.is_read ? 'border-blue-100 bg-blue-50/30' : 'border-stone-100'}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {typeIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      n.type === 'alert' ? 'bg-red-100 text-red-700' :
                      n.type === 'support_reply' ? 'bg-blue-100 text-blue-700' :
                      n.type === 'admin_message' ? 'bg-purple-100 text-purple-700' :
                      n.type === 'promo' ? 'bg-amber-100 text-amber-700' :
                      'bg-stone-100 text-stone-500'
                    }`}>
                      {TYPE_LABEL[n.type] ?? n.type}
                    </span>
                    {!n.is_read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                    )}
                    <span className="text-xs text-stone-400 ml-auto">{formatRelative(n.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-stone-800">{n.title}</p>
                  {n.body && <p className="text-sm text-stone-500 mt-0.5 leading-relaxed">{n.body}</p>}

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {!n.is_read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-xs text-stone-400 hover:text-emerald-600 flex items-center gap-1 transition-colors"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Marcar como lida
                      </button>
                    )}
                    {n.action_view && n.action_label && (
                      <button
                        onClick={() => handleAction(n)}
                        className="text-xs bg-emerald-600 text-white px-3 py-1 rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        {n.action_label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
