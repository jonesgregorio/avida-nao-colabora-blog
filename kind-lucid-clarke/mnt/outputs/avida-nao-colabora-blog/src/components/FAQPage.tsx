import { useState } from 'react'
import { ChevronDown, MessageCircle, Mail, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface FAQPageProps {
  onNavigate: (section: string) => void
}

const FAQS: { question: string; answer: string; category: string }[] = [
  // Conta e acesso
  {
    category: 'Conta e acesso',
    question: 'Como crio minha conta?',
    answer: 'Clique em "Começar gratuitamente" em qualquer página. Basta informar seu nome, e-mail e criar uma senha. O acesso é imediato — sem necessidade de confirmar e-mail.',
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
    answer: 'Sim. Nas configurações do seu perfil, há a opção de excluir a conta. Todos os seus dados pessoais e registros do diário são apagados em até 30 dias após a solicitação.',
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
    answer: 'O plano Gratuito dá acesso ao diário básico (5 registros/mês), blog aberto e questionário inicial. O Essencial libera diário ilimitado, histórico completo, mapa emocional e relatório semanal. O Plus inclui tudo do Essencial mais plano de autocuidado mensal, relatório aprofundado e orientação por mensagem com profissional.',
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
    answer: 'Sim, absolutamente. Os registros do diário são visíveis apenas para você. Nossa equipe não acessa seus registros pessoais. Os dados são usados apenas de forma automática para gerar seus relatórios — sem revisão humana.',
  },
  {
    category: 'Diário e funcionalidades',
    question: 'Posso exportar meus dados?',
    answer: 'Sim. Você pode solicitar a exportação dos seus dados a qualquer momento pelo perfil ou entrando em contato. Disponibilizamos os dados em formato legível conforme exige a LGPD.',
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
    answer: 'Não. A orientação mensal por mensagem e o comentário profissional do Plano Plus são recursos complementares de suporte — não substituem psicoterapia ou acompanhamento clínico continuado.',
  },
]

const CATEGORIES = [...new Set(FAQS.map(f => f.category))]

export default function FAQPage({ onNavigate }: FAQPageProps) {
  const [open, setOpen] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('Todos')
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const filtered = activeCategory === 'Todos' ? FAQS : FAQS.filter(f => f.category === activeCategory)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return
    setSending(true)
    setError('')
    try {
      await supabase.from('support_tickets').insert({
        user_email: form.email.trim(),
        subject: form.subject.trim() || 'Contato via FAQ',
        message: `Nome: ${form.name.trim()}\n\n${form.message.trim()}`,
        source: 'web',
        status: 'open',
      })
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
          {filtered.map((faq, i) => {
            const idx = FAQS.indexOf(faq)
            const isOpen = open === idx
            return (
              <div key={idx} className="bg-white border border-line rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-paper-soft transition-colors"
                >
                  <span className="font-medium text-forest-900 text-sm leading-snug">{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-forest-600 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 pt-0">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-forest-700 mb-1.5">Nome</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Seu nome"
                    className="w-full px-4 py-2.5 border border-line rounded-xl text-sm text-forest-900 placeholder-ink-soft focus:outline-none focus:border-forest-400 bg-paper-soft"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-forest-700 mb-1.5">E-mail</label>
                  <input
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
                <label className="block text-xs font-medium text-forest-700 mb-1.5">Assunto</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Sobre o que é sua dúvida?"
                  className="w-full px-4 py-2.5 border border-line rounded-xl text-sm text-forest-900 placeholder-ink-soft focus:outline-none focus:border-forest-400 bg-paper-soft"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-forest-700 mb-1.5">Mensagem</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Descreva sua dúvida com detalhes..."
                  className="w-full px-4 py-2.5 border border-line rounded-xl text-sm text-forest-900 placeholder-ink-soft focus:outline-none focus:border-forest-400 bg-paper-soft resize-none"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
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
