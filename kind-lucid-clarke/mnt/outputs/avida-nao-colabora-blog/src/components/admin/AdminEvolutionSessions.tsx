import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Video, Calendar, CheckCircle, Clock, Plus, Loader2, Save } from 'lucide-react'

interface Session {
  id: string
  user_id: string
  month_key: string
  scheduled_at: string | null
  duration_minutes: number
  status: string
  notes: string | null
  professional_name: string | null
  meeting_link: string | null
  created_at: string
  user?: { full_name?: string; email?: string; plan?: string }
}

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

const STATUS_OPTIONS = [
  { value: 'available', label: 'Disponível' },
  { value: 'requested', label: 'Solicitada' },
  { value: 'scheduled', label: 'Agendada' },
  { value: 'completed', label: 'Realizada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'used', label: 'Utilizada' },
]

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  requested: 'bg-amber-100 text-amber-700',
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-stone-100 text-stone-600',
  cancelled: 'bg-red-100 text-red-600',
  used: 'bg-stone-100 text-stone-500',
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function AdminEvolutionSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Session | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  // Edit fields
  const [editStatus, setEditStatus] = useState('')
  const [editScheduledAt, setEditScheduledAt] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editProfessional, setEditProfessional] = useState('')
  const [editMeetingLink, setEditMeetingLink] = useState('')

  // Create fields
  const [createUserId, setCreateUserId] = useState('')
  const [createMonth, setCreateMonth] = useState(monthKey())
  const [plusUsers, setPlusUsers] = useState<{ id: string; full_name: string; email?: string }[]>([])

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: sess }, { data: users }] = await Promise.all([
      supabase.from('user_sessions').select('*, user:profiles(full_name, plan)').order('created_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('id, full_name, user_id').eq('plan', 'therapeutic-plus').limit(200),
    ])
    setSessions(sess ?? [])
    setPlusUsers((users ?? []).map((u: any) => ({ id: u.user_id ?? u.id, full_name: u.full_name ?? u.id })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openEdit(s: Session) {
    setSelected(s)
    setEditStatus(s.status)
    setEditScheduledAt(s.scheduled_at ? s.scheduled_at.slice(0, 16) : '')
    setEditNotes(s.notes ?? '')
    setEditProfessional(s.professional_name ?? '')
    setEditMeetingLink(s.meeting_link ?? '')
  }

  async function save() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('user_sessions').update({
      status: editStatus,
      scheduled_at: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
      notes: editNotes || null,
      professional_name: editProfessional || null,
      meeting_link: editMeetingLink || null,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id)

    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }

    // Notificar usuário se status mudou para agendada
    if (editStatus === 'scheduled' && selected.status !== 'scheduled') {
      await supabase.from('notifications').insert({
        user_id: selected.user_id,
        title: 'Sessão Plus agendada',
        body: `Sua sessão de ${monthLabel(selected.month_key)} foi agendada. Acesse Minha Evolução para ver os detalhes.`,
        type: 'system',
        action_view: 'my-evolution',
        action_label: 'Ver sessão',
        is_read: false,
      })
    }

    showToast('Sessão atualizada!')
    setSaving(false)
    setSelected(null)
    load()
  }

  async function createSession() {
    if (!createUserId) return
    setSaving(true)
    const { error } = await supabase.from('user_sessions').insert({
      user_id: createUserId,
      month_key: createMonth,
      status: 'available',
      duration_minutes: 30,
    })
    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }

    await supabase.from('notifications').insert({
      user_id: createUserId,
      title: 'Sessão Plus disponível',
      body: `Sua sessão de ${monthLabel(createMonth)} está disponível. Acesse Minha Evolução para solicitar o agendamento.`,
      type: 'system',
      action_view: 'my-evolution',
      action_label: 'Ver sessão',
      is_read: false,
    })

    showToast('Sessão criada e usuário notificado!')
    setSaving(false)
    setShowCreate(false)
    load()
  }

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-stone-800'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Sessões Plus</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700"
        >
          <Plus className="w-4 h-4" /> Criar sessão
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6 space-y-4 max-w-lg">
          <h2 className="font-semibold text-stone-700">Criar sessão para usuário Plus</h2>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Usuário (Terapêutico Plus)</label>
            <select value={createUserId} onChange={e => setCreateUserId(e.target.value)} className={inputCls}>
              <option value="">Selecione...</option>
              {plusUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Mês de referência</label>
            <input type="month" value={createMonth} onChange={e => setCreateMonth(e.target.value)} className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button onClick={createSession} disabled={saving || !createUserId} className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar e notificar
            </button>
            <button onClick={() => setShowCreate(false)} className="border border-stone-200 text-stone-600 text-sm px-4 py-2 rounded-lg hover:bg-stone-50">Cancelar</button>
          </div>
        </div>
      )}

      {selected ? (
        <div className="max-w-lg space-y-5">
          <button onClick={() => setSelected(null)} className="text-sm text-stone-500 hover:text-stone-700">← Voltar</button>
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <div>
              <p className="font-semibold text-stone-800">{(selected.user as any)?.full_name ?? selected.user_id}</p>
              <p className="text-xs text-stone-400">{monthLabel(selected.month_key)}</p>
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={inputCls}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Data e hora agendada</label>
              <input type="datetime-local" value={editScheduledAt} onChange={e => setEditScheduledAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Profissional responsável</label>
              <input value={editProfessional} onChange={e => setEditProfessional(e.target.value)} placeholder="Nome do profissional" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Link da sessão (Google Meet, Zoom...)</label>
              <input value={editMeetingLink} onChange={e => setEditMeetingLink(e.target.value)} placeholder="https://..." className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Observações internas</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} className={inputCls} />
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <p className="text-stone-400 text-sm">Carregando...</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Video className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma sessão registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 cursor-pointer"
              onClick={() => openEdit(s)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-stone-800 text-sm">{(s.user as any)?.full_name ?? s.user_id}</p>
                  <p className="text-xs text-stone-400">{monthLabel(s.month_key)}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[s.status] ?? 'bg-stone-100 text-stone-500'}`}>
                  {STATUS_OPTIONS.find(o => o.value === s.status)?.label ?? s.status}
                </span>
              </div>
              {s.scheduled_at && (
                <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(s.scheduled_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {s.professional_name && <p className="text-xs text-stone-500 mt-0.5">{s.professional_name}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
