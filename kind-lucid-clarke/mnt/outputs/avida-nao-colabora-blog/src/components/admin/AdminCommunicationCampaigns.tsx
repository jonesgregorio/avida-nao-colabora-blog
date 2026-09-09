import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logAdminAction } from '../../lib/adminAudit'
import { createUserNotification } from '../../lib/notifications'
import { Megaphone, Plus, Send, Clock, Save, FlaskConical, Loader2, Users } from 'lucide-react'

interface Campaign {
  id: string
  channel: 'in_app' | 'email'
  title: string
  message: string
  action_url: string | null
  target_kind: 'all' | 'plan' | 'segment' | 'user'
  target_plan: string | null
  target_segment_id: string | null
  target_user_id: string | null
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'canceled'
  scheduled_for: string | null
  sent_at: string | null
  recipients_count: number | null
  sent_count: number | null
  last_error: string | null
  created_at: string
}

interface SegmentOpt { id: string; name: string }

const STATUS_LABEL: Record<Campaign['status'], string> = {
  draft: 'Rascunho', scheduled: 'Agendada', sending: 'Enviando', sent: 'Enviada', failed: 'Falhou', canceled: 'Cancelada',
}
const STATUS_CLS: Record<Campaign['status'], string> = {
  draft: 'bg-stone-100 text-stone-600', scheduled: 'bg-blue-100 text-blue-700', sending: 'bg-amber-100 text-amber-700',
  sent: 'bg-mint text-forest-800', failed: 'bg-red-100 text-red-700', canceled: 'bg-stone-100 text-stone-400',
}
const ACTION_VIEWS = [
  ['', 'Sem ação'], ['articles', 'Conteúdos'], ['my-report', 'Relatórios'], ['self-care', 'Plano de autocuidado'],
  ['monthly-guidance', 'Orientação mensal'], ['my-plan', 'Meu plano'], ['support', 'Suporte'], ['notifications', 'Notificações'],
] as const
const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

export default function AdminCommunicationCampaigns({ initialCampaignId }: { initialCampaignId?: string | null } = {}) {
  const [items, setItems] = useState<Campaign[]>([])
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [segments, setSegments] = useState<SegmentOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [notAvailable, setNotAvailable] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [channel, setChannel] = useState<'in_app' | 'email'>('in_app')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [targetKind, setTargetKind] = useState<Campaign['target_kind']>('all')
  const [targetPlan, setTargetPlan] = useState('essential')
  const [targetSegmentId, setTargetSegmentId] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [estimate, setEstimate] = useState<number | null>(null)
  const [estimating, setEstimating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('admin_communications').select('*').order('created_at', { ascending: false }).limit(100)
    if (error) {
      const code = (error as { code?: string }).code
      if (code === 'PGRST205' || code === '42P01') setNotAvailable(true)
      else setMsg({ ok: false, text: 'Erro ao carregar campanhas: ' + error.message })
      setItems([])
    } else {
      setItems((data ?? []) as Campaign[])
    }
    const { data: segs } = await supabase.from('admin_segments').select('id, name').order('created_at', { ascending: false })
    setSegments((segs ?? []) as SegmentOpt[])
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  // Deep-link da busca global: rola até a campanha e a destaca por alguns segundos.
  useEffect(() => {
    if (!initialCampaignId || loading || !items.some(c => c.id === initialCampaignId)) return
    const el = document.getElementById(`campaign-${initialCampaignId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(initialCampaignId)
    const t = window.setTimeout(() => setHighlightId(null), 4000)
    return () => window.clearTimeout(t)
  }, [initialCampaignId, loading, items])

  const targetArgs = useMemo(() => ({
    p_kind: targetKind,
    p_plan: targetKind === 'plan' ? targetPlan : null,
    p_segment_id: targetKind === 'segment' ? (targetSegmentId || null) : null,
    p_user_id: targetKind === 'user' ? (targetUserId.trim() || null) : null,
  }), [targetKind, targetPlan, targetSegmentId, targetUserId])

  useEffect(() => {
    if (!showForm) return
    if (targetKind === 'segment' && !targetSegmentId) { setEstimate(null); return }
    if (targetKind === 'user' && !targetUserId.trim()) { setEstimate(null); return }
    setEstimating(true)
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('admin_communication_estimate', targetArgs)
      setEstimate(error ? null : (data as number))
      setEstimating(false)
    }, 400)
    return () => clearTimeout(t)
  }, [showForm, targetArgs, targetKind, targetSegmentId, targetUserId])

  function resetForm() {
    setChannel('in_app'); setTitle(''); setMessage(''); setActionUrl(''); setTargetKind('all')
    setTargetPlan('essential'); setTargetSegmentId(''); setTargetUserId(''); setScheduledFor(''); setEstimate(null)
  }

  const canSave = title.trim().length > 0 && message.trim().length > 0
    && (targetKind !== 'segment' || targetSegmentId)
    && (targetKind !== 'user' || targetUserId.trim())

  async function createRow(status: 'draft' | 'scheduled'): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    const row = {
      channel, title: title.trim(), message: message.trim(), action_url: actionUrl || null,
      target_kind: targetKind, target_plan: targetKind === 'plan' ? targetPlan : null,
      target_segment_id: targetKind === 'segment' ? targetSegmentId : null,
      target_user_id: targetKind === 'user' ? targetUserId.trim() : null,
      status, scheduled_for: status === 'scheduled' ? new Date(scheduledFor).toISOString() : null,
      created_by: user?.id ?? null,
    }
    const { data, error } = await supabase.from('admin_communications').insert(row).select('id').single()
    if (error) { setMsg({ ok: false, text: 'Erro ao salvar: ' + error.message }); return null }
    void logAdminAction('create', 'communication', (data as { id: string }).id, { channel, target_kind: targetKind, status })
    return (data as { id: string }).id
  }

  async function salvarRascunho() {
    setBusy('draft'); setMsg(null)
    const id = await createRow('draft')
    if (id) { setMsg({ ok: true, text: 'Rascunho salvo.' }); setShowForm(false); resetForm(); await load() }
    setBusy(null)
  }

  async function agendar() {
    if (!scheduledFor) { setMsg({ ok: false, text: 'Escolha data e hora.' }); return }
    if (new Date(scheduledFor).getTime() <= Date.now()) { setMsg({ ok: false, text: 'A data precisa ser no futuro.' }); return }
    if (channel === 'email') { setMsg({ ok: false, text: 'Agendamento automático só para notificação in-app.' }); return }
    setBusy('schedule'); setMsg(null)
    const id = await createRow('scheduled')
    if (id) { setMsg({ ok: true, text: `Campanha agendada para ${new Date(scheduledFor).toLocaleString('pt-BR')}.` }); setShowForm(false); resetForm(); await load() }
    setBusy(null)
  }

  async function enviarTeste() {
    setBusy('test'); setMsg(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusy(null); return }
    const r = await createUserNotification({
      userId: user.id, type: 'admin_message', title: `[TESTE] ${title || 'sem título'}`,
      message: message || '(sem mensagem)', destination: actionUrl || 'notifications',
    })
    setMsg(r.ok ? { ok: true, text: 'Notificação de teste enviada para a sua conta.' } : { ok: false, text: 'Falha no teste: ' + (r.error ?? '') })
    setBusy(null)
  }

  async function enviarAgora() {
    if (channel === 'email') { setMsg({ ok: false, text: 'Envio de e-mail em massa passa pelo pipeline de e-mail (aba E-mails / Criador com IA). Aqui: só in-app.' }); return }
    const n = estimate ?? 0
    if (!window.confirm(`Enviar a notificação "${title}" agora para ${n} usuário(s)? Para confirmar, isso é imediato.`)) return
    setBusy('send'); setMsg(null)
    const id = await createRow('draft')
    if (!id) { setBusy(null); return }
    const { data, error } = await supabase.rpc('admin_communication_send', { p_id: id })
    if (error) setMsg({ ok: false, text: 'Erro no envio: ' + error.message })
    else {
      const sent = ((data ?? {}) as { sent?: number }).sent ?? 0
      void logAdminAction('config', 'communication_send', id, { sent })
      setMsg({ ok: true, text: `Enviada para ${sent} usuário(s).` })
      setShowForm(false); resetForm()
    }
    await load()
    setBusy(null)
  }

  async function enviarCampanhaExistente(c: Campaign) {
    if (!window.confirm(`Enviar agora a campanha "${c.title}"?`)) return
    setBusy(c.id)
    const { data, error } = await supabase.rpc('admin_communication_send', { p_id: c.id })
    if (error) setMsg({ ok: false, text: 'Erro: ' + error.message })
    else {
      void logAdminAction('config', 'communication_send', c.id, { sent: ((data ?? {}) as { sent?: number }).sent ?? 0 })
      setMsg({ ok: true, text: 'Campanha enviada.' })
    }
    await load()
    setBusy(null)
  }

  const targetLabel = (c: Campaign) =>
    c.target_kind === 'all' ? 'Todos'
      : c.target_kind === 'plan' ? `Plano ${c.target_plan}`
        : c.target_kind === 'segment' ? `Segmento: ${segments.find(s => s.id === c.target_segment_id)?.name ?? '—'}`
          : `Usuário ${c.target_user_id?.slice(0, 8) ?? ''}`

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-serif text-2xl text-forest-900 flex items-center gap-2"><Megaphone className="w-5 h-5 text-forest-600" /> Campanhas</h1>
          <p className="text-sm text-ink-soft mt-1">Um envio = uma campanha, com alvo, rascunho, agendamento, teste e histórico.</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setMsg(null) }} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-forest-800">
          <Plus className="w-4 h-4" /> Nova campanha
        </button>
      </div>

      {notAvailable && (
        <div className="mb-4 text-sm bg-amber-50 border border-amber-200 text-amber-800 px-3.5 py-2.5 rounded-xl">
          As Campanhas ficam disponíveis após o deploy desta etapa.
        </div>
      )}
      {msg && <div className={`mb-4 text-sm px-3.5 py-2.5 rounded-xl border ${msg.ok ? 'bg-mint/50 text-forest-800 border-forest-100' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg.text}</div>}

      {showForm && (
        <div className="bg-white border border-line rounded-2xl p-5 mb-6 space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="text-xs text-stone-500 space-y-1">
              <span className="block">Canal</span>
              <select value={channel} onChange={e => setChannel(e.target.value as 'in_app' | 'email')} className={inputCls}>
                <option value="in_app">Notificação no app</option>
                <option value="email">E-mail</option>
              </select>
            </label>
            <label className="text-xs text-stone-500 space-y-1 flex-1 min-w-[180px]">
              <span className="block">Ação ao clicar</span>
              <select value={actionUrl} onChange={e => setActionUrl(e.target.value)} className={inputCls}>
                {ACTION_VIEWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>

          {channel === 'email' && (
            <p className="text-xs bg-stone-50 border border-line rounded-lg px-3 py-2 text-stone-500">
              E-mail em massa não é disparado aqui — o envio segue pelo pipeline de e-mail (abas E-mails / Criador com IA). A campanha pode ser salva como registro.
            </p>
          )}

          <div className="grid sm:grid-cols-[140px_1fr] gap-3">
            <label className="text-xs text-stone-500 space-y-1">
              <span className="block">Destinatário</span>
              <select value={targetKind} onChange={e => setTargetKind(e.target.value as Campaign['target_kind'])} className={inputCls}>
                <option value="all">Todos</option>
                <option value="plan">Por plano</option>
                <option value="segment">Por segmento</option>
                <option value="user">Usuário específico</option>
              </select>
            </label>
            <div className="flex items-end">
              {targetKind === 'plan' && (
                <select value={targetPlan} onChange={e => setTargetPlan(e.target.value)} className={inputCls}>
                  <option value="free">Gratuito</option><option value="essential">Essencial</option><option value="plus">Plus</option>
                </select>
              )}
              {targetKind === 'segment' && (
                <select value={targetSegmentId} onChange={e => setTargetSegmentId(e.target.value)} className={inputCls}>
                  <option value="">Escolha um público salvo…</option>
                  {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {targetKind === 'user' && (
                <input value={targetUserId} onChange={e => setTargetUserId(e.target.value)} placeholder="UUID do usuário" className={inputCls} />
              )}
              {targetKind === 'all' && <p className="text-xs text-stone-400 py-2">Todos os usuários cadastrados.</p>}
            </div>
          </div>

          <div className="text-xs text-forest-700 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {estimating ? 'calculando destinatários…' : estimate == null ? 'defina o alvo para ver a contagem' : `${estimate} destinatário(s)`}
          </div>

          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título" className={inputCls} />
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Mensagem" className={inputCls} />

          {(title || message) && (
            <div className="bg-stone-50 border border-line rounded-lg p-3">
              <p className="text-[11px] font-semibold text-stone-500 mb-1">Prévia</p>
              <p className="text-sm font-medium text-forest-900">{title || '(título)'}</p>
              <p className="text-xs text-stone-600">{message || '(mensagem)'}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={salvarRascunho} disabled={!canSave || busy !== null} className="inline-flex items-center gap-1.5 text-sm border border-line rounded-lg px-3 py-2 hover:border-forest-300 disabled:opacity-40">
              {busy === 'draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar rascunho
            </button>
            <button onClick={enviarTeste} disabled={!canSave || busy !== null} className="inline-flex items-center gap-1.5 text-sm border border-line rounded-lg px-3 py-2 hover:border-forest-300 disabled:opacity-40">
              {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />} Enviar teste
            </button>
            <div className="flex items-center gap-1.5">
              <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} className="px-2 py-1.5 border border-line rounded-lg text-xs" />
              <button onClick={agendar} disabled={!canSave || busy !== null} className="inline-flex items-center gap-1.5 text-sm border border-line rounded-lg px-3 py-2 hover:border-forest-300 disabled:opacity-40">
                {busy === 'schedule' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />} Agendar
              </button>
            </div>
            <button onClick={enviarAgora} disabled={!canSave || busy !== null || channel === 'email'} className="inline-flex items-center gap-1.5 text-sm bg-forest-700 text-white rounded-lg px-3 py-2 hover:bg-forest-800 disabled:opacity-40">
              {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar agora
            </button>
          </div>
        </div>
      )}

      <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">Histórico</h2>
      {loading ? (
        <p className="text-sm text-ink-soft">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-soft">Nenhuma campanha ainda.</p>
      ) : (
        <div className="space-y-2">
          {items.map(c => (
            <div
              key={c.id}
              id={`campaign-${c.id}`}
              className={`bg-white border rounded-xl p-4 transition-shadow ${highlightId === c.id ? 'border-forest-400 ring-2 ring-forest-200' : 'border-line'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                    <span className="text-[11px] text-stone-400">{c.channel === 'in_app' ? 'App' : 'E-mail'}</span>
                    <span className="text-[11px] text-stone-400">· {targetLabel(c)}</span>
                  </div>
                  <p className="text-sm font-medium text-forest-900">{c.title}</p>
                  <p className="text-xs text-stone-500 line-clamp-1">{c.message}</p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    {c.status === 'sent' && c.sent_at ? `Enviada ${new Date(c.sent_at).toLocaleString('pt-BR')} · ${c.sent_count ?? 0}/${c.recipients_count ?? 0}`
                      : c.status === 'scheduled' && c.scheduled_for ? `Agendada para ${new Date(c.scheduled_for).toLocaleString('pt-BR')}`
                        : c.status === 'failed' ? `Falha: ${c.last_error ?? 'erro'}`
                          : `Criada ${new Date(c.created_at).toLocaleString('pt-BR')}`}
                  </p>
                </div>
                {(c.status === 'draft' || c.status === 'failed') && c.channel === 'in_app' && (
                  <button onClick={() => enviarCampanhaExistente(c)} disabled={busy === c.id} className="inline-flex items-center gap-1.5 text-xs border border-line rounded-lg px-2.5 py-1.5 hover:border-forest-300 flex-shrink-0">
                    {busy === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
