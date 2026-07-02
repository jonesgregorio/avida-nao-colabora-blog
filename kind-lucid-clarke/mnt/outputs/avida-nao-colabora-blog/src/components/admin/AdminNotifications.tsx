import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Bell, Send, Sparkles } from 'lucide-react'
import AIContentAssistant from './AIContentAssistant'

interface Notification {
  id: string
  user_id: string | null
  title: string
  body: string | null
  type: string
  is_read: boolean
  created_at: string
}

const PLANS: Record<string, string> = {
  all: 'Todos os usuários',
  free: 'Gratuito',
  essential: 'Essencial',
  therapeutic: 'Terapêutico',
  'therapeutic-plus': 'Terapêutico Plus',
}

const TYPES: { value: string; label: string }[] = [
  { value: 'info', label: 'Informativo' },
  { value: 'content', label: 'Novo conteúdo' },
  { value: 'promo', label: 'Promoção' },
  { value: 'reminder', label: 'Lembrete' },
  { value: 'alert', label: 'Aviso importante' },
  { value: 'support_reply', label: 'Resposta de suporte' },
  { value: 'admin_message', label: 'Mensagem do admin' },
  { value: 'system', label: 'Sistema' },
]

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

export default function AdminNotifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetMode, setTargetMode] = useState<'all' | 'plan' | 'user'>('all')
  const [targetPlan, setTargetPlan] = useState('all')
  const [targetUserId, setTargetUserId] = useState('')
  const [type, setType] = useState('info')
  const [actionView, setActionView] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAI, setShowAI] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!title.trim() || !body.trim()) return
    setSaving(true)

    if (targetMode === 'user') {
      // Single user
      if (!targetUserId.trim()) { showToastMsg('Informe o ID do usuário.'); setSaving(false); return }
      const { error } = await supabase.from('notifications').insert({
        user_id: targetUserId.trim(),
        title, body, type, is_read: false,
        ...(actionView ? { action_view: actionView } : {}),
      })
      setSaving(false)
      if (error) { showToastMsg('Erro: ' + error.message); return }
    } else if (targetMode === 'plan' && targetPlan !== 'all') {
      // All users with that plan
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('plan', targetPlan)
      if (!profiles || profiles.length === 0) {
        showToastMsg('Nenhum usuário encontrado com esse plano.')
        setSaving(false)
        return
      }
      const rows = profiles.map(p => ({
        user_id: p.user_id,
        title, body, type, is_read: false,
        ...(actionView ? { action_view: actionView } : {}),
      }))
      const { error } = await supabase.from('notifications').insert(rows)
      setSaving(false)
      if (error) { showToastMsg('Erro: ' + error.message); return }
      showToastMsg(`Notificação enviada para ${rows.length} usuário(s)!`)
    } else {
      // All users
      const { data: profiles } = await supabase.from('profiles').select('user_id')
      if (!profiles || profiles.length === 0) {
        showToastMsg('Nenhum usuário encontrado.')
        setSaving(false)
        return
      }
      const rows = profiles.map(p => ({
        user_id: p.user_id,
        title, body, type, is_read: false,
        ...(actionView ? { action_view: actionView } : {}),
      }))
      const { error } = await supabase.from('notifications').insert(rows)
      setSaving(false)
      if (error) { showToastMsg('Erro: ' + error.message); return }
      showToastMsg(`Notificação enviada para ${rows.length} usuário(s)!`)
    }

    setShowForm(false); setTitle(''); setBody(''); setActionView('')
    load()
  }

  async function remove(id: string) {
    if (!confirm('Excluir notificação?')) return
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) { showToastMsg('Erro ao excluir: ' + error.message); return }
    load()
  }

  function showToastMsg(msg: string) {
    setToast(msg); setTimeout(() => setToast(null), 3500)
  }

  const typeLabel = (t: string) => TYPES.find(x => x.value === t)?.label ?? t

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-stone-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>}

      {showAI && (
        <AIContentAssistant
          contentType="notification"
          defaultTheme={`${TYPES.find(t => t.value === type)?.label ?? type}${title ? ` — ${title}` : ''}`}
          onInsert={result => {
            const titleMatch = result.match(/TÍTULO:\s*(.+)/i)
            const msgMatch   = result.match(/MENSAGEM:\s*(.+)/i)
            if (titleMatch) setTitle(titleMatch[1].trim())
            if (msgMatch)   setBody(msgMatch[1].trim())
          }}
          onClose={() => setShowAI(false)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Notificações</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700">
          <Plus className="w-4 h-4" /> Nova notificação
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Nova notificação</h2>
            <button
              onClick={() => setShowAI(true)}
              className="flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" /> Gerar com IA
            </button>
          </div>

          {/* Target mode */}
          <div>
            <label className="block text-xs text-stone-500 mb-1">Destinatário</label>
            <div className="flex gap-3">
              {(['all', 'plan', 'user'] as const).map(m => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={targetMode === m} onChange={() => setTargetMode(m)} className="accent-stone-800" />
                  <span className="text-sm text-stone-700">
                    {m === 'all' ? 'Todos' : m === 'plan' ? 'Por plano' : 'Usuário específico'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {targetMode === 'plan' && (
            <div>
              <label className="block text-xs text-stone-500 mb-1">Plano</label>
              <select value={targetPlan} onChange={e => setTargetPlan(e.target.value)} className={inputCls}>
                {Object.entries(PLANS).filter(([k]) => k !== 'all').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}

          {targetMode === 'user' && (
            <div>
              <label className="block text-xs text-stone-500 mb-1">User ID</label>
              <input
                value={targetUserId}
                onChange={e => setTargetUserId(e.target.value)}
                placeholder="UUID do usuário..."
                className={inputCls}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Título</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Novo artigo disponível!" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Ação ao clicar (opcional)</label>
            <select value={actionView} onChange={e => setActionView(e.target.value)} className={inputCls}>
              <option value="">Sem ação</option>
              <option value="my-evolution">Minha Evolução</option>
              <option value="my-evolution?tab=para-voce">Para Você</option>
              <option value="my-evolution?tab=orientacoes">Orientações</option>
              <option value="my-evolution?tab=relatorios">Relatórios</option>
              <option value="my-evolution?tab=autocuidado">Plano de Autocuidado</option>
              <option value="my-evolution?tab=sessao">Sessão Plus</option>
              <option value="my-evolution?tab=comentarios">Comentários Profissionais</option>
              <option value="my-plan">Meu Plano</option>
              <option value="support">Suporte</option>
              <option value="blog">Blog</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Mensagem</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Texto da notificação..." className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              <Send className="w-3.5 h-3.5" />
              {saving ? 'Enviando...' : 'Enviar notificação'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-stone-200 text-stone-600 text-sm rounded-lg hover:bg-stone-50">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma notificação criada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(n => (
            <div key={n.id} className="bg-white rounded-xl border border-stone-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${n.is_read ? 'bg-stone-100 text-stone-500' : 'bg-blue-100 text-blue-700'}`}>
                      {n.is_read ? 'Lida' : 'Não lida'}
                    </span>
                    <span className="text-xs text-stone-400">{typeLabel(n.type)}</span>
                    {n.user_id && <span className="text-xs text-stone-400 font-mono truncate max-w-[120px]">{n.user_id.slice(0, 8)}…</span>}
                  </div>
                  <p className="font-medium text-stone-800 text-sm">{n.title}</p>
                  {n.body && <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-stone-400 mt-1">{new Date(n.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
                <button onClick={() => remove(n.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
