import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, MessageSquare, Send, CheckCircle, LogIn } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

interface Props {
  user: User | null
  profile: Profile | null
  onBack: () => void
  navigate?: (v: string) => void
}

const CATEGORIES = [
  'Dúvida sobre o serviço',
  'Problema técnico',
  'Sugestão de melhoria',
  'Cancelamento ou plano',
  'Privacidade e dados',
  'Outro',
]

const inputCls = "w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"

const DRAFT_KEY = 'contact_draft'

export default function ContactPage({ user, profile, onBack, navigate }: Props) {
  const [subject, setSubject] = useState(CATEGORIES[0])
  const [category, setCategory] = useState(CATEGORIES[0])
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore draft if user just logged in
  useEffect(() => {
    if (user) {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        try {
          const parsed = JSON.parse(draft)
          if (parsed.subject) setSubject(parsed.subject)
          if (parsed.category) setCategory(parsed.category)
          if (parsed.priority) setPriority(parsed.priority)
          if (parsed.description) setDescription(parsed.description)
          localStorage.removeItem(DRAFT_KEY)
        } catch { /* ignore */ }
      }
    }
  }, [user])

  function saveDraftAndLogin() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ subject, category, priority, description }))
    if (navigate) navigate('auth')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSending(true)
    setError(null)

    const { error: err } = await supabase.from('support_tickets').insert({
      user_id: user!.id,
      subject,
      description: description.trim(),
      priority,
      status: 'open',
      source: 'contact_page',
      category,
      plan_at_creation: profile?.plan ?? 'free',
      unread_for_admin: true,
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
            Recebemos sua mensagem e responderemos o mais breve possível. Você pode acompanhar o status pelo suporte.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {navigate && (
              <button
                onClick={() => navigate('support')}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700"
              >
                Ver meu suporte
              </button>
            )}
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 border border-stone-200 text-stone-600 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao início
            </button>
          </div>
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
        {!user ? (
          /* Not logged in: show prompt */
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-5">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
              <LogIn className="w-7 h-7 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-800 mb-2">Entre para acompanhar sua solicitação</h2>
              <p className="text-stone-500 text-sm">
                Para acompanhar sua solicitação e receber resposta pelo site, entre ou crie sua conta gratuita.
              </p>
            </div>

            {/* Show form fields so user can fill before logging in */}
            <div className="text-left space-y-4 border-t border-stone-100 pt-5">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Assunto *</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} className={inputCls}>
                  {CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Mensagem *</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descreva sua dúvida ou problema..."
                  className={inputCls}
                />
              </div>
              <button
                onClick={saveDraftAndLogin}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Entrar e enviar mensagem
              </button>
              <p className="text-xs text-stone-400 text-center">Seu rascunho será preservado durante o login</p>
            </div>
          </div>
        ) : (
          /* Logged in: show full form */
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Assunto *</label>
              <select value={subject} onChange={e => { setSubject(e.target.value); setCategory(e.target.value) }} className={inputCls}>
                {CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Urgência</label>
              <div className="flex gap-3">
                {(['low', 'medium', 'high'] as const).map(p => (
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
                      {p === 'low' ? 'Baixa' : p === 'medium' ? 'Normal' : 'Alta'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Mensagem *</label>
              <textarea
                required
                rows={5}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descreva sua dúvida ou problema com o máximo de detalhes possível..."
                className={inputCls}
              />
              <p className="text-xs text-stone-400 mt-1">{description.length} caracteres</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !description.trim()}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Enviando...' : 'Enviar mensagem'}
            </button>
          </form>
        )}

        <p className="text-xs text-stone-400 text-center mt-4">
          Sua mensagem fica armazenada de forma segura e só é acessível pela nossa equipe de suporte.
        </p>
      </div>
    </div>
  )
}
