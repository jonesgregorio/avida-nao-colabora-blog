import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MessageSquare, Send, ChevronLeft, Loader2, CheckCircle, Clock } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { normalizePlan } from '../lib/officialPlans'

interface Props {
  user: User | null
  profile: Profile | null
  onBack: () => void
  onNavigatePricing: () => void
}

interface GuidanceRequest {
  id: string
  month_key: string
  message: string
  context: string | null
  expected_help: string | null
  response: string | null
  status: string
  responded_at: string | null
  created_at: string
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function currentMonthLabel() {
  return new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function MonthlyGuidancePage({ user, profile, onBack, onNavigatePricing }: Props) {
  const [loading, setLoading] = useState(true)
  const [request, setRequest] = useState<GuidanceRequest | null>(null)
  const [message, setMessage] = useState('')
  const [context, setContext] = useState('')
  const [expectedHelp, setExpectedHelp] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allowed = normalizePlan(profile?.plan) === 'plus'
  const monthKey = currentMonthKey()

  useEffect(() => {
    if (!user || !allowed) { setLoading(false); return }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('monthly_guidance_requests')
      .select('id,month_key,message,context,expected_help,response,status,responded_at,created_at')
      .eq('user_id', user!.id)
      .eq('month_key', monthKey)
      .maybeSingle()
    setRequest((data as GuidanceRequest) ?? null)
    setLoading(false)
  }

  async function handleSubmit() {
    if (!message.trim() || !user || sending) return
    setSending(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('monthly_guidance_requests')
      .insert({
        user_id: user.id,
        month_key: monthKey,
        message: message.trim(),
        context: context.trim() || null,
        expected_help: expectedHelp.trim() || null,
        status: 'open',
      })
      .select('id,month_key,message,context,expected_help,response,status,responded_at,created_at')
      .single()
    if (err || !data) {
      setError('Erro ao enviar. Tente novamente.')
      setSending(false)
      return
    }
    setRequest(data as GuidanceRequest)
    setMessage(''); setContext(''); setExpectedHelp('')
    setSending(false)
  }

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 bg-mint rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-7 h-7 text-forest-700" />
        </div>
        <h1 className="font-serif text-2xl text-sage-800 mb-2">Orientação mensal por mensagem</h1>
        <p className="text-sage-500 mb-6">Este recurso está disponível no plano Plus.</p>
        <button onClick={onNavigatePricing} className="bg-forest-900 hover:bg-forest-800 text-white px-6 py-3 rounded-full text-sm font-medium transition-colors">
          Ver planos
        </button>
        <button onClick={onBack} className="block mx-auto mt-3 text-sm text-stone-400 hover:text-stone-600">Voltar</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-forest-500 animate-spin" />
      </div>
    )
  }

  const answered = request?.status === 'answered' && !!request?.response

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 mb-6">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-mint rounded-xl flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-forest-700" />
          </div>
          <div>
            <h1 className="font-serif text-2xl text-sage-800">Orientação mensal</h1>
            <p className="text-xs text-stone-400 capitalize">{currentMonthLabel()}</p>
          </div>
        </div>
        <p className="text-sm text-sage-500 mt-2 leading-relaxed">
          Envie uma mensagem por mês e receba uma orientação de apoio personalizada dentro do site.
          Use esse espaço para compartilhar como está se sentindo, tirar dúvidas ou pedir sugestões de autocuidado.
        </p>
      </div>

      {/* Formulário — apenas quando ainda não há pedido neste mês */}
      {!request && (
        <div className="bg-white border border-forest-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-sage-800 mb-4">Nova orientação — <span className="capitalize">{currentMonthLabel()}</span></h2>

          <div className="mb-3">
            <label className="text-xs font-medium text-stone-500 mb-1 block">Sobre o que quer orientação <span className="text-forest-500">*</span></label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Compartilhe como está se sentindo, o que precisa de apoio ou o que gostaria de explorar..."
              rows={5}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-forest-200"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs font-medium text-stone-500 mb-1 block">O que já tentou <span className="text-stone-300">(opcional)</span></label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Estratégias, hábitos ou apoios que você já experimentou..."
              rows={3}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-forest-200"
            />
          </div>
          <div className="mb-4">
            <label className="text-xs font-medium text-stone-500 mb-1 block">Tipo de ajuda esperada <span className="text-stone-300">(opcional)</span></label>
            <textarea
              value={expectedHelp}
              onChange={e => setExpectedHelp(e.target.value)}
              placeholder="Ex: sugestões práticas, escuta, organização de ideias..."
              rows={2}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-forest-200"
            />
          </div>

          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={sending || !message.trim()}
            className="flex items-center gap-2 bg-forest-900 hover:bg-forest-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar orientação deste mês
          </button>
        </div>
      )}

      {/* Pedido já enviado neste mês */}
      {request && (
        <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-sage-800 text-sm">Sua orientação de <span className="capitalize">{currentMonthLabel()}</span></p>
              <p className="text-xs text-stone-400 mt-0.5">Enviada em {formatDate(request.created_at)}</p>
            </div>
            {answered ? (
              <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium flex-shrink-0 bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3" /> Respondida
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium flex-shrink-0 bg-mint text-forest-800">
                <Clock className="w-3 h-3" /> Aguardando resposta
              </span>
            )}
          </div>

          <div className="p-5 space-y-4 bg-stone-50">
            <div>
              <p className="text-[11px] font-medium text-stone-500 mb-1">Sobre o que pediu orientação</p>
              <p className="text-sm text-stone-700 whitespace-pre-wrap">{request.message}</p>
            </div>
            {request.context && (
              <div>
                <p className="text-[11px] font-medium text-stone-500 mb-1">O que já tentou</p>
                <p className="text-sm text-stone-600 whitespace-pre-wrap">{request.context}</p>
              </div>
            )}
            {request.expected_help && (
              <div>
                <p className="text-[11px] font-medium text-stone-500 mb-1">Tipo de ajuda esperada</p>
                <p className="text-sm text-stone-600 whitespace-pre-wrap">{request.expected_help}</p>
              </div>
            )}

            {answered ? (
              <div className="bg-white border border-forest-100 rounded-xl p-4">
                <p className="text-[11px] font-semibold text-forest-700 mb-1">Resposta da equipe</p>
                <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{request.response}</p>
                {request.responded_at && (
                  <p className="text-[10px] text-stone-400 mt-2">Respondida em {formatDate(request.responded_at)}</p>
                )}
              </div>
            ) : (
              <div className="bg-white border border-stone-100 rounded-xl p-4 flex items-center gap-2 text-xs text-stone-500">
                <Loader2 className="w-3.5 h-3.5 text-forest-400" />
                Recebemos sua mensagem. Você será avisado(a) quando a orientação for respondida.
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-stone-400 text-center mt-6">
        Sua orientação será respondida em até 7 dias úteis. Este espaço não é um canal de emergência.
      </p>
    </div>
  )
}
