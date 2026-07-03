import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { sendTransactionalEmail } from '../../lib/emailTriggers'
import { Mail, RefreshCw, Send, Loader2, CheckCircle, XCircle, Clock, FileText } from 'lucide-react'

interface EmailLog {
  id: string
  user_id: string | null
  to_email: string | null
  email: string | null
  template_key: string | null
  subject: string | null
  status: string
  provider: string | null
  error_message: string | null
  error: string | null
  idempotency_key: string | null
  metadata: { variables?: Record<string, unknown> } | null
  created_at: string
  sent_at: string | null
}

interface EmailTemplate {
  id: string
  template_key: string
  subject: string
  category: string | null
  is_active: boolean
  updated_at: string
}

const STATUS_STYLE: Record<string, { cls: string; icon: typeof CheckCircle; label: string }> = {
  sent:    { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle, label: 'Enviado' },
  failed:  { cls: 'text-red-700 bg-red-50 border-red-200',             icon: XCircle,     label: 'Falhou' },
  pending: { cls: 'text-amber-700 bg-amber-50 border-amber-200',       icon: Clock,       label: 'Pendente' },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminEmails() {
  const [tab, setTab] = useState<'logs' | 'templates'>('logs')
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed' | 'pending'>('all')
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [logsRes, tplRes] = await Promise.all([
      supabase.from('email_logs').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('email_templates').select('id, template_key, subject, category, is_active, updated_at').order('template_key'),
    ])
    setLogs((logsRes.data as unknown as EmailLog[]) ?? [])
    setTemplates((tplRes.data as unknown as EmailTemplate[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleResend(log: EmailLog) {
    const toEmail = log.to_email ?? log.email
    if (!toEmail || !log.template_key) { showToast('Log sem destinatário/template — não é possível reenviar.', true); return }
    setResending(log.id)
    try {
      const res = await sendTransactionalEmail({
        userId: log.user_id,
        toEmail,
        templateKey: log.template_key,
        variables: log.metadata?.variables ?? {},
        idempotencyKey: `${log.idempotency_key ?? log.template_key}:retry:${Date.now()}`,
      })
      if (res.ok) { showToast('E-mail reenviado.'); await load() }
      else showToast('Falha ao reenviar: ' + (res.error ?? ''), true)
    } catch (e) {
      showToast('Erro: ' + (e instanceof Error ? e.message : String(e)), true)
    }
    setResending(null)
  }

  async function toggleTemplate(t: EmailTemplate) {
    const { error } = await supabase.from('email_templates').update({ is_active: !t.is_active, updated_at: new Date().toISOString() }).eq('id', t.id)
    if (error) showToast('Erro ao atualizar template: ' + error.message, true)
    else { setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x)); showToast(`Template ${!t.is_active ? 'ativado' : 'desativado'}.`) }
  }

  const filtered = logs.filter(l => filter === 'all' ? true : l.status === filter)
  const counts = {
    sent: logs.filter(l => l.status === 'sent').length,
    failed: logs.filter(l => l.status === 'failed').length,
    pending: logs.filter(l => l.status === 'pending').length,
  }

  return (
    <div className="p-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-stone-800'}`}>{toast.msg}</div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-stone-800 flex items-center gap-2">
          <Mail className="w-5 h-5 text-emerald-600" /> E-mails transacionais
        </h1>
        <button onClick={load} className="flex items-center gap-1.5 text-sm border border-stone-200 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-50">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      <div className="flex gap-1 border-b border-stone-200 mb-4">
        {([['logs', 'Logs de envio'], ['templates', 'Templates']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`text-sm px-4 py-2 border-b-2 font-medium ${tab === id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>{label}</button>
        ))}
      </div>

      {loading && <div className="py-16 text-center text-stone-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>}

      {!loading && tab === 'logs' && (
        <div>
          <div className="flex gap-2 mb-3 flex-wrap">
            {([['all', `Todos (${logs.length})`], ['sent', `Enviados (${counts.sent})`], ['failed', `Falhas (${counts.failed})`], ['pending', `Pendentes (${counts.pending})`]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)} className={`text-xs px-3 py-1.5 rounded-lg border ${filter === v ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>{l}</button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  {['Status', 'Destinatário', 'Template', 'Assunto', 'Quando', 'Ação'].map(h => (
                    <th key={h} className="py-2.5 px-3 text-left text-xs font-semibold text-stone-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-stone-400">Nenhum e-mail {filter !== 'all' ? `com status "${filter}"` : ''}.</td></tr>}
                {filtered.map(log => {
                  const st = STATUS_STYLE[log.status] ?? STATUS_STYLE.pending
                  const Icon = st.icon
                  return (
                    <tr key={log.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${st.cls}`}><Icon className="w-3 h-3" />{st.label}</span>
                        {(log.error_message || log.error) && <p className="text-[10px] text-red-500 mt-0.5 max-w-[200px] truncate">{log.error_message || log.error}</p>}
                      </td>
                      <td className="py-2.5 px-3 text-stone-700 text-xs">{log.to_email ?? log.email ?? '—'}</td>
                      <td className="py-2.5 px-3 text-stone-500 text-xs font-mono">{log.template_key ?? '—'}</td>
                      <td className="py-2.5 px-3 text-stone-600 text-xs max-w-[220px] truncate">{log.subject ?? '—'}</td>
                      <td className="py-2.5 px-3 text-stone-400 text-xs whitespace-nowrap">{fmt(log.sent_at ?? log.created_at)}</td>
                      <td className="py-2.5 px-3">
                        {log.status === 'failed' && log.template_key && (
                          <button onClick={() => handleResend(log)} disabled={resending === log.id} className="flex items-center gap-1 text-xs text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded-lg disabled:opacity-50">
                            {resending === log.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Reenviar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'templates' && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                {['Chave', 'Assunto', 'Categoria', 'Ativo', 'Atualizado'].map(h => (
                  <th key={h} className="py-2.5 px-3 text-left text-xs font-semibold text-stone-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-stone-400"><FileText className="w-6 h-6 mx-auto mb-2 text-stone-300" />Nenhum template. Rode a migration 049.</td></tr>}
              {templates.map(t => (
                <tr key={t.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="py-2.5 px-3 text-xs font-mono text-stone-700">{t.template_key}</td>
                  <td className="py-2.5 px-3 text-xs text-stone-600 max-w-[280px] truncate">{t.subject}</td>
                  <td className="py-2.5 px-3 text-xs text-stone-400">{t.category ?? '—'}</td>
                  <td className="py-2.5 px-3">
                    <button onClick={() => toggleTemplate(t)} className={`w-10 h-5 rounded-full relative transition-colors ${t.is_active ? 'bg-emerald-500' : 'bg-stone-300'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${t.is_active ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-stone-400 whitespace-nowrap">{fmt(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
