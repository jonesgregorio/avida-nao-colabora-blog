import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { resolveNotifDestination } from '../lib/notifications'
import {
  Bell, MessageCircle, BarChart3, Sprout, BookOpen, Crown, CheckCheck, Sparkles,
} from 'lucide-react'

interface Notif {
  id: string
  user_id: string | null
  title: string
  message?: string | null
  body?: string | null
  type: string
  is_read: boolean
  action_url?: string | null
  created_at: string
}

interface Props {
  user: { id: string } | null
  navigate: (section: string, articleSlug?: string) => void
}

// Ícone + cores por tipo de notificação (paleta da marca).
const TYPE_META: Record<string, { Icon: typeof Bell; color: string; bg: string }> = {
  support_reply:        { Icon: MessageCircle, color: 'text-forest-700', bg: 'bg-mint' },
  monthly_guidance:     { Icon: MessageCircle, color: 'text-forest-700', bg: 'bg-mint' },
  professional_comment: { Icon: Crown,         color: 'text-[#8a6d1f]', bg: 'bg-amber-100' },
  monthly_report:       { Icon: BarChart3,     color: 'text-[#3d6ea5]', bg: 'bg-sky' },
  self_care_review:     { Icon: Sprout,        color: 'text-forest-700', bg: 'bg-mint' },
  content:              { Icon: BookOpen,      color: 'text-[#c05f3c]', bg: 'bg-coral/30' },
  personalized_content: { Icon: Sparkles,      color: 'text-[#c05f3c]', bg: 'bg-coral/30' },
}
const DEFAULT_META = { Icon: Bell, color: 'text-forest-700', bg: 'bg-mint' }

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const days = Math.floor(h / 24)
  if (days < 7) return days === 1 ? 'ontem' : `há ${days} dias`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function NotificationsPage({ user, navigate }: Props) {
  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [filter, setFilter] = useState<'todas' | 'nao_lidas' | 'lidas'>('todas')

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      setLoading(true); setLoadError(false)
      // Escopo EXPLÍCITO: só as próprias (user_id = eu) + broadcasts (user_id NULL).
      // Não confiar só no RLS — o admin tem policy FOR ALL e veria as de todos.
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(100)
      if (!active) return
      if (error) { setLoadError(true); setLoading(false); return }
      setItems((data ?? []) as Notif[])
      setLoading(false)
    })()
    return () => { active = false }
  }, [user])

  // Só as notificações pessoais têm estado de leitura por usuário (broadcasts são compartilhados).
  const unreadOwn = items.filter(n => !n.is_read && n.user_id)
  const visible = items.filter(n =>
    filter === 'todas' ? true : filter === 'nao_lidas' ? (!n.is_read && !!n.user_id) : n.is_read,
  )

  async function openNotif(n: Notif) {
    if (!n.is_read && n.user_id) {
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, is_read: true } : x)))
      void supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', n.id)
    }
    // Destino corrigido pela matriz (conserta action_urls legados errados).
    const dest = resolveNotifDestination(n.type, n.action_url)
    if (dest.startsWith('article:')) navigate('article', dest.slice('article:'.length))
    else if (dest) navigate(dest)
  }

  async function markAll() {
    if (unreadOwn.length === 0 || !user) return
    setItems(prev => prev.map(n => (n.user_id ? { ...n, is_read: true } : n)))
    await supabase.from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('is_read', false)
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Bell className="w-10 h-10 text-forest-300 mx-auto mb-4" />
        <p className="text-ink-soft mb-4">Faça login para ver suas notificações.</p>
        <button onClick={() => navigate('auth')} className="bg-forest-900 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-forest-800">
          Entrar
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">
            Notificações <Bell className="w-6 h-6 text-forest-400" />
          </h1>
          <p className="mt-2 text-ink-soft">Acompanhe respostas, comentários, relatórios e novidades num só lugar.</p>
        </div>
        {unreadOwn.length > 0 && (
          <button
            onClick={markAll}
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm text-forest-700 border border-line rounded-xl px-3 py-2 hover:bg-mint/40 transition-colors"
          >
            <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
          </button>
        )}
      </header>

      {/* Filtros */}
      {!loading && !loadError && items.length > 0 && (
        <div className="flex gap-2 mb-4">
          {([['todas', 'Todas'], ['nao_lidas', 'Não lidas'], ['lidas', 'Lidas']] as const).map(([key, label]) => {
            const active = filter === key
            const count = key === 'nao_lidas' ? unreadOwn.length : undefined
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  active ? 'bg-forest-900 text-white border-forest-900' : 'bg-paper-soft border-line text-ink-soft hover:border-forest-300 hover:text-forest-900'
                }`}
              >
                {label}
                {count != null && count > 0 && <span className={`text-[11px] px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-mint text-forest-700'}`}>{count}</span>}
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-mint/40 rounded-2xl animate-pulse" />)}</div>
      ) : loadError ? (
        <div className="bg-paper-soft border border-line rounded-3xl p-10 text-center">
          <Bell className="w-10 h-10 text-forest-300 mx-auto mb-3" />
          <p className="text-sm text-ink-soft">Não foi possível carregar suas notificações agora. Tente novamente em instantes.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-paper-soft border border-line rounded-3xl p-10 text-center">
          <Bell className="w-10 h-10 text-forest-300 mx-auto mb-3" />
          <p className="font-serif text-lg text-forest-900">Você ainda não tem notificações.</p>
          <p className="text-sm text-ink-soft mt-1">Quando algo novo acontecer — uma resposta, um relatório ou um novo conteúdo — você vê por aqui.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-paper-soft border border-line rounded-3xl p-10 text-center">
          <CheckCheck className="w-10 h-10 text-forest-300 mx-auto mb-3" />
          <p className="font-serif text-lg text-forest-900">{filter === 'nao_lidas' ? 'Tudo em dia por aqui.' : 'Nada por aqui.'}</p>
          <p className="text-sm text-ink-soft mt-1">{filter === 'nao_lidas' ? 'Você não tem notificações não lidas.' : 'Nenhuma notificação neste filtro.'}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map(n => {
            const meta = TYPE_META[n.type] ?? DEFAULT_META
            const unread = !n.is_read && !!n.user_id
            const text = n.message || n.body || ''
            const clickable = !!n.action_url
            return (
              <li key={n.id}>
                <button
                  onClick={() => openNotif(n)}
                  disabled={!clickable}
                  className={`w-full text-left flex items-start gap-3.5 rounded-2xl border px-4 py-3.5 transition-all ${
                    unread ? 'bg-mint/30 border-forest-200' : 'bg-paper-soft border-line'
                  } ${clickable ? 'hover:border-forest-300 hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                    <meta.Icon className={`w-[18px] h-[18px] ${meta.color}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm text-forest-900 ${unread ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                    {text && <p className="text-sm text-ink-soft leading-snug mt-0.5 line-clamp-2">{text}</p>}
                    <p className="text-[11px] text-ink-soft/70 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {unread && <span className="w-2.5 h-2.5 rounded-full bg-[#c05f3c] flex-shrink-0 mt-1.5" aria-label="Não lida" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
