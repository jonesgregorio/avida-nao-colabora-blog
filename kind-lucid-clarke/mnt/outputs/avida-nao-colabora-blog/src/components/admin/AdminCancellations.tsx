import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { reasonsLabel } from '../../lib/cancelReasons'
import { emailCancellationReply } from '../../lib/emailTriggers'
import { resolveEffectivePeriodEnd, formatBillingDate } from '../../lib/billingCycle'
import { Ban, RefreshCw, Loader2, Send, Check, X, Mail, MessageSquare, CreditCard, AlertTriangle } from 'lucide-react'

// Fila de cancelamentos para o admin. O cancelamento já é honrado no fim do ciclo
// (agendado pelo manage-subscription no ato do pedido do usuário). Aqui o admin
// pode: (1) GARANTIR/re-sincronizar o agendamento no Stripe (cancel_at_period_end),
// e (2) responder por e-mail (retenção). Nunca cancela acesso imediatamente.
// RLS de admin (scf_admin_all / sub_admin) permite ler/atualizar.

interface SubInfo {
  provider_subscription_id: string | null
  current_period_end: string | null
  current_period_start: string | null
  status: string | null
  cancel_at_period_end: boolean | null
}

interface Row {
  id: string
  user_id: string
  current_plan: string
  target_plan: string
  reasons: string[]
  comment: string | null
  requested_at: string
  effective_at: string | null
  status: string // scheduled | completed | reverted
  admin_handled_at: string | null
  admin_reply: string | null
  admin_replied_at: string | null
  stripe_sent_at: string | null
  stripe_sync_status: string | null // null | success | failed
  stripe_error: string | null
  sub?: SubInfo | null
  user?: { full_name?: string | null; email?: string | null; plan?: string | null; plan_activated_at?: string | null }
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', plus: 'Plus', therapeutic: 'Plus', 'therapeutic-plus': 'Plus',
}
const planLabel = (p: string) => PLAN_LABELS[p] ?? p

const STATUS_META: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Agendado (ainda no ciclo)', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Encerrado', cls: 'bg-stone-100 text-stone-500' },
  reverted:  { label: 'Voltou atrás', cls: 'bg-forest-100 text-forest-800' },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function initials(name?: string | null, email?: string | null) {
  const b = (name || email || 'U').trim()
  return (b.split(/\s+/).map(w => w[0]).slice(0, 2).join('') || 'U').toUpperCase()
}

// Fim do ciclo real, seguindo a prioridade oficial (billingCycle):
// current_period_end (Stripe→banco) → pending/effective_at → ativação+30d.
function endDateOf(r: Row): Date | null {
  return resolveEffectivePeriodEnd(
    { current_period_end: r.sub?.current_period_end ?? null, pending_plan_starts_at: r.effective_at ?? null },
    r.user?.plan_activated_at ?? null,
  )
}

type StripeState = {
  badge: string
  badgeCls: string
  canSchedule: boolean
  btnLabel: string
}

// Deriva o estado do Stripe do registro para pintar badge + botão.
function stripeStateOf(r: Row): StripeState {
  const sub = r.sub
  const subStatus = (sub?.status ?? '').toLowerCase()
  if (!sub || !sub.provider_subscription_id) {
    return { badge: 'Sem assinatura', badgeCls: 'bg-stone-100 text-stone-500', canSchedule: false, btnLabel: 'Assinatura não encontrada' }
  }
  if (subStatus === 'cancelled' || subStatus === 'canceled' || r.status === 'completed') {
    return { badge: 'Já cancelado', badgeCls: 'bg-stone-100 text-stone-500', canSchedule: false, btnLabel: 'Já cancelado' }
  }
  if (sub.cancel_at_period_end === true || r.stripe_sync_status === 'success') {
    return { badge: 'Agendado no Stripe', badgeCls: 'bg-forest-100 text-forest-800', canSchedule: false, btnLabel: 'Já agendado' }
  }
  if (r.stripe_sync_status === 'failed') {
    return { badge: 'Erro ao enviar', badgeCls: 'bg-red-100 text-red-700', canSchedule: true, btnLabel: 'Tentar novamente' }
  }
  return { badge: 'Não enviado', badgeCls: 'bg-amber-100 text-amber-700', canSchedule: true, btnLabel: 'Agendar no Stripe' }
}

export default function AdminCancellations() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'pendentes' | 'tratados' | 'todos'>('pendentes')
  const [replyTo, setReplyTo] = useState<Row | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [confirmRow, setConfirmRow] = useState<Row | null>(null)
  const [scheduling, setScheduling] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, e = false) { setToast({ msg, err: e }); setTimeout(() => setToast(null), 4500) }

  async function load() {
    setLoading(true); setErr('')
    const { data, error } = await supabase
      .from('subscription_change_feedback')
      .select('id, user_id, current_plan, target_plan, reasons, comment, requested_at, effective_at, status, admin_handled_at, admin_reply, admin_replied_at, stripe_sent_at, stripe_sync_status, stripe_error')
      .eq('change_type', 'cancellation')
      .order('requested_at', { ascending: false })
      .limit(300)
    if (error) { setErr(error.message); setLoading(false); return }
    const list = (data ?? []) as Row[]
    const ids = [...new Set(list.map(r => r.user_id).filter(Boolean))]
    if (ids.length) {
      const [{ data: profs }, { data: subs }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email, plan, plan_activated_at').in('user_id', ids),
        supabase.from('user_subscriptions').select('user_id, provider_subscription_id, current_period_end, current_period_start, status, cancel_at_period_end').in('user_id', ids),
      ])
      const byId = new Map((profs ?? []).map((p: { user_id: string }) => [p.user_id, p]))
      const subById = new Map((subs ?? []).map((s: SubInfo & { user_id: string }) => [s.user_id, s]))
      list.forEach(r => {
        const p = byId.get(r.user_id) as { full_name?: string; email?: string; plan?: string; plan_activated_at?: string } | undefined
        r.user = p ? { full_name: p.full_name, email: p.email, plan: p.plan, plan_activated_at: p.plan_activated_at } : undefined
        r.sub = (subById.get(r.user_id) as SubInfo | undefined) ?? null
      })
    }
    setRows(list)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => ({
    pendentes: rows.filter(r => !r.admin_handled_at).length,
    tratados: rows.filter(r => r.admin_handled_at).length,
    todos: rows.length,
  }), [rows])

  const filtered = useMemo(() => rows.filter(r =>
    filter === 'todos' ? true : filter === 'pendentes' ? !r.admin_handled_at : !!r.admin_handled_at
  ), [rows, filter])

  async function markHandled(row: Row) {
    const { data: me } = await supabase.auth.getUser()
    const { error } = await supabase.from('subscription_change_feedback')
      .update({ admin_handled_at: new Date().toISOString(), admin_id: me.user?.id ?? null, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) { showToast('Erro: ' + error.message, true); return }
    showToast('Marcado como tratado.')
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, admin_handled_at: new Date().toISOString() } : r))
  }

  async function sendReply() {
    if (!replyTo || !reply.trim()) return
    const email = replyTo.user?.email
    if (!email) { showToast('Usuário sem e-mail no cadastro.', true); return }
    setSending(true)
    const nome = (replyTo.user?.full_name || '').split(' ')[0] || 'você'
    const now = new Date().toISOString()
    const res = await emailCancellationReply(replyTo.user_id, email, nome, reply.trim(), replyTo.id)
    if (!res.ok) { showToast('Falha ao enviar e-mail: ' + (res.error ?? ''), true); setSending(false); return }
    const { data: me } = await supabase.auth.getUser()
    await supabase.from('subscription_change_feedback').update({
      admin_reply: reply.trim(), admin_replied_at: now, admin_handled_at: now,
      admin_id: me.user?.id ?? null, updated_at: now,
    }).eq('id', replyTo.id)
    setRows(prev => prev.map(r => r.id === replyTo.id ? { ...r, admin_reply: reply.trim(), admin_replied_at: now, admin_handled_at: now } : r))
    setSending(false); setReplyTo(null); setReply('')
    showToast('Resposta enviada por e-mail e cancelamento marcado como tratado.')
  }

  // Agenda o cancelamento no Stripe (cancel_at_period_end=true) via Edge Function
  // segura. Idempotente: 2 cliques não duplicam. Nunca cancela acesso imediato.
  async function handleSchedule(row: Row) {
    setScheduling(row.id)
    const { data, error } = await supabase.functions.invoke('admin-schedule-cancellation', { body: { feedback_id: row.id } })
    setScheduling(null); setConfirmRow(null)
    if (error) {
      showToast('Não foi possível enviar o cancelamento ao Stripe. Tente novamente.', true)
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, stripe_sync_status: 'failed' } : r))
      return
    }
    const d = (data ?? {}) as { ok?: boolean; already?: boolean; effectiveAt?: string | null; error?: string; code?: string; message?: string }
    if (d.error) {
      showToast(d.error, true)
      if (d.code === 'stripe_error') setRows(prev => prev.map(r => r.id === row.id ? { ...r, stripe_sync_status: 'failed' } : r))
      return
    }
    const end = d.effectiveAt ?? row.effective_at
    const dateStr = end ? formatBillingDate(end) : ''
    showToast(d.already
      ? 'Este cancelamento já está agendado no Stripe.'
      : `Cancelamento agendado no Stripe com sucesso.${dateStr ? ' O usuário mantém acesso até ' + dateStr + '.' : ''}`)
    setRows(prev => prev.map(r => r.id === row.id ? {
      ...r,
      status: 'scheduled',
      effective_at: end,
      stripe_sync_status: 'success',
      stripe_error: null,
      stripe_sent_at: new Date().toISOString(),
      sub: r.sub ? { ...r.sub, cancel_at_period_end: true, current_period_end: end ?? r.sub.current_period_end } : r.sub,
    } : r))
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg max-w-sm ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900 flex items-center gap-2"><Ban className="w-6 h-6 text-forest-600" /> Cancelamentos</h1>
          <p className="text-sm text-ink-soft mt-1">Cada pedido chega com o motivo. O cancelamento é agendado no Stripe para o <strong>fim do ciclo</strong> — o usuário mantém acesso até lá. Aqui você garante/sincroniza o agendamento e pode responder por e-mail.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {([['pendentes', 'Pendentes'], ['tratados', 'Tratados'], ['todos', 'Todos']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === k ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-ink-soft hover:border-forest-300'}`}>
            {l}<span className={`text-[10px] px-1.5 rounded-full ${filter === k ? 'bg-white/20' : 'bg-stone-100 text-stone-500'}`}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {err && <p className="text-sm text-red-600 mb-3">Erro ao carregar: {err}</p>}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-stone-100 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Ban className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum cancelamento {filter === 'pendentes' ? 'pendente' : filter === 'tratados' ? 'tratado' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const sm = STATUS_META[r.status] ?? { label: r.status, cls: 'bg-stone-100 text-stone-500' }
            const ss = stripeStateOf(r)
            const endStr = formatBillingDate(endDateOf(r))
            const busy = scheduling === r.id
            return (
              <div key={r.id} className={`bg-white border rounded-2xl p-4 ${r.admin_handled_at ? 'border-line' : 'border-amber-200'}`}>
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-xs font-semibold text-forest-700 flex-shrink-0 mt-0.5">
                    {initials(r.user?.full_name, r.user?.email)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-forest-900 text-sm">{r.user?.full_name ?? 'Usuário'}</p>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">{planLabel(r.current_plan)} → {planLabel(r.target_plan)}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${sm.cls}`}>{sm.label}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${ss.badgeCls}`}><CreditCard className="w-3 h-3" /> {ss.badge}</span>
                      {!r.admin_handled_at
                        ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Pendente</span>
                        : <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-forest-100 text-forest-800 font-medium"><Check className="w-3 h-3" /> Tratado</span>}
                    </div>
                    {r.user?.email && <p className="text-xs text-stone-400 mt-0.5">{r.user.email}</p>}
                    <p className="text-sm text-stone-700 mt-2"><span className="text-stone-400">Motivo:</span> {reasonsLabel(r.reasons) || '—'}</p>
                    {r.comment && <p className="text-sm text-stone-600 mt-1 bg-stone-50 rounded-lg p-2.5 whitespace-pre-wrap">"{r.comment}"</p>}
                    <p className="text-[11px] text-stone-400 mt-2">Solicitado {fmt(r.requested_at)} · fim do ciclo {endStr}</p>
                    {r.stripe_sync_status === 'failed' && r.stripe_error && (
                      <p className="text-[11px] text-red-600 mt-1">Erro Stripe: {r.stripe_error}</p>
                    )}
                    {r.admin_reply && (
                      <div className="mt-2 text-xs bg-mint/40 border border-forest-100 rounded-lg p-2.5">
                        <span className="text-forest-700 font-medium">Sua resposta ({fmt(r.admin_replied_at)}):</span>
                        <p className="text-stone-700 whitespace-pre-wrap mt-0.5">{r.admin_reply}</p>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button
                        onClick={() => setConfirmRow(r)}
                        disabled={!ss.canSchedule || busy}
                        className="inline-flex items-center gap-1.5 text-xs bg-forest-900 hover:bg-forest-800 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg">
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />} {ss.btnLabel}
                      </button>
                      <button onClick={() => { setReplyTo(r); setReply('') }} disabled={!r.user?.email}
                        className="inline-flex items-center gap-1.5 text-xs bg-forest-700 hover:bg-forest-800 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg">
                        <Mail className="w-3.5 h-3.5" /> Responder por e-mail
                      </button>
                      {!r.admin_handled_at && (
                        <button onClick={() => markHandled(r)} className="inline-flex items-center gap-1.5 text-xs border border-line text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-50">
                          <Check className="w-3.5 h-3.5" /> Marcar como tratado
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: confirmar agendamento no Stripe */}
      {confirmRow && (() => {
        const end = formatBillingDate(endDateOf(confirmRow))
        const start = confirmRow.sub?.current_period_start ? fmt(confirmRow.sub.current_period_start) : null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center gap-2 p-5 border-b border-line">
                <CreditCard className="w-5 h-5 text-forest-700" />
                <h2 className="font-semibold text-forest-900 flex-1">Agendar cancelamento no Stripe?</h2>
                <button onClick={() => setConfirmRow(null)} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <div className="flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Este cancelamento será enviado ao Stripe e ficará agendado para o final do ciclo atual. O usuário manterá acesso ao plano atual até <strong>{end}</strong>. Após essa data, o plano será alterado para Gratuito.
                </div>
                <dl className="grid grid-cols-3 gap-y-1.5 text-xs">
                  <dt className="text-stone-400">Usuário</dt><dd className="col-span-2 text-stone-800">{confirmRow.user?.full_name ?? '—'}</dd>
                  <dt className="text-stone-400">E-mail</dt><dd className="col-span-2 text-stone-800 break-all">{confirmRow.user?.email ?? '—'}</dd>
                  <dt className="text-stone-400">Plano atual</dt><dd className="col-span-2 text-stone-800">{planLabel(confirmRow.current_plan)}</dd>
                  <dt className="text-stone-400">Stripe Sub ID</dt><dd className="col-span-2 text-stone-600 font-mono text-[11px] break-all">{confirmRow.sub?.provider_subscription_id ?? '—'}</dd>
                  {start && <><dt className="text-stone-400">Início do ciclo</dt><dd className="col-span-2 text-stone-800">{start}</dd></>}
                  <dt className="text-stone-400">Fim do ciclo</dt><dd className="col-span-2 text-stone-800 font-medium">{end}</dd>
                  <dt className="text-stone-400">Motivo(s)</dt><dd className="col-span-2 text-stone-800">{reasonsLabel(confirmRow.reasons) || '—'}</dd>
                  {confirmRow.comment && <><dt className="text-stone-400">Comentário</dt><dd className="col-span-2 text-stone-700 italic">"{confirmRow.comment}"</dd></>}
                </dl>
              </div>
              <div className="p-4 border-t border-line flex items-center justify-end gap-2">
                <button onClick={() => setConfirmRow(null)} className="px-4 py-2 text-sm text-stone-500 border border-line rounded-lg hover:bg-stone-50">Cancelar</button>
                <button onClick={() => handleSchedule(confirmRow)} disabled={scheduling === confirmRow.id}
                  className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
                  {scheduling === confirmRow.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Confirmar agendamento no Stripe
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de resposta por e-mail */}
      {replyTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center gap-2 p-5 border-b border-line">
              <MessageSquare className="w-5 h-5 text-forest-700" />
              <h2 className="font-semibold text-forest-900 flex-1">Responder {replyTo.user?.full_name ?? 'usuário'}</h2>
              <button onClick={() => setReplyTo(null)} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-stone-500">Para: <strong className="text-stone-700">{replyTo.user?.email}</strong> · Motivo: {reasonsLabel(replyTo.reasons)}</p>
              <textarea value={reply} onChange={e => setReply(e.target.value)} rows={7}
                placeholder="Escreva uma mensagem acolhedora. Ex.: agradeça o tempo no app, pergunte se há algo que possa ajudar, ofereça apoio para retomar quando quiser…"
                className="w-full px-3 py-2.5 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-300" />
              <p className="text-[11px] text-stone-400">O e-mail vai com o assunto "Sobre a sua assinatura" e marca o cancelamento como tratado.</p>
            </div>
            <div className="p-4 border-t border-line flex items-center justify-end gap-2">
              <button onClick={() => setReplyTo(null)} className="px-4 py-2 text-sm text-stone-500 border border-line rounded-lg hover:bg-stone-50">Cancelar</button>
              <button onClick={sendReply} disabled={sending || !reply.trim()} className="inline-flex items-center gap-2 bg-forest-700 hover:bg-forest-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar resposta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
