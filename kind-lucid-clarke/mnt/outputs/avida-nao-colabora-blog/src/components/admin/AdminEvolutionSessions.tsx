import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Video, Calendar, CheckCircle, Clock, Plus, Loader2, Save,
  Filter, X, AlertCircle, RefreshCw,
} from 'lucide-react'

interface Slot {
  label: string
  datetime: string
  period: string
}

interface Session {
  id: string
  user_id: string
  month_key: string
  scheduled_at: string | null
  duration_minutes: number
  status: string
  preferred_slots: Slot[] | null
  user_notes: string | null
  admin_notes: string | null
  professional_name: string | null
  professional_id: string | null
  meeting_link: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  user?: { full_name?: string; email?: string; plan?: string }
}

interface Professional {
  id: string
  name: string
  specialty: string
}

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

const STATUS_LABELS: Record<string, string> = {
  available:   'Disponível',
  requested:   'Aguardando confirmação',
  scheduled:   'Agendada',
  rescheduled: 'Remarcada',
  completed:   'Realizada',
  cancelled:   'Cancelada',
  used:        'Utilizada',
}

const STATUS_COLORS: Record<string, string> = {
  available:   'bg-blue-100 text-blue-700',
  requested:   'bg-amber-100 text-amber-700',
  scheduled:   'bg-emerald-100 text-emerald-700',
  rescheduled: 'bg-purple-100 text-purple-700',
  completed:   'bg-stone-200 text-stone-600',
  cancelled:   'bg-red-100 text-red-600',
  used:        'bg-stone-100 text-stone-500',
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial',
  therapeutic: 'Terapêutico', 'therapeutic-plus': 'Terapêutico Plus',
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-stone-100 text-stone-500',
  essential: 'bg-blue-100 text-blue-700',
  therapeutic: 'bg-purple-100 text-purple-700',
  'therapeutic-plus': 'bg-emerald-100 text-emerald-700',
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthOptions() {
  const opts: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return opts
}

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminEvolutionSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Session | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [professionals, setProfessionals] = useState<Professional[]>([])

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')

  // Edit fields
  const [editScheduledAt, setEditScheduledAt] = useState('')
  const [editProfessionalId, setEditProfessionalId] = useState('')
  const [editProfessionalName, setEditProfessionalName] = useState('')
  const [editMeetingLink, setEditMeetingLink] = useState('')
  const [editAdminNotes, setEditAdminNotes] = useState('')
  const [editCancelReason, setEditCancelReason] = useState('')

  // Create fields
  const [createUserId, setCreateUserId] = useState('')
  const [createMonth, setCreateMonth] = useState(monthKey())
  const [plusUsers, setPlusUsers] = useState<{ id: string; full_name: string }[]>([])

  const monthOptions = getMonthOptions()

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: sess }, { data: users }, { data: profs }] = await Promise.all([
      supabase
        .from('user_sessions')
        .select('*, user:profiles(full_name, email, plan)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('profiles')
        .select('id, full_name, user_id')
        .eq('plan', 'therapeutic-plus')
        .limit(200),
      supabase
        .from('professionals')
        .select('id, name, specialty')
        .eq('active', true)
        .order('name'),
    ])
    setSessions(sess ?? [])
    setPlusUsers((users ?? []).map((u: any) => ({
      id: u.user_id ?? u.id,
      full_name: u.full_name ?? u.id,
    })))
    setProfessionals(profs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openEdit(s: Session) {
    setSelected(s)
    setEditScheduledAt(s.scheduled_at ? s.scheduled_at.slice(0, 16) : '')
    setEditProfessionalId(s.professional_id ?? '')
    setEditProfessionalName(s.professional_name ?? '')
    setEditMeetingLink(s.meeting_link ?? '')
    setEditAdminNotes(s.admin_notes ?? '')
    setEditCancelReason('')
  }

  function resolvedProfessionalName() {
    if (editProfessionalId) {
      const p = professionals.find(p => p.id === editProfessionalId)
      return p?.name ?? editProfessionalName
    }
    return editProfessionalName
  }

  async function confirmSession() {
    if (!selected) return
    setSaving(true)
    const profName = resolvedProfessionalName()
    const { error } = await supabase.from('user_sessions').update({
      status: 'scheduled',
      scheduled_at: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
      professional_id: editProfessionalId || null,
      professional_name: profName || null,
      meeting_link: editMeetingLink || null,
      admin_notes: editAdminNotes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id)

    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }

    const dateStr = editScheduledAt
      ? new Date(editScheduledAt).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : null

    await supabase.from('notifications').insert({
      user_id: selected.user_id,
      title: 'Sua sessão foi agendada',
      body: dateStr
        ? `Sua sessão mensal foi confirmada para ${dateStr}. Acesse Minha Sessão para ver os detalhes.`
        : 'Sua sessão mensal foi confirmada. Acesse Minha Evolução para ver os detalhes.',
      type: 'system',
      action_view: 'my-evolution',
      action_label: 'Ver minha sessão',
      is_read: false,
    })

    showToast('Sessão confirmada e usuário notificado!')
    setSaving(false)
    setSelected(null)
    load()
  }

  async function rescheduleSession() {
    if (!selected || !editScheduledAt) {
      showToast('Informe a nova data e horário.', true); return
    }
    setSaving(true)
    const profName = resolvedProfessionalName()
    const { error } = await supabase.from('user_sessions').update({
      status: 'rescheduled',
      scheduled_at: new Date(editScheduledAt).toISOString(),
      professional_id: editProfessionalId || null,
      professional_name: profName || null,
      meeting_link: editMeetingLink || null,
      admin_notes: editAdminNotes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id)

    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }

    const dateStr = new Date(editScheduledAt).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    await supabase.from('notifications').insert({
      user_id: selected.user_id,
      title: 'Sua sessão foi remarcada',
      body: `Sua sessão foi remarcada para ${dateStr}. Acesse Minha Evolução para ver o novo horário.`,
      type: 'system',
      action_view: 'my-evolution',
      action_label: 'Ver minha sessão',
      is_read: false,
    })

    showToast('Sessão remarcada e usuário notificado!')
    setSaving(false)
    setSelected(null)
    load()
  }

  async function completeSession() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('user_sessions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      admin_notes: editAdminNotes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id)

    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }

    await supabase.from('notifications').insert({
      user_id: selected.user_id,
      title: 'Sessão registrada como realizada',
      body: 'Sua sessão deste mês foi registrada como realizada.',
      type: 'system',
      action_view: 'my-evolution',
      action_label: 'Ver minha sessão',
      is_read: false,
    })

    showToast('Sessão marcada como realizada!')
    setSaving(false)
    setSelected(null)
    load()
  }

  async function cancelSession() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('user_sessions').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      admin_notes: editCancelReason || editAdminNotes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id)

    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }

    await supabase.from('notifications').insert({
      user_id: selected.user_id,
      title: 'Sessão cancelada',
      body: 'Sua sessão foi cancelada. Entre em contato com o suporte caso precise de ajuda.',
      type: 'system',
      action_view: 'support',
      action_label: 'Falar com suporte',
      is_read: false,
    })

    showToast('Sessão cancelada e usuário notificado!')
    setSaving(false)
    setSelected(null)
    load()
  }

  async function saveNotes() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('user_sessions').update({
      admin_notes: editAdminNotes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id)
    if (error) { showToast('Erro: ' + error.message, true) } else { showToast('Notas salvas!') }
    setSaving(false)
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
      action_label: 'Ver minha sessão',
      is_read: false,
    })

    showToast('Sessão criada e usuário notificado!')
    setSaving(false)
    setShowCreate(false)
    load()
  }

  const filtered = sessions.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (monthFilter !== 'all' && s.month_key !== monthFilter) return false
    return true
  })

  const requestedCount = sessions.filter(s => s.status === 'requested').length

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-stone-800'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Sessões Plus</h1>
          {requestedCount > 0 && (
            <p className="text-sm text-amber-600 font-medium mt-0.5">{requestedCount} aguardando confirmação</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load()}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-lg"
            title="Recarregar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700"
          >
            <Plus className="w-4 h-4" /> Criar sessão
          </button>
        </div>
      </div>

      {/* Criar sessão */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6 space-y-4 max-w-lg">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-700">Criar sessão para usuário Plus</h2>
            <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-stone-400" /></button>
          </div>
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
            <button
              onClick={createSession}
              disabled={saving || !createUserId}
              className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar e notificar
            </button>
            <button onClick={() => setShowCreate(false)} className="border border-stone-200 text-stone-600 text-sm px-4 py-2 rounded-lg hover:bg-stone-50">Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {(['all', 'requested', 'scheduled', 'rescheduled', 'completed', 'cancelled'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === f ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            {f === 'all' ? 'Todas' : STATUS_LABELS[f]}
          </button>
        ))}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${showFilters ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}
        >
          <Filter className="w-3.5 h-3.5" /> Mês
          {monthFilter !== 'all' && <span className="w-2 h-2 bg-emerald-500 rounded-full" />}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 bg-stone-50 border border-stone-100 rounded-xl p-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Mês</label>
            <select
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="text-sm px-2 py-1.5 border border-stone-200 rounded-lg bg-white focus:outline-none"
            >
              <option value="all">Todos</option>
              {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Detalhe */}
      {selected ? (
        <div className="max-w-2xl space-y-5">
          <button
            onClick={() => setSelected(null)}
            className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1"
          >
            ← Voltar
          </button>

          {/* Info do usuário */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold text-stone-800">{(selected.user as any)?.full_name ?? 'Usuário'}</p>
                {(selected.user as any)?.email && (
                  <p className="text-xs text-stone-400">{(selected.user as any).email}</p>
                )}
                <p className="text-xs text-stone-400 mt-0.5">{monthLabel(selected.month_key)}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(selected.user as any)?.plan && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[(selected.user as any).plan] ?? 'bg-stone-100'}`}>
                    {PLAN_LABELS[(selected.user as any).plan] ?? (selected.user as any).plan}
                  </span>
                )}
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[selected.status] ?? 'bg-stone-100'}`}>
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </span>
              </div>
            </div>

            {/* Slots enviados pelo usuário */}
            {selected.preferred_slots && selected.preferred_slots.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-amber-700 mb-2">Opções de horário enviadas pelo usuário:</p>
                {selected.preferred_slots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-stone-700 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="font-medium">{slot.label}:</span>
                    {new Date(slot.datetime).toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {slot.period && <span className="text-xs text-stone-400">({slot.period})</span>}
                  </div>
                ))}
              </div>
            )}

            {selected.user_notes && (
              <div className="bg-stone-50 rounded-lg p-3">
                <p className="text-xs text-stone-500 font-medium mb-1">Observações do usuário:</p>
                <p className="text-sm text-stone-600">{selected.user_notes}</p>
              </div>
            )}
          </div>

          {/* Campos admin */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <h3 className="font-medium text-stone-700">Configurar sessão</h3>

            <div>
              <label className="text-xs text-stone-500 block mb-1">Profissional</label>
              {professionals.length > 0 ? (
                <select
                  value={editProfessionalId}
                  onChange={e => {
                    setEditProfessionalId(e.target.value)
                    const p = professionals.find(p => p.id === e.target.value)
                    if (p) setEditProfessionalName(p.name)
                  }}
                  className={inputCls}
                >
                  <option value="">Profissional a definir</option>
                  {professionals.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.specialty}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={editProfessionalName}
                  onChange={e => setEditProfessionalName(e.target.value)}
                  placeholder="Nome do profissional (nenhum cadastrado)"
                  className={inputCls}
                />
              )}
            </div>

            <div>
              <label className="text-xs text-stone-500 block mb-1">Data e horário confirmado</label>
              <input
                type="datetime-local"
                value={editScheduledAt}
                onChange={e => setEditScheduledAt(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-xs text-stone-500 block mb-1">Link da sessão (Google Meet, Zoom…)</label>
              <input
                value={editMeetingLink}
                onChange={e => setEditMeetingLink(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-xs text-stone-500 block mb-1">Notas internas</label>
              <textarea
                value={editAdminNotes}
                onChange={e => setEditAdminNotes(e.target.value)}
                rows={3}
                placeholder="Observações visíveis apenas para a equipe..."
                className={inputCls}
              />
            </div>

            {/* Ações */}
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <p className="text-xs text-stone-500 font-medium">Ações:</p>
              <div className="flex flex-wrap gap-2">
                {/* Confirmar */}
                {['available', 'requested'].includes(selected.status) && (
                  <button
                    onClick={confirmSession}
                    disabled={saving}
                    className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Confirmar sessão
                  </button>
                )}

                {/* Remarcar */}
                {['scheduled', 'rescheduled', 'requested'].includes(selected.status) && (
                  <button
                    onClick={rescheduleSession}
                    disabled={saving}
                    className="flex items-center gap-2 bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Remarcar sessão
                  </button>
                )}

                {/* Marcar realizada */}
                {['scheduled', 'rescheduled'].includes(selected.status) && (
                  <button
                    onClick={completeSession}
                    disabled={saving}
                    className="flex items-center gap-2 bg-stone-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-stone-800 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                    Marcar como realizada
                  </button>
                )}

                {/* Salvar notas */}
                <button
                  onClick={saveNotes}
                  disabled={saving}
                  className="flex items-center gap-2 border border-stone-200 text-stone-600 text-sm px-4 py-2 rounded-lg hover:bg-stone-50 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar notas
                </button>
              </div>

              {/* Cancelar */}
              {!['completed', 'used', 'cancelled'].includes(selected.status) && (
                <div className="border border-red-100 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-red-600">Cancelar sessão</p>
                  <input
                    value={editCancelReason}
                    onChange={e => setEditCancelReason(e.target.value)}
                    placeholder="Motivo do cancelamento (opcional)..."
                    className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                  <button
                    onClick={cancelSession}
                    disabled={saving}
                    className="flex items-center gap-2 bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Cancelar sessão
                  </button>
                </div>
              )}
            </div>

            {/* Dados existentes confirmados */}
            {selected.scheduled_at && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-emerald-700">Sessão confirmada:</p>
                <p className="text-sm text-stone-700 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  {formatDateBR(selected.scheduled_at)}
                </p>
                {selected.professional_name && (
                  <p className="text-sm text-stone-600">Profissional: {selected.professional_name}</p>
                )}
                {selected.meeting_link && (
                  <a href={selected.meeting_link} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline break-all">{selected.meeting_link}</a>
                )}
              </div>
            )}
          </div>
        </div>
      ) : loading ? (
        <p className="text-stone-400 text-sm py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Video className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma sessão encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 cursor-pointer transition-colors"
              onClick={() => openEdit(s)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-medium text-stone-800 text-sm">{(s.user as any)?.full_name ?? s.user_id}</p>
                    {(s.user as any)?.plan && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[(s.user as any).plan] ?? 'bg-stone-100'}`}>
                        {PLAN_LABELS[(s.user as any).plan] ?? (s.user as any).plan}
                      </span>
                    )}
                  </div>
                  {(s.user as any)?.email && (
                    <p className="text-xs text-stone-400">{(s.user as any).email}</p>
                  )}
                  <p className="text-xs text-stone-400 mt-0.5">{monthLabel(s.month_key)}</p>
                  {s.scheduled_at && (
                    <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatDateBR(s.scheduled_at)}
                    </p>
                  )}
                  {s.professional_name && (
                    <p className="text-xs text-stone-500 mt-0.5">{s.professional_name}</p>
                  )}
                  {s.preferred_slots && s.preferred_slots.length > 0 && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      {s.preferred_slots.length} opção(ões) enviada(s)
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[s.status] ?? 'bg-stone-100 text-stone-500'}`}>
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
