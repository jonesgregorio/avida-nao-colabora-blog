import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import {
  ArrowRight, CalendarClock, CalendarDays, CheckCircle, ChevronDown, ChevronLeft,
  Clock, Crown, Eye, FileText, Heart, Info, ListChecks, Loader2, MessageSquare,
  Send, ShieldCheck, Sparkles, type LucideIcon,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { getEffectivePlan } from '../lib/officialPlans'
import { detectRisk } from '../lib/contentRecommendation'
import {
  guidanceResponseDueDate, isGuidanceAnswered, resolveGuidanceResponse,
  type GuidanceLetter,
} from '../lib/monthlyGuidanceResponse'
import RiskHelpBanner from './RiskHelpBanner'
import MonthlyGuidanceFeedback from './MonthlyGuidanceFeedback'

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
  final_response_json?: GuidanceLetter | null
}

interface Cycle {
  key: string
  deadline: Date
  nextOpen: Date
  isPastDeadline: boolean
}

type HelpPreset = {
  label: string
  icon: LucideIcon
}

const DEADLINE_DAY = 23
const MESSAGE_LIMIT = 5000
const SECONDARY_LIMIT = 1500
const HELP_PRESETS: HelpPreset[] = [
  { label: 'Sugestões práticas', icon: Sparkles },
  { label: 'Organizar minhas ideias', icon: ListChecks },
  { label: 'Outro olhar sobre a situação', icon: Eye },
  { label: 'Entender melhor o que sinto', icon: Heart },
  { label: 'Pensar em próximos passos', icon: ArrowRight },
]

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

function isRequestAnswered(req: GuidanceRequest) {
  return isGuidanceAnswered(req.status, {
    finalResponseJson: req.final_response_json,
    aiDraftJson: req.ai_draft_json,
    response: req.response,
  })
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
  const [riskFlag, setRiskFlag] = useState(false)
  const [requests, setRequests] = useState<GuidanceRequest[]>([])
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [historyYear, setHistoryYear] = useState('all')

  const allowed = getEffectivePlan(profile) === 'plus'

  useEffect(() => {
    if (!user || !allowed) { setLoading(false); return }
    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, allowed])

  async function load() {
    setLoading(true)
    const cyc = guidanceCycle()
    setCycle(cyc)
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

  function toggle(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function chooseHelp(value: string) {
    setExpectedHelp(prev => prev === value ? '' : value)
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
    const created = data as GuidanceRequest
    setRequest(created)
    setRequests(prev => [created, ...prev.filter(item => item.id !== created.id)])
    setOpenIds(prev => new Set(prev).add(created.id))
    setMessage('')
    setContext('')
    setExpectedHelp('')
    setSending(false)
  }

  const years = useMemo(() => {
    const values = new Set(requests.map(item => item.month_key.slice(0, 4)))
    values.add(cycle.key.slice(0, 4))
    return [...values].sort((a, b) => Number(b) - Number(a))
  }, [requests, cycle.key])

  const filteredHistory = useMemo(() => {
    if (historyYear === 'all') return requests
    return requests.filter(item => item.month_key.startsWith(historyYear))
  }, [historyYear, requests])

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 bg-mint rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-7 h-7 text-forest-700" />
        </div>
        <h1 className="font-serif text-2xl text-forest-800 mb-2">Orientação mensal por mensagem</h1>
        <p className="text-forest-500 mb-6">Este recurso está disponível no plano Plus.</p>
        <button onClick={onNavigatePricing} className="bg-forest-900 hover:bg-forest-800 text-white px-6 py-3 rounded-full text-sm font-medium transition-colors">Ver planos</button>
        <button onClick={onBack} className="block mx-auto mt-3 text-sm text-stone-400 hover:text-stone-600">Voltar</button>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 text-forest-500 animate-spin" /></div>
  }

  const deadline = formatShort(cycle.deadline)
  const reopen = formatShort(cycle.nextOpen)
  const currentAnswered = request ? isRequestAnswered(request) : false
  const dueDate = request ? formatShort(guidanceResponseDueDate(request.created_at).toISOString()) : null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ChevronLeft className="w-4 h-4" /> Voltar ao plano
      </button>

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-12 h-12 rounded-2xl bg-mint/70 flex items-center justify-center text-forest-700 flex-shrink-0">
            <MessageSquare className="w-5 h-5" />
          </span>
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl text-forest-900">Orientação mensal</h1>
            <p className="text-sm text-ink-soft capitalize mt-0.5">{currentMonthLabel()}</p>
          </div>
        </div>
        <span className="self-start inline-flex items-center gap-1.5 rounded-full bg-[#fff0e7] px-3 py-1.5 text-xs font-medium text-[#a4552f]">
          <Crown className="w-3.5 h-3.5" /> Membro Plus
        </span>
      </header>

      <p className="max-w-3xl text-sm sm:text-base text-ink-soft leading-relaxed">
        Um espaço mensal para você pedir uma orientação individual a partir do que está vivendo e dos registros que escolheu compartilhar.
      </p>

      <section className="grid md:grid-cols-3 rounded-[26px] border border-line bg-white/70 overflow-hidden">
        <SummaryCell icon={CalendarDays} title="Prazo para enviar">
          <p className="font-semibold text-forest-900 text-lg">{deadline}</p>
          <p className="text-xs text-ink-soft">(dia 23)</p>
          <p className="text-xs text-ink mt-1">1 orientação por mês</p>
        </SummaryCell>
        <SummaryCell icon={Clock} title="Prazo de resposta" separated>
          <p className="font-semibold text-forest-900 text-lg">Até 7 dias corridos</p>
          <p className="text-xs text-ink-soft">após o envio</p>
        </SummaryCell>
        <SummaryCell icon={ShieldCheck} title="Privado e seguro" separated>
          <p className="text-sm text-ink-soft leading-relaxed">Suas informações são tratadas com confidencialidade e respeito.</p>
        </SummaryCell>
      </section>

      {riskFlag && <RiskHelpBanner />}

      {!request && !cycle.isPastDeadline && (
        <section className="rounded-[26px] border border-line bg-white/80 p-4 sm:p-5 space-y-5">
          <SectionHeading number="1" title="Sua solicitação" subtitle="Escreva com liberdade, no seu tempo. Use os campos que fizerem sentido." />

          <div className="rounded-2xl border border-line p-4">
            <label className="text-sm font-medium text-forest-900 block">Sobre o que você quer conversar? <span className="text-forest-600">*</span></label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={MESSAGE_LIMIT}
              placeholder="Compartilhe como está se sentindo, do que precisa de apoio ou o que gostaria de explorar."
              rows={6}
              className="mt-2 w-full resize-y bg-transparent text-sm text-ink placeholder:text-stone-400 focus:outline-none min-h-36"
            />
            <p className="text-right text-[11px] text-ink-soft">{message.length}/{MESSAGE_LIMIT}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-forest-900 block">O que você já tentou? <span className="text-stone-400">(opcional)</span></label>
              <div className="mt-2 rounded-2xl border border-line p-4">
                <textarea
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  maxLength={SECONDARY_LIMIT}
                  placeholder="Estratégias, hábitos ou apoios que você já experimentou..."
                  rows={3}
                  className="w-full resize-y bg-transparent text-sm text-ink placeholder:text-stone-400 focus:outline-none min-h-20"
                />
                <p className="text-right text-[11px] text-ink-soft">{context.length}/{SECONDARY_LIMIT}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-forest-900 block">Que tipo de apoio seria mais útil? <span className="text-stone-400">(opcional)</span></label>
              <div className="mt-2 rounded-2xl border border-line p-4">
                <textarea
                  value={expectedHelp}
                  onChange={e => setExpectedHelp(e.target.value)}
                  maxLength={SECONDARY_LIMIT}
                  placeholder="Conte como prefere receber orientações ou o que te ajudaria mais neste momento..."
                  rows={3}
                  className="w-full resize-y bg-transparent text-sm text-ink placeholder:text-stone-400 focus:outline-none min-h-20"
                />
                <p className="text-right text-[11px] text-ink-soft">{expectedHelp.length}/{SECONDARY_LIMIT}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-ink-soft mb-2">Ou escolha uma opção que faça sentido para você:</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {HELP_PRESETS.map(({ label, icon: Icon }) => {
                const active = expectedHelp === label
                return (
                  <button key={label} type="button" onClick={() => chooseHelp(label)} className={`rounded-xl border px-3 py-3 text-xs flex items-center gap-2 text-left transition ${active ? 'border-forest-300 bg-mint/60 text-forest-900' : 'border-line bg-white text-ink hover:bg-paper-soft'}`}>
                    <Icon className="w-4 h-4 text-forest-600 flex-shrink-0" /> {label}
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={() => setExpectedHelp('')} className="mt-2 mx-auto flex items-center gap-2 rounded-xl border border-forest-200 bg-white px-4 py-2 text-xs text-forest-800 hover:bg-paper-soft">
              <FileText className="w-4 h-4" /> Prefiro explicar com minhas palavras
            </button>
          </div>
        </section>
      )}

      <section className="rounded-[26px] border border-line bg-white/80 p-4 sm:p-5">
        <SectionHeading number="2" title="O que será considerado na resposta" subtitle="Análise cuidadosa antes da resposta: usamos o que está disponível para preparar uma orientação coerente com o seu momento." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
          <DataSource icon={MessageSquare} label="Sua mensagem" badge="Sempre considerado" />
          <DataSource icon={FileText} label="Registros agregados do mês" badge="Disponível" />
          <DataSource icon={Heart} label="Mapa Emocional" badge="Disponível" />
          <DataSource icon={FileText} label="Relatório mensal" badge="Disponível" />
          <DataSource icon={ListChecks} label="Plano de Autocuidado" badge="Disponível" />
        </div>
        <p className="mt-4 text-xs text-ink-soft flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-forest-500 flex-shrink-0" /> Seus dados são usados para preparar esta orientação e seguem as regras de privacidade do serviço.</p>
      </section>

      {!request && !cycle.isPastDeadline && (
        <section className="rounded-[26px] border border-line bg-white/80 p-4 sm:p-5 space-y-4">
          <SectionHeading number="3" title="Antes de enviar" />
          <div className="grid md:grid-cols-2 gap-3">
            <SafetyCard icon={ShieldCheck} title="Este espaço não é um canal de emergência." text="Se estiver em crise ou em risco imediato, procure ajuda de emergência ou ligue 188 (CVV) ou 192." />
            <SafetyCard icon={Info} title="A orientação não substitui acompanhamento profissional." text="As respostas são baseadas nas informações disponíveis e não têm caráter de diagnóstico." />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button onClick={handleSubmit} disabled={sending || !message.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest-900 hover:bg-forest-800 disabled:opacity-50 text-white px-5 py-3 text-sm font-medium transition-colors">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar orientação
            </button>
            <p className="text-xs text-ink-soft flex items-start gap-2"><CalendarDays className="w-4 h-4 text-forest-500 flex-shrink-0" /> Você pode enviar até {deadline} (dia 23). A resposta chega em até 7 dias corridos.</p>
          </div>
        </section>
      )}

      {cycle.isPastDeadline && !request && (
        <section className="rounded-[26px] border border-line bg-paper-soft p-5 flex gap-3">
          <CalendarClock className="w-5 h-5 text-forest-600 flex-shrink-0 mt-0.5" />
          <div><p className="font-medium text-forest-900">O prazo deste mês encerrou no dia 23.</p><p className="text-sm text-ink-soft mt-1">Você poderá enviar uma nova orientação a partir de {reopen}.</p></div>
        </section>
      )}

      <section aria-labelledby="guidance-tracking-title" className="space-y-3">
        <h2 id="guidance-tracking-title" className="font-serif text-xl text-forest-900">Acompanhamento da sua orientação</h2>
        <div className="rounded-[24px] border border-line bg-white/75 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <span className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${request ? (currentAnswered ? 'bg-mint text-forest-700' : 'bg-amber-50 text-amber-700') : 'border border-dashed border-forest-400 text-forest-600'}`}>
              {request ? (currentAnswered ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />) : <MessageSquare className="w-5 h-5" />}
            </span>
            <div>
              {!request ? (
                <><p className="font-medium text-forest-900">Nenhuma orientação enviada neste mês.</p><p className="text-xs text-ink-soft mt-1">{cycle.isPastDeadline ? `O próximo período abre em ${reopen}.` : `Envie sua solicitação até ${deadline} para receber sua orientação.`}</p></>
              ) : currentAnswered ? (
                <><p className="font-medium text-forest-900">Sua orientação de {currentMonthLabel()} está respondida.</p><p className="text-xs text-ink-soft mt-1">A resposta fica guardada no histórico para você revisitar quando quiser.</p></>
              ) : (
                <><p className="font-medium text-forest-900">Sua orientação está em análise.</p><p className="text-xs text-ink-soft mt-1">Enviada em {formatShort(request.created_at)} · resposta prevista até {dueDate}.</p></>
              )}
            </div>
          </div>
          <button type="button" onClick={() => document.getElementById('guidance-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="rounded-xl bg-forest-900 hover:bg-forest-800 text-white px-4 py-2.5 text-xs font-medium whitespace-nowrap">
            {currentAnswered ? 'Ler orientação' : 'Ver histórico'}
          </button>
        </div>
      </section>

      <section id="guidance-history" className="space-y-3 scroll-mt-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div><h2 className="font-serif text-xl text-forest-900">Histórico de orientações</h2><p className="text-xs text-ink-soft mt-1">Acompanhe solicitações e respostas ao longo do tempo.</p></div>
          <select value={historyYear} onChange={e => setHistoryYear(e.target.value)} className="self-start sm:self-auto rounded-xl border border-line bg-white px-3 py-2 text-xs text-forest-800 focus:outline-none">
            <option value="all">Todos os meses</option>
            {years.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>

        <div className="rounded-[24px] border border-line bg-white/80 overflow-hidden">
          {!request && historyYear === 'all' && (
            <HistoryEmptyCurrent monthKey={cycle.key} deadline={deadline} expired={cycle.isPastDeadline} />
          )}
          {filteredHistory.length === 0 && request && <p className="p-5 text-sm text-ink-soft">Nenhuma orientação encontrada neste período.</p>}
          {filteredHistory.map(req => (
            <RequestRow key={req.id} req={req} userId={user?.id ?? ''} open={openIds.has(req.id)} onToggle={() => toggle(req.id)} />
          ))}
        </div>
      </section>
    </div>
  )
}

function SummaryCell({ icon: Icon, title, separated = false, children }: { icon: LucideIcon; title: string; separated?: boolean; children: ReactNode }) {
  return (
    <div className={`p-5 flex gap-3 ${separated ? 'md:border-l md:border-line' : ''}`}>
      <span className="w-10 h-10 rounded-full bg-paper-soft flex items-center justify-center text-forest-700 flex-shrink-0"><Icon className="w-5 h-5" /></span>
      <div><p className="text-xs font-semibold text-forest-700 mb-1">{title}</p>{children}</div>
    </div>
  )
}

function SectionHeading({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return <div className="flex gap-3 items-start"><span className="w-7 h-7 rounded-full bg-forest-900 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">{number}</span><div><h2 className="font-serif text-xl text-forest-900">{title}</h2>{subtitle && <p className="text-xs text-ink-soft mt-0.5">{subtitle}</p>}</div></div>
}

function DataSource({ icon: Icon, label, badge }: { icon: LucideIcon; label: string; badge: string }) {
  return <div className="rounded-2xl bg-paper-soft/70 p-3"><div className="flex items-center gap-2 text-xs font-medium text-forest-900"><Icon className="w-4 h-4 text-forest-600" /> {label}</div><span className="inline-flex mt-2 rounded-full bg-[#e7f2df] px-2 py-1 text-[10px] text-forest-700">✓ {badge}</span></div>
}

function SafetyCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="rounded-2xl border border-[#eadfc9] bg-[#fff8e9] p-4 flex gap-3"><span className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center text-forest-700 flex-shrink-0"><Icon className="w-5 h-5" /></span><div><p className="text-sm font-medium text-forest-900">{title}</p><p className="text-xs text-ink-soft mt-1 leading-relaxed">{text}</p></div></div>
}

function HistoryEmptyCurrent({ monthKey, deadline, expired }: { monthKey: string; deadline: string; expired: boolean }) {
  return <div className="px-4 py-3 flex items-center gap-3 border-b border-line last:border-b-0"><span className="w-9 h-9 rounded-full bg-mint/60 flex items-center justify-center text-forest-700"><CalendarDays className="w-4 h-4" /></span><div className="flex-1 min-w-0"><p className="text-sm font-medium text-forest-900 capitalize">{monthKeyLabel(monthKey)}</p><p className="text-[11px] text-ink-soft">{expired ? 'Prazo encerrado' : `Prazo para enviar: ${deadline}`}</p></div><span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-600">{expired ? 'Prazo encerrado' : 'Não enviada'}</span></div>
}

function RequestRow({ req, userId, open, onToggle }: { req: GuidanceRequest; userId: string; open: boolean; onToggle: () => void }) {
  const resolvedResponse = resolveGuidanceResponse({
    finalResponseJson: req.final_response_json,
    aiDraftJson: req.ai_draft_json,
    response: req.response,
  })
  const answered = isRequestAnswered(req)
  return (
    <div className="border-b border-line last:border-b-0">
      <button type="button" onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-paper-soft/70 transition-colors">
        <span className="w-9 h-9 rounded-full bg-mint/60 flex items-center justify-center text-forest-700 flex-shrink-0"><CalendarDays className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-forest-900 capitalize">{monthKeyLabel(req.month_key)}</p><p className="text-[11px] text-ink-soft">Enviada em {formatShort(req.created_at)}{answered && req.responded_at ? ` · Respondida em ${formatShort(req.responded_at)}` : ''}</p></div>
        <span className={`hidden sm:inline-flex rounded-full px-2.5 py-1 text-[10px] ${answered ? 'bg-[#e5f2e8] text-forest-700' : 'bg-[#fff0dc] text-amber-700'}`}>{answered ? 'Respondida' : 'Em análise'}</span>
        {answered && <span className="hidden md:inline-flex rounded-xl border border-line px-3 py-2 text-xs text-forest-800">Ler orientação</span>}
        <ChevronDown className={`w-4 h-4 text-forest-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="bg-paper-soft/55 border-t border-line p-4 sm:p-5 space-y-4">
          <div><p className="text-[11px] font-medium text-ink-soft mb-1">Sobre o que pediu orientação</p><p className="text-sm text-ink whitespace-pre-wrap">{req.message}</p></div>
          {req.context && <div><p className="text-[11px] font-medium text-ink-soft mb-1">O que já tentou</p><p className="text-sm text-ink-soft whitespace-pre-wrap">{req.context}</p></div>}
          {req.expected_help && <div><p className="text-[11px] font-medium text-ink-soft mb-1">Tipo de apoio esperado</p><p className="text-sm text-ink-soft whitespace-pre-wrap">{req.expected_help}</p></div>}
          {answered ? (
            <>
              <div className="rounded-2xl border border-forest-100 bg-white p-4">
                <div className="flex items-center gap-2 mb-3"><p className="text-xs font-semibold text-forest-700">Sua orientação mensal</p><span className="text-[10px] rounded-full bg-mint px-2 py-1 text-forest-800">Orientação respondida</span></div>
                <GuidanceLetterView letter={resolvedResponse?.letter} fallback={resolvedResponse?.fallback ?? ''} />
                {req.responded_at && <p className="text-[10px] text-ink-soft mt-3">Respondida em {formatDate(req.responded_at)}</p>}
              </div>
              {userId && <MonthlyGuidanceFeedback userId={userId} guidanceRequestId={req.id} />}
            </>
          ) : (
            <div className="rounded-2xl border border-line bg-white p-4 flex items-center gap-2 text-xs text-ink-soft"><Loader2 className="w-4 h-4 text-forest-500" /> Recebemos sua mensagem. A resposta está prevista até {formatDate(guidanceResponseDueDate(req.created_at).toISOString())}.</div>
          )}
        </div>
      )}
    </div>
  )
}

function GuidanceLetterView({ letter, fallback }: { letter?: GuidanceLetter; fallback: string }) {
  const sections = [
    ['O que você trouxe', letter?.user_request_summary],
    ['O que seus registros ajudam a observar', letter?.emotional_context_summary],
    ['Uma leitura cuidadosa', letter?.gentle_guidance || fallback],
    ['Conexão com seu plano de autocuidado', letter?.connection_with_self_care_plan],
    ['Pergunta para continuar no diário', letter?.suggested_reflection_question],
    ['Mensagem final', letter?.final_message_draft],
  ] as const
  return <div className="space-y-4 text-sm text-ink-soft leading-relaxed">{sections.filter(([, value]) => value).map(([title, value]) => <section key={title}><p className="text-[11px] font-semibold text-forest-700 mb-1">{title}</p><p className="whitespace-pre-wrap">{value}</p></section>)}{(letter?.practical_next_steps?.length ?? 0) > 0 && <section><p className="text-[11px] font-semibold text-forest-700 mb-1">Próximos passos possíveis</p><ul className="list-disc pl-5 space-y-1">{letter!.practical_next_steps!.map(step => <li key={step}>{step}</li>)}</ul></section>}{letter?.data_quality_notice && <p className="text-xs text-ink-soft border-t border-line pt-3">{letter.data_quality_notice}</p>}</div>
}
