import { useState } from 'react'
import { Instagram, Facebook, Mail, Heart } from 'lucide-react'
import { LogoIcon } from './Logo'

interface FooterProps {
  onNavigate: (section: string) => void
}

const COLS: { title: string; links: { label: string; id: string }[] }[] = [
  {
    title: 'Navegação',
    links: [
      { label: 'Conteúdos', id: 'articles' },
      { label: 'Diário', id: 'diary' },
      { label: 'Mapa emocional', id: 'my-evolution' },
      { label: 'Planos', id: 'pricing' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { label: 'Perguntas frequentes', id: 'faq' },
      { label: 'Privacidade', id: 'privacy' },
      { label: 'Termos de uso', id: 'terms' },
      { label: 'Segurança', id: 'responsibility' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre', id: 'about' },
      { label: 'Contato', id: 'contact' },
      { label: 'Carreiras', id: 'contact' },
    ],
  },
]

export default function Footer({ onNavigate }: FooterProps) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <footer className="bg-paper border-t border-line pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-10">
          {/* Marca */}
          <div className="col-span-2">
            <button onClick={() => onNavigate('home')} className="flex items-center gap-2 mb-3">
              <LogoIcon className="w-6 h-6 text-forest-900" />
              <span className="font-serif text-xl text-forest-900">A Vida Não Colabora</span>
            </button>
            <p className="text-sm text-ink-soft leading-relaxed max-w-xs">
              Um lugar para se organizar por dentro nos dias difíceis.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {[
                { Icon: Instagram, label: 'Instagram' },
                { Icon: Facebook, label: 'Facebook' },
                { Icon: Mail, label: 'E-mail' },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  onClick={e => e.preventDefault()}
                  className="w-9 h-9 rounded-full border border-line flex items-center justify-center text-forest-700 hover:bg-mint hover:border-mint transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Colunas de links */}
          {COLS.map(col => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-forest-900 mb-3">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(link => (
                  <li key={link.label}>
                    <button
                      onClick={() => onNavigate(link.id)}
                      className="text-sm text-ink-soft hover:text-forest-800 transition-colors text-left"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="mt-12 pt-8 border-t border-line grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div>
            <h4 className="font-serif text-xl text-forest-900">Receba conteúdos que acolhem</h4>
            <p className="text-sm text-ink-soft mt-1">Junte-se a quem escolhe se cuidar.</p>
          </div>
          <form
            onSubmit={e => { e.preventDefault(); if (email.trim()) setSent(true) }}
            className="flex gap-2 w-full md:justify-end"
          >
            {sent ? (
              <p className="text-sm text-forest-700 self-center">Recebido! Em breve você recebe novidades. 💚</p>
            ) : (
              <>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Seu e-mail"
                  className="flex-1 md:max-w-xs px-4 py-2.5 rounded-2xl border border-line bg-white text-sm outline-none focus:border-forest-400"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium whitespace-nowrap transition-colors"
                >
                  Quero receber
                </button>
              </>
            )}
          </form>
        </div>

        {/* Rodapé inferior */}
        <div className="mt-10 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-ink-soft">
            © {new Date().getFullYear()} A Vida Não Colabora. Todos os direitos reservados.
          </p>
          <p className="text-xs text-ink-soft flex items-center gap-1">
            Feito com cuidado no Brasil <Heart className="w-3 h-3 text-[#c05f3c]" fill="currentColor" />
          </p>
        </div>
      </div>
    </footer>
  )
}
