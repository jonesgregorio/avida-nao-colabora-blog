import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { adminEmailVars, fillTemplateVars, sendAdminUserEmail } from '../../lib/emailTriggers'
import { Mail, Send, X, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'

// Modal "Enviar e-mail para usuário" (Admin > Usuários > Ver detalhes > Comunicação).
// Reaproveita os modelos do Suporte (support_reply_templates) e a Edge Function de
// envio via lib/emailTriggers.sendAdminUserEmail. Não duplica lógica de provedor.

interface TargetUser {
  user_id: string
  full_name: string | null
  email: string | null
  plan: string
}

interface Template {
  id: string
  title: string
  category: string | null
  body: string
  subject: string | null
}

interface Props {
  user: TargetUser
  adminId?: string | null
  adminEmail?: string | null
  onClose: () => void
  onSent: () => void
}

const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

export default function AdminSendUserEmail({ user, adminId, adminEmail, onClose, onSent }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const vars = useMemo(() => adminEmailVars(user), [user])
  const hasEmail = !!(user.email && user.email.trim())

  useEffect(() => {
    let alive = true
    supabase.from('support_reply_templates')
      .select('id, title, category, body, subject')
      .eq('is_active', true)
      .in('usage_context', ['user_email', 'both'])
      .order('category').order('title')
      .then(({ data }) => {
        if (!alive) return
        setTemplates((data as Template[]) ?? [])
        setLoadingTemplates(false)
      })
    return () => { alive = false }
  }, [])

  function applyTemplate(id: string) {
    setTemplateId(id)
    const t = templates.find(x => x.id === id)
    if (!t) return
    // Preenche assunto + corpo já com as variáveis do usuário substituídas.
    // O admin pode editar tudo antes de enviar.
    setSubject(fillTemplateVars(t.subject?.trim() || t.title, vars))
    setBody(fillTemplateVars(t.body, vars))
  }

  const canSend = hasEmail && subject.trim().length > 0 && body.trim().length > 0 && !sending

  async function doSend() {
    if (!canSend) return
    setSending(true)
    setResult(null)
    const t = templates.find(x => x.id === templateId)
    const res = await sendAdminUserEmail({
      userId: user.user_id,
      toEmail: user.email!,
      assunto: subject.trim(),
      corpo: body,
      adminId,
      adminEmail,
      templateId: templateId || null,
      templateTitle: t?.title ?? null,
    })
    setSending(false)
    setConfirming(false)
    if (res.ok) {
      setResult({ type: 'ok', text: 'E-mail enviado com sucesso.' })
      onSent()
      setTimeout(() => onClose(), 1200)
    } else {
      setResult({ type: 'err', text: 'Não foi possível enviar o e-mail. Tente novamente.' })
    }
  }

  const recipientLabel = user.full_name ? `${user.full_name} <${user.email ?? '—'}>` : (user.email ?? '—')

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-line">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-mint flex items-center justify-center flex-shrink-0"><Mail className="w-4 h-4 text-forest-700" /></span>
            <div className="min-w-0">
              <h3 className="font-serif text-xl text-forest-900">Enviar e-mail para usuário</h3>
              <p className="text-xs text-ink-soft mt-0.5">Escolha um template, revise a mensagem e envie para este usuário.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!hasEmail && (
            <div className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Este usuário não possui e-mail cadastrado.
            </div>
          )}

          {/* Para (somente leitura) */}
          <div>
            <label className="block text-xs text-stone-500 mb-1">Para</label>
            <div className={`${inputCls} bg-stone-50 text-stone-700 cursor-not-allowed truncate`} title={recipientLabel}>
              {recipientLabel}
            </div>
          </div>

          {/* Template */}
          <div>
            <label className="block text-xs text-stone-500 mb-1">Template</label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-stone-400 px-1 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando templates…</div>
            ) : templates.length === 0 ? (
              <p className="text-xs text-ink-soft px-1 py-1.5">Nenhum template disponível. Você ainda pode escrever uma mensagem manualmente.</p>
            ) : (
              <select value={templateId} onChange={e => applyTemplate(e.target.value)} className={inputCls} disabled={!hasEmail}>
                <option value="">Selecionar modelo… (opcional)</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.category ? `${t.category} — ` : ''}{t.title}</option>
                ))}
              </select>
            )}
          </div>

          {/* Assunto */}
          <div>
            <label className="block text-xs text-stone-500 mb-1">Assunto <span className="text-red-400">*</span></label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Assunto do e-mail" className={inputCls} disabled={!hasEmail} />
          </div>

          {/* Corpo */}
          <div>
            <label className="block text-xs text-stone-500 mb-1">Mensagem <span className="text-red-400">*</span></label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={9} placeholder="Escreva a mensagem para o usuário…" className={`${inputCls} leading-relaxed resize-y`} disabled={!hasEmail} />
            <p className="text-[11px] text-stone-400 mt-1">Variáveis disponíveis: {'{{nome}}'}, {'{{email}}'}, {'{{plano}}'}, {'{{data_atual}}'}, {'{{app_url}}'}, {'{{suporte_url}}'}, {'{{meu_plano_url}}'} — já substituídas ao escolher um template.</p>
          </div>

          {/* Pré-visualização */}
          {showPreview && (
            <div className="rounded-xl border border-line overflow-hidden">
              <div className="bg-[#2f4232] px-5 py-4">
                <p className="text-[10px] tracking-[0.2em] text-forest-300 uppercase">A Vida Não Colabora</p>
                <p className="text-white text-base mt-1">{subject.trim() || '(sem assunto)'}</p>
              </div>
              <div className="px-5 py-4 bg-white">
                <p className="text-[11px] text-stone-400 mb-2">Para: {recipientLabel}</p>
                <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{body.trim() || '(sem conteúdo)'}</div>
                <p className="text-[11px] text-stone-400 mt-4 pt-3 border-t border-line">
                  Você recebeu este e-mail porque é usuário de A Vida Não Colabora. O conteúdo completo fica dentro da sua conta.
                </p>
              </div>
            </div>
          )}

          {result && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg border ${result.type === 'ok' ? 'bg-mint border-forest-200 text-forest-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {result.type === 'ok' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              {result.text}
            </div>
          )}
        </div>

        {/* Rodapé / ações */}
        <div className="px-6 py-4 border-t border-line">
          {confirming ? (
            <div className="space-y-3">
              <p className="text-sm text-forest-900">
                Tem certeza que deseja enviar este e-mail para <strong>{user.full_name || user.email}</strong>{user.full_name ? <> ({user.email})</> : null}?
              </p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setConfirming(false)} disabled={sending} className="px-4 py-2 rounded-xl text-sm border border-line text-stone-600 hover:bg-stone-50 disabled:opacity-50">Voltar</button>
                <button onClick={doSend} disabled={sending} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Sim, enviar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-line text-stone-600 hover:bg-stone-50">Cancelar</button>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPreview(p => !p)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-line text-forest-700 hover:bg-stone-50">
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showPreview ? 'Ocultar prévia' : 'Pré-visualizar'}
                </button>
                <button onClick={() => { setResult(null); setConfirming(true) }} disabled={!canSend} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">
                  <Send className="w-4 h-4" /> Enviar e-mail
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
