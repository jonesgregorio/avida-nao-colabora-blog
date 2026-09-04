import { useState } from 'react'
import { ChevronDown, MessageCircle, Mail, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useFaqItems } from '../lib/siteContent'

interface FAQPageProps {
  onNavigate: (section: string) => void
}

const FAQS: { question: string; answer: string; category: string }[] = [
  // Conta e acesso
  {
    category: 'Conta e acesso',
    question: 'Como crio minha conta?',
    answer: 'Clique em "Começar gratuitamente" em qualquer página, informe seu nome, e-mail e crie uma senha. Depois do cadastro, enviamos um link de confirmação para o endereço informado. O acesso à área logada é liberado somente após confirmar o e-mail. Se o link não chegar, verifique a caixa de spam ou use a opção de reenviar na tela de confirmação.',
  },
  {
    category: 'Conta e acesso',
    question: 'Esqueci minha senha. O que faço?',
    answer: 'Na tela de login, clique em "Esqueci minha senha". Você receberá um link de redefinição no e-mail cadastrado. O link expira em 1 hora.',
  },
  {
    category: 'Conta e acesso',
    question: 'Posso usar no celular?',
    answer: 'Sim. A plataforma funciona em qualquer navegador mobile (Chrome, Safari, Firefox). Não há necessidade de instalar aplicativo — acesse pelo navegador do seu celular normalmente.',
  },
  {
    category: 'Conta e acesso',
    question: 'Posso excluir minha conta?',
    answer: 'Sim. Em Meu perfil > Privacidade e seus dados, você pode excluir a conta por autoatendimento. Para sua segurança, é necessário informar a senha atual e digitar EXCLUIR. A conta e os dados pessoais vinculados ao aplicativo são removidos ao concluir o processo; se houver cadastro de cobrança no Stripe, ele é encerrado antes da exclusão para impedir novas cobranças. Registros que prestadores precisem conservar por obrigação legal, segurança ou auditoria seguem os prazos aplicáveis desses prestadores.',
  },
  // Planos e pagamento
  {
    category: 'Planos e pagamento',
    question: 'O plano gratuito tem prazo de validade?',
    answer: 'Não. O plano Gratuito é para sempre, sem limite de tempo. Você pode usar as funcionalidades básicas pelo tempo que quiser, sem precisar inserir cartão de crédito.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Qual a diferença entre os planos?',
    answer: 'O Gratuito permite começar com Check-in diário, Diário emocional em até 5 dias por mês, Diário por voz, uma seleção de questionários, conteúdos guiados e uma visão inicial da Minha História. O Essencial amplia o acompanhamento com Diário sem limite mensal, Mapa Emocional, Descobertas, Minha História completa, Relatório Semanal, Meu Jardim e conteúdos guiados completos. O Plus inclui tudo do Essencial e acrescenta Aprofundamentos do Diário, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Como funciona o pagamento?',
    answer: 'Os planos pagos são cobrados mensalmente via cartão de crédito, processados com segurança pelo Stripe (padrão PCI DSS nível 1). Não armazenamos dados do seu cartão.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Posso cancelar quando quiser?',
    answer: 'Sim, sem multa. Ao cancelar, seu acesso ao plano pago continua até o final do período já pago. Após isso, sua conta volta automaticamente para o plano Gratuito e seus dados ficam preservados.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Existe reembolso?',
    answer: 'Analisamos pedidos de reembolso caso a caso. Em geral, oferecemos reembolso proporcional nos primeiros 7 dias após a assinatura se o serviço não atendeu ao esperado. Entre em contato pelo formulário abaixo.',
  },
  // Diário e conteúdo
  {
    category: 'Diário e funcionalidades',
    question: 'Meus registros do diário são privados?',
    answer: 'Sim. Seus registros ficam protegidos por controles de acesso e não são disponibilizados publicamente. O conteúdo pode ser processado automaticamente para gerar mapas, relatórios, planos e recomendações. Em recursos do Plus que preveem revisão profissional, o profissional recebe o relatório ou o contexto necessário para a devolutiva, conforme o fluxo apresentado a você; isso não transforma o diário em uma área de leitura livre pela equipe.',
  },
  {
    category: 'Diário e funcionalidades',
    question: 'Posso exportar meus dados?',
    answer: 'Sim. Em Meu perfil > Privacidade e seus dados, clique em "Baixar meus dados". A plataforma prepara um arquivo JSON legível com os dados vinculados à sua conta, incluindo perfil, diário, check-ins, questionários, relatórios, planos, preferências, suporte, histórico de uso e informações de assinatura/cobrança aplicáveis.',
  },
  {
    category: 'Diário e funcionalidades',
    question: 'Os conteúdos do blog são para todos?',
    answer: 'Os conteúdos marcados como "Público" podem ser lidos por qualquer pessoa, sem precisar criar conta. Conteúdos dos planos Essencial e Plus ficam disponíveis somente para assinantes dos respectivos planos.',
  },
  {
    category: 'Diário e funcionalidades',
    question: 'O que é o mapa emocional?',
    answer: 'O mapa emocional é uma visualização dos seus registros ao longo do tempo — humor, energia, sintomas e padrões emocionais — apresentados em gráficos e resumos. Disponível no plano Essencial e Plus.',
  },
  // Saúde e segurança
  {
    category: 'Saúde e segurança',
    question: 'Vocês fazem diagnósticos?',
    answer: 'Não. A plataforma é uma ferramenta de autoconhecimento e organização emocional. Não realizamos diagnósticos de qualquer tipo. Se você precisar de avaliação clínica, procure um profissional de saúde mental habilitado.',
  },
  {
    category: 'Saúde e segurança',
    question: 'E se eu estiver em crise?',
    answer: 'Se você estiver em crise ou pensando em se machucar, procure ajuda imediatamente: CVV 188 (gratuito, 24h) ou SAMU 192. Esta plataforma não é um serviço de emergência.',
  },
  {
    category: 'Saúde e segurança',
    question: 'O Plano Plus substitui o acompanhamento com psicólogo?',
    answer: 'Não. O Plus reúne recursos adicionais de autoconhecimento — Aprofundamentos do Diário, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal por mensagem, esta última a partir de uma pergunta específica enviada por você. Nenhum deles substitui psicoterapia, avaliação clínica ou acompanhamento profissional continuado.',
  },
]

export default function FAQPage({ onNavigate: _onNavigate }: FAQPageProps) {
  const dbFaqs = useFaqItems()
  const faqList: { question: string; answer: string; category: string }[] = dbFaqs
    ? dbFaqs.map(f => ({ question: f.question, answer: f.answer, category: f.category }))
    : FAQS
  const CATEGORIES = [...new Set(faqList.map(f => f.category))]

  const [open, setOpen] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('Todos')
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [website, setWebsite] = useState('')

  const filtered = activeCategory === 'Todos' ? faqList : faqList.filter(f => f.category === activeCategory)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return
    setSending(true)
    setError('')
    try {
      const { data, error: err } = await supabase.functions.invoke('submit-contact-ticket', { body: {
        contact_email: form.email.trim(),
        contact_name: form.name.trim(),
        subject: form.subject.trim() || 'Contato via FAQ',
        description: form.message.trim(),
        website,
      } })
      if (err || data?.error) throw new Error(data?.error ?? 'submit_failed')
      setSent(true)
    } catch {
      setError('Não foi possível enviar. Tente novamente em instantes.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Hero */}
      <div className="bg-white border-b border-line">
        <div className="max-w-3xl mx-auto px-4 py-14 text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-forest-600 mb-3">Ajuda</span>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mb-4">Perguntas frequentes</h1>
          <p className="text-ink-soft leading-relaxed max-w-xl mx-auto">
            Encontre respostas rápidas sobre a plataforma, planos e funcionalidades. Não achou o que procura? Fale com a gente pelo formulário no final da página.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Filtro de categorias */}
        <div className="flex flex-wrap gap-2 mb-8">
          {['Todos', ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setOpen(null) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-forest-900 text-white'
                  : 'bg-white border border-line text-ink-soft hover:border-forest-300 hover:text-forest-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Acordeão */}
        <div className="space-y-2">
          {filtered.map((faq) => {
            const idx = faqList.indexOf(faq)
            const isOpen = open === idx
            return (
              <div key={idx} className="bg-white border border-line rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-paper-soft transition-colors"
                >
                  <span className="font-medium text-forest-900 text-sm leading-snug">{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-forest-600 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div id={`faq-answer-${idx}`} className="px-6 pb-5 pt-0">
                    <div className="border-t border-line pt-4">
                      <p className="text-ink-soft text-sm leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Aviso de crise */}
        <div className="mt-10 bg-white border border-line rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-forest-700 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-forest-900 text-sm mb-1">Em situação de crise ou emergência?</h3>
              <p className="text-ink-soft text-sm leading-relaxed">
                Esta plataforma não é um serviço de emergência. Se precisar de ajuda imediata, ligue para o <strong className="text-forest-900">CVV: 188</strong> (gratuito, 24h) ou <strong className="text-forest-900">SAMU: 192</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Formulário de contato */}
        <div className="mt-14">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-mint mb-4">
              <MessageCircle className="w-5 h-5 text-forest-700" />
            </div>
            <h2 className="font-serif text-2xl text-forest-900 mb-2">Não encontrou sua resposta?</h2>
            <p className="text-ink-soft text-sm">Envie sua dúvida e retornaremos em até 2 dias úteis.</p>
          </div>

          {sent ? (
            <div className="bg-white border border-line rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-mint flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-forest-700" />
              </div>
              <h3 className="font-semibold text-forest-900 mb-2">Mensagem enviada!</h3>
              <p className="text-ink-soft text-sm">Recebemos sua dúvida e retornaremos em breve pelo e-mail informado.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white border border-line rounded-2xl p-6 md:p-8 space-y-4">
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="faq-website">Não preencha este campo</label>
                <input id="faq-website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="faq-name" className="block text-xs font-medium text-forest-700 mb-1.5">Nome</label>
                  <input
                    id="faq-name"
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Seu nome"
                    className="w-full px-4 py-2.5 border border-line rounded-xl text-sm text-forest-900 placeholder-ink-soft focus:outline-none focus:border-forest-400 bg-paper-soft"
                  />
                </div>
                <div>
                  <label htmlFor="faq-email" className="block text-xs font-medium text-forest-700 mb-1.5">E-mail</label>
                  <input
                    id="faq-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="seu@email.com"
                    className="w-full px-4 py-2.5 border border-line rounded-xl text-sm text-forest-900 placeholder-ink-soft focus:outline-none focus:border-forest-400 bg-paper-soft"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="faq-subject" className="block text-xs font-medium text-forest-700 mb-1.5">Assunto</label>
                <input
                  id="faq-subject"
                  type="text"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Sobre o que é sua dúvida?"
                  className="w-full px-4 py-2.5 border border-line rounded-xl text-sm text-forest-900 placeholder-ink-soft focus:outline-none focus:border-forest-400 bg-paper-soft"
                />
              </div>
              <div>
                <label htmlFor="faq-message" className="block text-xs font-medium text-forest-700 mb-1.5">Mensagem</label>
                <textarea
                  id="faq-message"
                  required
                  rows={5}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Descreva sua dúvida com detalhes..."
                  className="w-full px-4 py-2.5 border border-line rounded-xl text-sm text-forest-900 placeholder-ink-soft focus:outline-none focus:border-forest-400 bg-paper-soft resize-none"
                />
              </div>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sending}
                  className="px-6 py-2.5 bg-forest-900 hover:bg-forest-800 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {sending ? 'Enviando...' : 'Enviar mensagem'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
