import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MessageSquare, Send, ChevronLeft, ChevronDown, Loader2, CheckCircle, Clock, CalendarClock, Sparkles, FileText } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { getEffectivePlan } from '../lib/officialPlans'
import { detectRisk } from '../lib/contentRecommendation'
import RiskHelpBanner from './RiskHelpBanner'

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
  ai_draft_json?: { final_response?: GuidanceLetter } | null
  // Coluna própria (migration 20260816210000): prioridade sobre ai_draft_json.final_response.
  final_response_json?: GuidanceLetter | null
}
interface GuidanceLetter {
  title?: string; user_request_summary?: string; emotional_context_summary?: string; gentle_guidance?: string
  practical_next_steps?: string[]; connection_with_self_care_plan?: string; suggested_reflection_question?: string
  final_message_draft?: string; data_quality_notice?: string; review_badge?: string
}

interface Cycle {
  key: string           // YYYY-MM do mês-calendário atual (uma orientação por mês)
  deadline: Date        // dia 23 do mês atual (fim do dia) — prazo p/ solicitar
  nextOpen: Date        // 1º dia do próximo mês — quando o período reabre
  isPastDeadline: boolean
}

// ── Ciclo de orientação = MÊS-CALENDÁRIO, com prazo no dia 23 ─────────────────
// Regra (03/08/2026): a orientação mensal segue o mês do calendário, não o ciclo
// de cobrança. A pessoa pode solicitar UMA orientação por mês, até o DIA 23. Depois
// do dia 23 o período do mês encerra e reabre no dia 1º do mês seguinte. A resposta
// chega em até 7 dias CORRIDOS.
const DEADLINE_DAY = 23
function guidanceCycle(now: Date = new Date()): Cycle {
  const y = now.getFullYear(), m = now.getMonth()
  const deadline = new Date(y, m, DEADLINE_DAY, 23, 59, 59, 999)
  const nextOpen = new Date(y, m + 1, 1)
  const key = `${y}-${String(m + 1).padStart(2, '0')}`
  return { key, deadline, nextOpen, isPastDeadline: now > deadline }
}

function currentMonthLabel() {
  return new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}
function monthKeyLabel(key: string) {
  const [y, m] = String(key).split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}
function formatShort(d: Date | string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function MonthlyGuidancePage({ user, profile, onBack, onNavigatePricing }: Props) {
  const [loading, setLoading] = useState(true)
  const [request, setRequest] = useState<GuidanceRequest | null>(null)
  const [cycle, setCycle] = useState<Cycle>(() => guidanceCycle())
  const [message, setMessage] = useState('')
  const [context, setContext] = useState('')
  const [expectedHelp, setExpectedHelp] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // §15: se o pedido tiver linguagem de risco, o prazo normal de 7 dias é
  // longo demais — mostramos apoio imediato (CVV/emergência) além do envio.
  const [riskFlag, setRiskFlag] = useState(false)
  // Histórico completo (nunca apagado). Cards começam FECHADOS.
  const [requests, setRequests] = useState<GuidanceRequest[]>([])
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setOpenIds(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const allowed = getEffectivePlan(profile) === 'plus'

  useEffect(() => {
    if (!user || !allowed) { setLoading(false); return }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function load() {
    setLoading(true)
    // 1) Ciclo = mês-calendário atual, com prazo no dia 23 (não depende da assinatura).
    const cyc = guidanceCycle()
    setCycle(cyc)

    // 2) Carrega TODO o histórico do usuário (nunca apagado). O pedido do mês
    //    atual controla o formulário; os demais aparecem em "Orientações anteriores".
    const { data } = await supabase
      .from('monthly_guidance_requests')
      .select('id,month_key,message,context,expected_help,response,status,responded_at,created_at,ai_draft_json,final_response_json')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
    const all = (data ?? []) as GuidanceRequest[]
    setRequests(all)
    setRequest(all.find(r => r.month_key === cyc.key) ?? null)
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
        month_key: cycle.key,
        message: message.trim(),
        context: context.trim() || null,
        expected_help: expectedHelp.trim() || null,
        status: 'open',
      })
      .select('id,month_key,message,context,expected_help,response,status,responded_at,created_at,ai_draft_json,final_response_json')
      .single()
    if (err || !data) {
      setError('Erro ao enviar. Tente novamente.')
      setSending(false)
      return
    }
    if (detectRisk(message) || detectRisk(context)) setRiskFlag(true)
    setRequest(data as GuidanceRequest)
    setRequests(prev => [data as GuidanceRequest, ...prev])
    setMessage(''); setContext(''); setExpectedHelp('')
    setSending(false)
  }

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 bg-mint rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-7 h-7 text-forest-700" />
        </div>
        <h1 className="font-serif text-2xl text-forest-800 mb-2">Orientação mensal por mensagem</h1>
        <p className="text-forest-500 mb-6">Este recurso está disponível no plano Plus.</p>
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

  const deadline = formatShort(cycle.deadline)   // dia 23 do mês atual
  const reopen = formatShort(cycle.nextOpen)     // 1º do próximo mês (reabertura)
  // Histórico = todos os pedidos, exceto o do mês atual (que aparece no topo).
  const history = requests.filter(r => r.id !== request?.id)

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
            <h1 className="font-serif text-2xl text-forest-800">Orientação mensal</h1>
            <p className="text-xs text-stone-400 capitalize">{currentMonthLabel()}</p>
          </div>
        </div>
        <p className="text-sm text-forest-500 mt-2 leading-relaxed">
          Uma leitura cuidadosa do seu momento, baseada na sua pergunta e nos seus registros recentes.
          Você envia uma mensagem e recebe, aqui dentro do site, uma orientação de apoio individual e não emergencial.
          A resposta chega em até <strong className="text-forest-700">7 dias corridos</strong>.
        </p>
        <p className="text-sm text-forest-500 mt-2 leading-relaxed">
          Você pode pedir orientação sobre <strong className="text-forest-700">o que quiser</strong> e trazer os pontos que
          desejar — como está se sentindo, uma situação difícil, dúvidas sobre o seu processo, hábitos que
          quer mudar, sugestões de autocuidado ou ajuda para organizar as ideias. Escreva com liberdade, no
          seu tempo: não há limite de caracteres.
        </p>
      </div>

      {riskFlag && <div className="mb-5"><RiskHelpBanner /></div>}

      <div className="mb-5 rounded-2xl border border-forest-100 bg-mint/30 p-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-forest-600 flex-shrink-0"><FileText className="w-4 h-4" /></span>
          <div>
            <h2 className="font-serif text-base text-forest-900">O que será considerado</h2>
            <p className="text-xs text-forest-800/80 mt-1 leading-relaxed">Sua pergunta, o que você já tentou, registros agregados do mês, Mapa Emocional, relatório mensal e plano de autocuidado quando estiverem disponíveis.</p>
          </div>
        </div>
      </div>

      {/* Destaque do mês: até quando pode solicitar / quando reabre */}
      {request ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-amber-600 flex-shrink-0">
            <CheckCircle className="w-4 h-4" />
          </span>
          <div className="text-sm leading-relaxed">
            <p className="text-amber-800">
              Você já usou a orientação deste mês. 🌱
            </p>
            <p className="text-amber-700/90 text-xs mt-0.5">
              A resposta chega em até 7 dias corridos. Uma nova solicitação abre em <strong className="text-amber-900">{reopen}</strong>, no início do próximo mês.
            </p>
          </div>
        </div>
      ) : cycle.isPastDeadline ? (
        <div className="mb-5 rounded-2xl border border-stone-200 bg-stone-50 p-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-stone-500 flex-shrink-0">
            <CalendarClock className="w-4 h-4" />
          </span>
          <div className="text-sm leading-relaxed">
            <p className="text-stone-700">
              O prazo para solicitar a orientação deste mês encerrou no <strong className="text-stone-900">dia 23</strong>.
            </p>
            <p className="text-stone-500 text-xs mt-0.5">
              Você poderá solicitar novamente a partir de <strong className="text-stone-700">{reopen}</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-forest-100 bg-mint/50 p-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-forest-600 flex-shrink-0">
            <CalendarClock className="w-4 h-4" />
          </span>
          <div className="text-sm leading-relaxed">
            <p className="text-forest-800">
              Você tem até <strong className="text-forest-900">{deadline}</strong> (dia 23) para enviar a orientação deste mês.
            </p>
            <p className="text-forest-700/80 text-xs mt-0.5">
              É uma solicitação por mês. A resposta chega em até <strong className="text-forest-900">7 dias corridos</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Formulário — apenas quando ainda não há pedido no mês E o prazo (dia 23) não passou */}
      {!request && !cycle.isPastDeadline && (
        <div className="bg-white border border-forest-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-forest-800 mb-4">Nova orientação — <span className="capitalize">{currentMonthLabel()}</span></h2>

          <div className="mb-3">
            <label className="text-xs font-medium text-stone-500 mb-1 block">Sobre o que quer orientação <span className="text-forest-500">*</span></label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Compartilhe como está se sentindo, o que precisa de apoio ou o que gostaria de explorar. Traga os pontos que quiser — pode escrever à vontade."
              rows={6}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-forest-200"
            />
          </div>
          <div className="mb-3">
            <label className="text-xs font-medium text-stone-500 mb-1 block">O que já tentou <span className="text-stone-300">(opcional)</span></label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Estratégias, hábitos ou apoios que você já experimentou..."
              rows={3}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-forest-200"
            />
          </div>
          <div className="mb-4">
            <label className="text-xs font-medium text-stone-500 mb-1 block">Tipo de ajuda esperada <span className="text-stone-300">(opcional)</span></label>
            <textarea
              value={expectedHelp}
              onChange={e => setExpectedHelp(e.target.value)}
              placeholder="Ex: sugestões práticas, escuta, organização de ideias..."
              rows={2}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-forest-200"
            />
          </div>

          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={sending || !message.trim()}
            className="flex items-center gap-2 bg-forest-900 hover:bg-forest-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar orientação deste ciclo
          </button>
          <p className="text-[11px] text-stone-400 mt-3 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-forest-400" /> Você pode enviar até {deadline} (dia 23). Uma orientação por mês, respondida em até 7 dias corridos.
          </p>
        </div>
      )}

      {/* Pedido do ciclo atual (fechado por padrão) */}
      {request && (
        <RequestCard req={request} open={openIds.has(request.id)} onToggle={() => toggle(request.id)} />
      )}

      {/* Histórico — nunca apagado, sempre disponível, fechado por padrão */}
      {history.length > 0 && (
        <div className="mt-6">
          <h2 className="font-serif text-lg text-forest-800 mb-1">Orientações anteriores</h2>
          <p className="text-xs text-stone-400 mb-3">Seu histórico fica sempre aqui. Toque para abrir.</p>
          <div className="space-y-2">
            {history.map(r => (
              <RequestCard key={r.id} req={r} open={openIds.has(r.id)} onToggle={() => toggle(r.id)} />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-stone-400 text-center mt-6">
        Sua orientação será respondida em até 7 dias corridos. Este espaço não é um canal de emergência.
      </p>
    </div>
  )
}

// ── Cartão sanfona de uma orientação (ciclo atual ou histórico) ───────────────
function RequestCard({ req, open, onToggle }: { req: GuidanceRequest; open: boolean; onToggle: () => void }) {
  const answered = req.status === 'answered' && !!req.response
  return (
    <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-stone-50 transition-colors"
      >
        <div className="min-w-0">
          <p className="font-semibold text-forest-800 text-sm">Sua orientação de <span className="capitalize">{monthKeyLabel(req.month_key)}</span></p>
          <p className="text-xs text-stone-400 mt-0.5">Enviada em {formatDate(req.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {answered ? (
            <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3" /> Respondida
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
              <Clock className="w-3 h-3" /> Aguardando resposta
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="p-5 space-y-4 bg-stone-50 border-t border-stone-100">
          <div>
            <p className="text-[11px] font-medium text-stone-500 mb-1">Sobre o que pediu orientação</p>
            <p className="text-sm text-stone-700 whitespace-pre-wrap">{req.message}</p>
          </div>
          {req.context && (
            <div>
              <p className="text-[11px] font-medium text-stone-500 mb-1">O que já tentou</p>
              <p className="text-sm text-stone-600 whitespace-pre-wrap">{req.context}</p>
            </div>
          )}
          {req.expected_help && (
            <div>
              <p className="text-[11px] font-medium text-stone-500 mb-1">Tipo de ajuda esperada</p>
              <p className="text-sm text-stone-600 whitespace-pre-wrap">{req.expected_help}</p>
            </div>
          )}
          {answered ? (
            <div className="bg-white border border-forest-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] font-semibold text-forest-700">Sua orientação mensal</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-mint text-forest-800 font-medium">Orientação revisada</span>
              </div>
              {/* §9.4: final_response_json é a fonte de verdade; ai_draft_json.final_response
                  e response (texto simples) seguem como fallback pra registros antigos. */}
              <GuidanceLetterView letter={req.final_response_json ?? req.ai_draft_json?.final_response} fallback={req.response ?? ''} />
              {req.responded_at && (
                <p className="text-[10px] text-stone-400 mt-2">Respondida em {formatDate(req.responded_at)}</p>
              )}
            </div>
          ) : (
            <div className="bg-white border border-stone-100 rounded-xl p-4 flex items-center gap-2 text-xs text-stone-500">
              <Loader2 className="w-3.5 h-3.5 text-forest-400" />
              Recebemos sua mensagem. Você será avisado(a) quando a orientação for respondida.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GuidanceLetterView({ letter, fallback }: { letter?: GuidanceLetter; fallback: string }) {
  const sections = [
    ['O que você trouxe', letter?.user_request_summary], ['O que seus registros ajudam a observar', letter?.emotional_context_summary],
    ['Uma leitura cuidadosa', letter?.gentle_guidance || fallback], ['Conexão com seu plano de autocuidado', letter?.connection_with_self_care_plan],
    ['Pergunta para continuar no diário', letter?.suggested_reflection_question], ['Mensagem final', letter?.final_message_draft],
  ] as const
  return <div className="space-y-4 text-sm text-stone-700 leading-relaxed">
    {sections.filter(([, value]) => value).map(([title, value]) => <section key={title}><p className="text-[11px] font-semibold text-forest-700 mb-1">{title}</p><p className="whitespace-pre-wrap">{value}</p></section>)}
    {(letter?.practical_next_steps?.length ?? 0) > 0 && <section><p className="text-[11px] font-semibold text-forest-700 mb-1">Próximos passos possíveis</p><ul className="list-disc pl-5 space-y-1">{letter!.practical_next_steps!.map(step => <li key={step}>{step}</li>)}</ul></section>}
    {letter?.data_quality_notice && <p className="text-xs text-stone-500 border-t border-stone-100 pt-3">{letter.data_quality_notice}</p>}
  </div>
}
