import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  Bell, MessageCircle, MessageSquare, Info, BookOpen, Tag, Clock,
  AlertTriangle, Settings, CheckCheck, LogIn, Bookmark, ArrowRight,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'

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

interface SavedItem {
  id: string
  item_type: string
  item_id: string
  title: string | null
  category: string | null
  created_at: string
}

interface Props {
  user: User | null
  navigate?: (v: string) => void
  onBack?: () => void
}

type Tab = 'all' | 'unread' | 'read'

function typeIcon(type: string) {
  const cls = 'w-5 h-5'
  switch (type) {
    case 'support_reply': return <MessageCircle className={`${cls} text-forest-600`} />
    case 'admin_message': return <MessageSquare className={`${cls} text-forest-600`} />
    case 'info': return <Info className={`${cls} text-forest-500`} />
    case 'content': return <BookOpen className={`${cls} text-forest-600`} />
    case 'promo': return <Tag className={`${cls} text-amber-600`} />
    case 'reminder': return <Clock className={`${cls} text-amber-600`} />
    case 'alert': return <AlertTriangle className={`${cls} text-coral`} />
    case 'system': return <Settings className={`${cls} text-forest-500`} />
    default: return <Bell className={`${cls} text-forest-500`} />
  }
}

const TYPE_LABEL: Record<string, string> = {
  support_reply: 'Suporte',
  admin_message: 'Mensagem',
  info: 'Info',
  content: 'Conteúdo',
  promo: 'Novidade',
  reminder: 'Lembrete',
  alert: 'Alerta',
  system: 'Sistema',
}

const SAVED_TYPE_LABEL: Record<string, string> = {
  article: 'Artigo', audio: 'Áudio', meditation: 'Meditação', exercise: 'Exercício',
  plan: 'Plano de autocuidado', trail: 'Trilha',
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

export default function NotificationsPage({ user, navigate, onBack: _onBack }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [saved, setSaved] = useState<SavedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [notifRes, savedRes] = await Promise.all([
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('saved_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(6),
    ])
    setNotifications(notifRes.data || [])
    setSaved((savedRes.data as SavedItem[]) || [])
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
        <Bell className="w-10 h-10 text-forest-300 mx-auto mb-4" />
        <p className="text-ink-soft mb-4">Faça login para ver suas notificações.</p>
        {navigate && (
          <button onClick={() => navigate('auth')} className="inline-flex items-center gap-2 bg-forest-900 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-forest-800">
            <LogIn className="w-4 h-4" /> Entrar
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900">Notificações e salvos</h1>
        <p className="mt-2 text-ink-soft">Acompanhe novidades, lembretes importantes e tudo que você salvou para cuidar de você.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 lg:gap-6">
        {/* ─── Notificações ─── */}
        <section className="bg-paper-soft border border-line rounded-3xl p-5 sm:p-6 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-serif text-lg sm:text-xl text-forest-900">Todas as notificações</h2>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-900 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" /> {markingAll ? 'Marcando…' : 'Marcar todas como lidas'}
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {(['all', 'unread', 'read'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${tab === t ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-ink-soft hover:border-forest-300'}`}
              >
                {t === 'all' ? 'Todas' : t === 'unread' ? `Não lidas${unreadCount > 0 ? ` (${unreadCount})` : ''}` : 'Lidas'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-mint/40 rounded-2xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-ink-soft">
              <span className="w-14 h-14 rounded-full bg-mint flex items-center justify-center mx-auto mb-3 text-forest-500"><Bell className="w-6 h-6" /></span>
              <p className="font-serif text-lg text-forest-900">Tudo em dia por aqui!</p>
              <p className="text-sm mt-1">Quando houver algo novo, você verá por aqui.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(n => (
                <div key={n.id} className={`rounded-2xl border p-4 transition-colors ${!n.is_read ? 'border-forest-100 bg-mint/30' : 'border-line bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center flex-shrink-0">{typeIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-mint text-forest-700">{TYPE_LABEL[n.type] ?? n.type}</span>
                        {!n.is_read && <span className="w-2 h-2 bg-coral rounded-full flex-shrink-0" />}
                        <span className="text-xs text-ink-soft ml-auto">{formatRelative(n.created_at)}</span>
                      </div>
                      <p className="text-sm font-semibold text-forest-900">{n.title}</p>
                      {n.body && <p className="text-sm text-ink-soft mt-0.5 leading-relaxed">{n.body}</p>}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {!n.is_read && (
                          <button onClick={() => markRead(n.id)} className="text-xs text-ink-soft hover:text-forest-700 flex items-center gap-1 transition-colors">
                            <CheckCheck className="w-3.5 h-3.5" /> Marcar como lida
                          </button>
                        )}
                        {n.action_view && n.action_label && (
                          <button onClick={() => handleAction(n)} className="text-xs bg-forest-900 text-white px-3 py-1 rounded-lg hover:bg-forest-800 transition-colors">
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
        </section>

        {/* ─── Itens salvos ─── */}
        <aside>
          <div className="bg-paper-soft border border-line rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-serif text-lg sm:text-xl text-forest-900">Seus itens salvos</h2>
              {navigate && saved.length > 0 && (
                <button onClick={() => navigate('saved')} className="text-xs text-forest-700 hover:underline flex items-center gap-1">Ver todos <ArrowRight className="w-3 h-3" /></button>
              )}
            </div>

            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-mint/40 rounded-2xl animate-pulse" />)}</div>
            ) : saved.length === 0 ? (
              <div className="text-center py-8">
                <span className="w-12 h-12 rounded-full bg-mint flex items-center justify-center mx-auto mb-3 text-forest-500"><Bookmark className="w-5 h-5" /></span>
                <p className="font-serif text-base text-forest-900">Salve o que faz bem para você</p>
                <p className="text-sm text-ink-soft mt-1 mb-4">Encontre conteúdos que te acolhem e salve para acessar sempre que quiser.</p>
                {navigate && (
                  <button onClick={() => navigate('articles')} className="inline-flex items-center gap-2 bg-forest-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-forest-800 transition-colors">
                    Explorar conteúdos <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {saved.map(s => (
                  <div key={s.id} className="rounded-2xl border border-line bg-white p-3.5 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"><Bookmark className="w-4 h-4" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-forest-600 font-medium">{SAVED_TYPE_LABEL[s.item_type] ?? s.item_type}</p>
                      <p className="text-sm font-medium text-forest-900 truncate">{s.title ?? s.item_id}</p>
                    </div>
                  </div>
                ))}
                {navigate && (
                  <button onClick={() => navigate('articles')} className="mt-2 w-full inline-flex items-center justify-center gap-2 border border-line text-forest-700 text-sm font-medium px-4 py-2.5 rounded-2xl hover:bg-mint/50 transition-colors">
                    Explorar mais conteúdos <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
