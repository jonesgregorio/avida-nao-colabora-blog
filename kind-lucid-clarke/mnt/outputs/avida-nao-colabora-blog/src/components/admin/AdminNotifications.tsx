import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Bell, Send } from 'lucide-react'

interface Notification {
  id: string
  title: string
  body: string
  target_plan: string
  type: string
  sent_at: string | null
  created_at: string
  status: 'draft' | 'sent'
}

const PLANS: Record<string, string> = {
  all: 'Todos os usuários',
  free: 'Gratuito',
  essential: 'Essencial',
  therapeutic: 'Terapêutico',
  'therapeutic-plus': 'Terapêutico Plus',
}

const TYPES = ['Informativo', 'Novo conteúdo', 'Promoção', 'Lembrete', 'Aviso importante']

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

export default function AdminNotifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetPlan, setTargetPlan] = useState('all')
  const [type, setType] = useState(TYPES[0])
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    const { error } = await supabase.from('notifications').insert({
      title, body, target_plan: targetPlan, type, status: 'draft',
    })
    setSaving(false)
    if (error) { showToast('Erro: ' + error.message); return }
    showToast('Notificação criada!')
    setShowForm(false); setTitle(''); setBody(''); load()
  }

  async function markSent(id: string) {
    if (!confirm('Marcar esta notificação como enviada?')) return
    const { error } = await supabase.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
    if (error) { showToast('Erro: ' + error.message); return }
    load()
    showToast('Marcada como enviada!')
  }

  async function remove(id: string) {
    if (!confirm('Excluir notificação?')) return
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) { showToast('Erro ao excluir: ' + error.message); return }
    load()
  }

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(null), 3000)
  }

  const drafts = items.filter(i => i.status === 'draft')
  const sent = items.filter(i => i.status === 'sent')

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-stone-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Notificações</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700">
          <Plus className="w-4 h-4" /> Nova notificação
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Nova notificação</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Título</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Novo artigo disponível!" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Público alvo</label>
              <select value={targetPlan} onChange={e => setTargetPlan(e.target.value)} className={inputCls}>
                {Object.entries(PLANS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Mensagem</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Texto da notificação..." className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar como rascunho'}
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
        <div className="space-y-6">
          {drafts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3">Rascunhos ({drafts.length})</h2>
              <NotifList items={drafts} plans={PLANS} onSend={markSent} onDelete={remove} />
            </div>
          )}
          {sent.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3">Enviadas ({sent.length})</h2>
              <NotifList items={sent} plans={PLANS} onSend={markSent} onDelete={remove} />
            </div>
          )}
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Envio automático em breve:</strong> Integração com push notifications e e-mail para disparar notificações diretamente pelo painel.
      </div>
    </div>
  )
}

function NotifList({ items, plans, onSend, onDelete }: {
  items: Notification[]
  plans: Record<string, string>
  onSend: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      {items.map(n => (
        <div key={n.id} className={`bg-white rounded-xl border p-4 ${n.status === 'draft' ? 'border-amber-100' : 'border-stone-200'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${n.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {n.status === 'draft' ? 'Rascunho' : 'Enviada'}
                </span>
                <span className="text-xs text-stone-400">{n.type}</span>
                <span className="text-xs text-stone-400">→ {plans[n.target_plan] || n.target_plan}</span>
              </div>
              <p className="font-medium text-stone-800 text-sm">{n.title}</p>
              <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{n.body}</p>
              {n.sent_at && (
                <p className="text-xs text-stone-400 mt-1">Enviada em {new Date(n.sent_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {n.status === 'draft' && (
                <button onClick={() => onSend(n.id)} className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Marcar como enviada">
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => onDelete(n.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
