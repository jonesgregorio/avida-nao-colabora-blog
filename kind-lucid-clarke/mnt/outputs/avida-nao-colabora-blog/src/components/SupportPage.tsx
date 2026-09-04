import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  MessageCircle, Clock, ChevronRight, ChevronDown, Send, AlertTriangle, Crown, ArrowRight, HeartHandshake, ShieldCheck, CheckCircle2, Plus,
} from 'lucide-react'
import { normalizePlan } from '../lib/officialPlans'
import { getSupportSlaLabel } from '../lib/supportSla'
import { DEFAULT_SUPPORT_CATEGORY, SUPPORT_CATEGORIES } from '../lib/supportCategories'
import SupportAttachmentPicker from './support/SupportAttachmentPicker'
import {
  removeSupportAttachments,
  uploadSupportAttachments,
  type SupportAttachment,
} from '../lib/supportAttachments'

interface Ticket {
  id: string
  ticket_number: number
  subject: string
  status: string
  priority: string
  category: string | null
  created_at: string
  updated_at: string
  message_count?: number
}

interface Props {
  user: { id: string } | null
  profile: { plan?: string } | null
  navigate: (v: string) => void
  onBack: () => void
  onOpenTicket: (id: string) => void
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em análise',
  waiting_client: 'Aguardando resposta',
  awaiting_admin: 'Aguardando suporte',
  awaiting_user: 'Aguardando você',
  resolved: 'Respondido',
  closed: 'Fechado',
}
// Paleta suave alinhada à marca (âmbar / mint / coral).
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-50 text-amber-700',
  in_progress: 'bg-sky text-[#3d6ea5]',
  waiting_client: 'bg-coral/40 text-[#8a3b23]',
  awaiting_admin: 'bg-amber-50 text-amber-700',
  awaiting_user: 'bg-coral/40 text-[#8a3b23]',
  resolved: 'bg-mint text-forest-700',
  closed: 'bg-paper-soft text-ink-soft border border-line',
}

const HELP_TOPICS: { q: string; a: string }[] = [
  {
    q: 'Como funciona o Plano Plus?',
    a: 'O Plus inclui tudo do Essencial e adiciona Aprofundamentos do Diário, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal por mensagem. A orientação parte de uma pergunta específica que você envia. É não emergencial e não substitui acompanhamento clínico. Você pode assinar ou trocar de plano quando quiser em "Meu Plano".',
  },
  {
    q: 'Como cancelar assinatura?',
    a: 'Acesse "Meu Plano" no menu e escolha cancelar a assinatura. O cancelamento é agendado para o fim do período já pago — você continua com acesso até lá, sem multa. Depois disso, sua conta volta para o plano Gratuito e todos os seus registros continuam salvos.',
  },
  {
    q: 'Privacidade e segurança',
    a: 'Seus registros são pessoais e privados. Não vendemos nem compartilhamos suas informações, e o conteúdo sensível fica sempre dentro da sua conta, protegido por login. Você encontra os detalhes nas páginas de Privacidade e Termos de uso.',
  },
  {
    q: 'Como usar os recursos',
    a: 'Um bom caminho: comece pelo Diário (um check-in rápido de humor ou uma entrada completa), responda ao Questionário inicial para se conhecer melhor, acompanhe seus padrões no Mapa Emocional e explore os Conteúdos Guiados. Conforme você registra, o app organiza tudo em relatórios para você enxergar sua evolução com calma.',
  },
]

const inputCls = 'w-full px-3.5 py-2.5 border border-line rounded-xl text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 focus:border-forest-300 transition-colors'

export default function SupportPage({ user, profile, navigate, onBack, onOpenTicket }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [sentWarning, setSentWarning] = useState<string | null>(null)
  const [openTopic, setOpenTopic] = useState<number | null>(null)
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium', category: DEFAULT_SUPPORT_CATEGORY })
  const [files, setFiles] = useState<File[]>([])

  const isPlus = normalizePlan(profile?.plan) === 'plus'

  useEffect(() => {
    if (!user) return
    loadTickets()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function loadTickets() {
    setLoading(true)
    setLoadError(false)
    const { data: ticketData, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })

    if (error || !ticketData) { setLoading(false); setLoadError(true); return }

    const ids = ticketData.map(t => t.id)
    const { data: msgs } = ids.length > 0
      ? await supabase.from('ticket_messages').select('ticket_id').in('ticket_id', ids).eq('is_internal', false)
      : { data: [] }

    const countMap = new Map<string, number>()
    for (const m of (msgs || [])) {
      countMap.set(m.ticket_id, (countMap.get(m.ticket_id) ?? 0) + 1)
    }

    setTickets(ticketData.map(t => ({ ...t, message_count: countMap.get(t.id) ?? 0 })))
    setLoading(false)
  }

  async function handleCreate() {
    if (!user) return
    setCreateError(null)
    setSent(false)
    setSentWarning(null)
    if (!form.subject.trim() || !form.description.trim()) {
      setCreateError('Preencha o assunto e a mensagem.'); return
    }
    if (form.description.trim().length < 20) {
      setCreateError('A mensagem deve ter pelo menos 20 caracteres.'); return
    }
    setCreating(true)

    // Tickets passam pela Edge Function: ela valida o usuário no servidor,
    // aplica limite anti-spam e grava usando privilégios internos. O cliente
    // não recebe INSERT direto na tabela de suporte.
    const { data, error } = await supabase.functions.invoke('submit-contact-ticket', {
      body: {
        subject: form.subject.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category: form.category,
        website: '',
      },
    })

    if (error || data?.error) {
      setCreateError('Erro ao enviar. Tente novamente.')
      setCreating(false)
      return
    }

    let attachmentWarning: string | null = null
    if (files.length > 0) {
      const ticketId = typeof data?.ticket_id === 'string' ? data.ticket_id : ''
      if (!ticketId) {
        attachmentWarning = 'O chamado foi criado, mas os anexos não puderam ser vinculados. Você pode enviá-los ao abrir o chamado.'
      } else {
        let uploaded: SupportAttachment[] = []
        try {
          uploaded = await uploadSupportAttachments(user.id, ticketId, files)
          const { error: messageError } = await supabase.from('ticket_messages').insert({
            ticket_id: ticketId,
            sender_id: user.id,
            sender_role: 'user',
            content: uploaded.length === 1 ? 'Anexo enviado na abertura do chamado.' : 'Anexos enviados na abertura do chamado.',
            is_internal: false,
            attachments: uploaded,
          })
          if (messageError) {
            await removeSupportAttachments(uploaded)
            attachmentWarning = 'O chamado foi criado, mas não foi possível anexar os arquivos. Você pode enviá-los ao abrir o chamado.'
          }
        } catch {
          if (uploaded.length) await removeSupportAttachments(uploaded)
          attachmentWarning = 'O chamado foi criado, mas não foi possível anexar os arquivos. Você pode enviá-los ao abrir o chamado.'
        }
      }
    }

    setForm({ subject: '', description: '', priority: 'medium', category: DEFAULT_SUPPORT_CATEGORY })
    setFiles([])
    setCreating(false)
    setSentWarning(attachmentWarning)
    setSent(true)
    void loadTickets()
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <MessageCircle className="w-10 h-10 text-forest-300 mx-auto mb-4" />
        <p className="text-ink-soft mb-4">Faça login para acessar o suporte.</p>
        <button onClick={() => navigate('auth')} className="bg-forest-900 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-forest-800">
          Entrar
        </button>
      </div>
    )
  }

  // Tela de confirmação: substitui o suporte após enviar uma mensagem.
  if (sent) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-mint flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-forest-600" />
        </div>
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900">Mensagem enviada!</h1>
        <p className="mt-3 text-ink-soft leading-relaxed">
          Recebemos sua solicitação e nossa equipe responde com carinho — normalmente {getSupportSlaLabel(profile?.plan)}.
          Você recebe a resposta por aqui e pode acompanhar o status dos seus chamados a qualquer momento.
        </p>
        {sentWarning && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{sentWarning}</p>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <button
            onClick={() => { setSent(false); setSentWarning(null) }}
            className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Abrir nova solicitação
          </button>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 border border-line text-forest-900 text-sm font-medium px-5 py-2.5 rounded-2xl hover:bg-mint/40 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">
          Suporte e contato <HeartHandshake className="w-6 h-6 text-forest-400" />
        </h1>
        <p className="mt-2 text-ink-soft">Estamos aqui para te ouvir e ajudar no que for preciso.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 lg:gap-6">
        {/* ─── Coluna principal ─── */}
        <div className="space-y-5 min-w-0">
          {/* Formulário */}
          <section className="bg-paper-soft border border-line rounded-3xl p-5 sm:p-6">
            <h2 className="font-serif text-lg sm:text-xl text-forest-900">Fale com a nossa equipe</h2>
            <p className="text-sm text-ink-soft mt-1 mb-4">Envie sua mensagem e responderemos com carinho.</p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="support-subject" className="block text-sm font-medium text-forest-800 mb-1.5">Assunto</label>
                <input id="support-subject" className={inputCls} placeholder="Em que podemos te ajudar?" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="support-category" className="block text-sm font-medium text-forest-800 mb-1.5">Categoria</label>
                <select id="support-category" className={inputCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as typeof DEFAULT_SUPPORT_CATEGORY }))}>
                  {SUPPORT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="support-priority" className="block text-sm font-medium text-forest-800 mb-1.5">Prioridade</label>
                <select id="support-priority" className={inputCls} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="support-message" className="block text-sm font-medium text-forest-800 mb-1.5">Mensagem</label>
              <div className="relative">
                <textarea
                  id="support-message"
                  className={inputCls + ' resize-none'}
                  rows={5}
                  maxLength={1000}
                  placeholder="Escreva sua mensagem aqui…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
                <span className="absolute bottom-2.5 right-3 text-[11px] text-ink-soft/70">{form.description.length}/1000</span>
              </div>
            </div>

            <div className="mt-4">
              <SupportAttachmentPicker files={files} onChange={setFiles} onError={setCreateError} disabled={creating} />
            </div>

            {createError && <p className="text-sm text-coral mt-3">{createError}</p>}

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors disabled:opacity-60"
              >
                <Send className="w-4 h-4" /> {creating ? 'Enviando…' : 'Enviar mensagem'}
              </button>
              <span className="text-xs text-ink-soft">Prazo estimado de resposta: <strong className="text-forest-700 font-medium">{getSupportSlaLabel(profile?.plan)}</strong></span>
            </div>
          </section>

          {/* Acompanhe seus chamados */}
          <section className="bg-paper-soft border border-line rounded-3xl p-5 sm:p-6">
            <h2 className="font-serif text-lg sm:text-xl text-forest-900 mb-1">Acompanhe seus chamados</h2>
            <p className="text-sm text-ink-soft mb-4">Veja o status das suas solicitações recentes.</p>
            {loading ? (
              <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 bg-mint/40 rounded-2xl animate-pulse" />)}</div>
            ) : loadError ? (
              <div className="text-center py-6">
                <p className="text-sm text-ink-soft mb-3">Não foi possível carregar seus chamados agora.</p>
                <button
                  onClick={loadTickets}
                  className="text-sm font-medium text-forest-700 hover:text-forest-800 underline"
                >
                  Tentar novamente
                </button>
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-ink-soft text-center py-6">Você ainda não abriu nenhum chamado.</p>
            ) : (
              <div className="space-y-2">
                {tickets.map(ticket => (
                  <button
                    key={ticket.id}
                    onClick={() => onOpenTicket(ticket.id)}
                    className="w-full text-left bg-white border border-line rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-forest-200 hover:shadow-sm transition-all"
                  >
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[ticket.status] ?? 'bg-mint text-forest-700'}`}>
                      {STATUS_LABEL[ticket.status] ?? ticket.status}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-forest-900 truncate">{ticket.subject}</p>
                      <p className="text-[11px] text-ink-soft flex items-center gap-2 mt-0.5">
                        {ticket.category && <span>{ticket.category}</span>}
                        <span className="font-mono">#{ticket.ticket_number}</span>
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {new Date(ticket.updated_at).toLocaleDateString('pt-BR')}</span>
                        {(ticket.message_count ?? 0) > 0 && <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {ticket.message_count}</span>}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-soft flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ─── Coluna lateral ─── */}
        <aside className="space-y-5">
          {/* Emergência */}
          <div className="rounded-3xl border border-coral/40 bg-coral/15 p-5">
            <div className="flex items-center gap-2 text-[#8a3b23] mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="font-serif text-lg">Não é atendimento de emergência</h2>
            </div>
            <p className="text-sm text-[#7a3320] leading-relaxed">
              Se você estiver em crise ou precisar de ajuda imediata, procure o <strong>CVV (188)</strong>, o <strong>SAMU (192)</strong> ou o serviço de emergência mais próximo.
            </p>
          </div>

          {/* Tópicos de ajuda (acordeão) */}
          <div className="bg-paper-soft border border-line rounded-3xl p-5">
            <h2 className="font-serif text-lg text-forest-900 mb-3">Tópicos de ajuda</h2>
            <ul className="divide-y divide-line/70">
              {HELP_TOPICS.map((t, i) => {
                const open = openTopic === i
                return (
                  <li key={t.q}>
                    <button
                      onClick={() => setOpenTopic(open ? null : i)}
                      aria-expanded={open}
                      className="w-full flex items-center gap-2 text-left text-sm text-forest-900 py-2.5 hover:text-forest-700 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-forest-500 flex-shrink-0" />
                      <span className="flex-1 min-w-0">{t.q}</span>
                      <ChevronDown className={`w-4 h-4 text-ink-soft flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <p className="text-sm text-ink-soft leading-relaxed pl-6 pr-1 pb-3">{t.a}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Orientação profissional (Plus) */}
          <div className="rounded-3xl bg-forest-900 text-white p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-serif text-lg">Orientação profissional</h2>
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full flex items-center gap-1"><Crown className="w-3 h-3" /> Plus</span>
            </div>
            <p className="text-sm text-forest-50/90 leading-relaxed">Orientação mensal por mensagem — um direcionamento individual e não emergencial, enviado uma vez por mês com base nos seus registros.</p>
            <button
              onClick={() => navigate(isPlus ? 'monthly-guidance' : 'pricing')}
              className="mt-4 inline-flex items-center gap-2 bg-white text-forest-900 text-sm font-medium px-4 py-2 rounded-xl hover:bg-mint transition-colors"
            >
              {isPlus ? 'Enviar mensagem de orientação' : 'Conhecer o Plus'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>

      {/* Banner */}
      <div className="mt-6 rounded-3xl border border-line bg-mint/40 px-5 sm:px-6 py-4 flex items-center gap-4">
        <span className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0 text-forest-600"><HeartHandshake className="w-5 h-5" /></span>
        <p className="text-sm text-forest-800 leading-relaxed">Agradecemos sua confiança. Nosso time está aqui para caminhar com você.</p>
      </div>
    </div>
  )
}
