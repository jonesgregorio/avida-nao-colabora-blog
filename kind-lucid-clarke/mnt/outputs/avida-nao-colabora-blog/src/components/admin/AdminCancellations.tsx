import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { reasonsLabel } from '../../lib/cancelReasons'
import { emailCancellationReply } from '../../lib/emailTriggers'
import { Ban, RefreshCw, Loader2, Send, Check, X, Mail, MessageSquare } from 'lucide-react'

// Fila de cancelamentos para o admin revisar e responder por e-mail (retenção).
// O cancelamento já foi honrado (agendado p/ fim do ciclo pelo manage-subscription);
// aqui é só a camada de acompanhamento. RLS de admin (scf_admin_all) permite ler/atualizar.

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
  user?: { full_name?: string | null; email?: string | null; plan?: string | null }
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

export default function AdminCancellations() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'pendentes' | 'tratados' | 'todos'>('pendentes')
  const [replyTo, setReplyTo] = useState<Row | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, e = false) { setToast({ msg, err: e }); setTimeout(() => setToast(null), 3500) }

  async function load() {
    setLoading(true); setErr('')
    const { data, error } = await supabase
      .from('subscription_change_feedback')
      .select('id, user_id, current_plan, target_plan, reasons, comment, requested_at, effective_at, status, admin_handled_at, admin_reply, admin_replied_at')
      .eq('change_type', 'cancellation')
      .order('requested_at', { ascending: false })
      .limit(300)
    if (error) { setErr(error.message); setLoading(false); return }
    const list = (data ?? []) as Row[]
    const ids = [...new Set(list.map(r => r.user_id).filter(Boolean))]
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email, plan').in('user_id', ids)
      const byId = new Map((profs ?? []).map((p: { user_id: string; full_name?: string; email?: string; plan?: string }) => [p.user_id, p]))
      list.forEach(r => { const p = byId.get(r.user_id); r.user = p ? { full_name: p.full_name, email: p.email, plan: p.plan } : undefined })
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900 flex items-center gap-2"><Ban className="w-6 h-6 text-forest-600" /> Cancelamentos</h1>
          <p className="text-sm text-ink-soft mt-1">Cada pedido de cancelamento chega aqui com o motivo. O cancelamento já foi honrado (encerra no fim do ciclo) — aqui você revisa e pode responder por e-mail para tentar reter.</p>
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
                      {!r.admin_handled_at
                        ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Pendente</span>
                        : <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-forest-100 text-forest-800 font-medium"><Check className="w-3 h-3" /> Tratado</span>}
                    </div>
                    {r.user?.email && <p className="text-xs text-stone-400 mt-0.5">{r.user.email}</p>}
                    <p className="text-sm text-stone-700 mt-2"><span className="text-stone-400">Motivo:</span> {reasonsLabel(r.reasons) || '—'}</p>
                    {r.comment && <p className="text-sm text-stone-600 mt-1 bg-stone-50 rounded-lg p-2.5 whitespace-pre-wrap">"{r.comment}"</p>}
                    <p className="text-[11px] text-stone-400 mt-2">Solicitado {fmt(r.requested_at)} · encerra {fmt(r.effective_at)}</p>
                    {r.admin_reply && (
                      <div className="mt-2 text-xs bg-mint/40 border border-forest-100 rounded-lg p-2.5">
                        <span className="text-forest-700 font-medium">Sua resposta ({fmt(r.admin_replied_at)}):</span>
                        <p className="text-stone-700 whitespace-pre-wrap mt-0.5">{r.admin_reply}</p>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
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
