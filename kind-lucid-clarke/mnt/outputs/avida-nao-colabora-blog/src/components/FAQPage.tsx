import { useState } from 'react'
import { ChevronDown, MessageCircle, Mail, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useFaqItems } from '../lib/siteContent'
import { FAQ_FALLBACK } from '../lib/faqContent'

interface FAQPageProps {
  onNavigate: (section: string) => void
}

const FAQS = FAQ_FALLBACK

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
