import { Heart, Phone } from 'lucide-react'

interface FooterProps {
  onNavigate: (section: string) => void
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-sage-800 text-sage-100 pt-12 pb-6 mt-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-5 h-5 text-sage-300" />
              <span className="font-serif text-xl text-white">A Vida Não Colabora</span>
            </div>
            <p className="text-sm text-sage-300 leading-relaxed mb-3">
              Um espaço de apoio ao autoconhecimento e organização emocional. Para quem sente, para quem carrega, para quem busca se entender.
            </p>
            <p className="text-xs text-sage-400 leading-relaxed">
              Este serviço é uma ferramenta de apoio ao autoconhecimento e à organização emocional. Ele não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Navegação</h4>
            <ul className="space-y-2">
              {[
                { label: 'Início', id: 'home' },
                { label: 'Blog', id: 'articles' },
                { label: 'Diário', id: 'diary' },
                { label: 'Questionários', id: 'questionnaire' },
                { label: 'Planos', id: 'pricing' },
                { label: 'Sobre', id: 'about' },
                { label: 'Contato', id: 'contact' },
              ].map(item => (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(item.id)}
                    className="text-sm text-sage-300 hover:text-white transition-colors"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
              <li className="pt-2 border-t border-sage-700">
                <button
                  onClick={() => onNavigate('privacy')}
                  className="text-xs text-sage-400 hover:text-sage-200 transition-colors block mb-1"
                >
                  Privacidade
                </button>
                <button
                  onClick={() => onNavigate('terms')}
                  className="text-xs text-sage-400 hover:text-sage-200 transition-colors block mb-1"
                >
                  Termos de Uso
                </button>
                <button
                  onClick={() => onNavigate('responsibility')}
                  className="text-xs text-sage-400 hover:text-sage-200 transition-colors block"
                >
                  Aviso de Responsabilidade
                </button>
              </li>
            </ul>
          </div>

          {/* Emergency */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Emergência</h4>
            <div className="bg-sage-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-sage-300" />
                <span className="font-semibold text-white">CVV — 188</span>
              </div>
              <p className="text-xs text-sage-300 leading-relaxed">
                Centro de Valorização da Vida. Atendimento gratuito, 24 horas, para quem precisa conversar.
              </p>
              <a
                href="https://cvv.org.br"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-sage-200 underline mt-2 inline-block hover:text-white"
              >
                cvv.org.br
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-sage-700 pt-6 text-center">
          <p className="text-xs text-sage-400 mb-1">
            Este serviço não substitui acompanhamento profissional de saúde mental. Se você precisar de ajuda, procure um psicólogo, psiquiatra ou médico de confiança.
          </p>
          <p className="text-xs text-sage-500 mt-2">
            © {new Date().getFullYear()} A Vida Não Colabora. Feito com cuidado e palavras.
          </p>
        </div>
      </div>
    </footer>
  )
}
