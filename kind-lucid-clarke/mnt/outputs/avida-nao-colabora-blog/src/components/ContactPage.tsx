import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, MessageSquare, Send, CheckCircle } from 'lucide-react'

interface Props {
  user: any
  profile: any
  onBack: () => void
}

const SUBJECTS = [
  'Dúvida sobre o serviço',
  'Problema técnico',
  'Sugestão de melhoria',
  'Cancelamento ou plano',
  'Privacidade e dados',
  'Outro',
]

export default function ContactPage({ user, profile, onBack }: Props) {
  const [email, setEmail] = useState(profile?.email || '')
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !message.trim()) return
    setSending(true)
    setError(null)

    const { error: err } = await supabase.from('support_tickets').insert({
      user_id: user?.id ?? null,
      email: email.trim(),
      subject,
      message: message.trim(),
      priority,
      status: 'open',
      plan: profile?.plan ?? null,
    })

    if (err) {
      setError('Não foi possível enviar sua mensagem. Tente novamente em instantes.')
    } else {
      setSent(true)
    }
    setSending(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">Mensagem enviada!</h2>
          <p className="text-stone-500 text-sm mb-6">
            Recebemos sua mensagem e responderemos o mais breve possível no e-mail informado.
          </p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 bg-stone-800 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-700"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-stone-400 hover:text-stone-700 text-sm mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800">Fale conosco</h1>
          </div>
          <p className="text-stone-500 text-sm">
            Tem alguma dúvida, sugestão ou problema? Nossa equipe responde em até 2 dias úteis.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              Seu e-mail *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className={inputCls}
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              Assunto *
            </label>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className={inputCls}
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              Urgência
            </label>
            <div className="flex gap-3">
              {(['low', 'normal', 'high'] as const).map(p => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    value={p}
                    checked={priority === p}
                    onChange={() => setPriority(p)}
                    className="accent-emerald-600"
                  />
                  <span className="text-sm text-stone-600">
                    {p === 'low' ? 'Baixa' : p === 'normal' ? 'Normal' : 'Alta'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              Mensagem *
            </label>
            <textarea
              required
              rows={5}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Descreva sua dúvida ou problema com o máximo de detalhes possível..."
              className={inputCls}
            />
            <p className="text-xs text-stone-400 mt-1">{message.length} caracteres</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={sending || !email.trim() || !message.trim()}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Enviando...' : 'Enviar mensagem'}
          </button>
        </form>

        <p className="text-xs text-stone-400 text-center mt-4">
          Sua mensagem fica armazenada de forma segura e só é acessível pela nossa equipe de suporte.
        </p>
      </div>
    </div>
  )
}

const inputCls = "w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
