import { BookOpen, Heart, Map, BarChart2, Sparkles, FileText } from 'lucide-react'
import CmsPage from './CmsPage'
import { useSitePage } from '../lib/siteContent'

interface AboutPageProps {
  onNavigate: (section: string) => void
}

export default function AboutPage({ onNavigate }: AboutPageProps) {
  const cms = useSitePage('sobre')
  if (cms) return <CmsPage title={cms.title} body={cms.body_md} kicker="Sobre nós" onNavigate={onNavigate} back />
  return (
    <div className="min-h-screen bg-paper">
      {/* Hero */}
      <div className="bg-white border-b border-line">
        <div className="max-w-3xl mx-auto px-4 py-14 text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-forest-600 mb-3">Sobre nós</span>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mb-4">Um espaço para quem sente</h1>
          <p className="text-ink-soft leading-relaxed max-w-xl mx-auto">
            O <strong className="text-forest-900">A Vida Não Colabora</strong> nasceu para ser um espaço de acolhimento, reflexão e organização emocional — para quem sente que as coisas às vezes pesam demais, e que carrega tudo sem apoio.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-12">

        {/* Nossa missão */}
        <section>
          <h2 className="font-serif text-2xl text-forest-900 mb-4">Nossa missão</h2>
          <div className="bg-white border border-line rounded-2xl p-6 space-y-3">
            <p className="text-ink-soft text-sm leading-relaxed">
              Nossa missão é oferecer um espaço seguro, gentil e sem julgamentos para que as pessoas possam registrar como estão se sentindo, entender seus padrões emocionais e criar pequenos hábitos de autocuidado no dia a dia.
            </p>
            <p className="text-ink-soft text-sm leading-relaxed">
              Acreditamos que o autoconhecimento é um caminho poderoso — e que cada pessoa merece ferramentas para se entender melhor, sem pressão e no seu próprio ritmo.
            </p>
          </div>
        </section>

        {/* Para quem é */}
        <section>
          <h2 className="font-serif text-2xl text-forest-900 mb-4">Para quem é</h2>
          <div className="bg-white border border-line rounded-2xl p-6">
            <p className="text-ink-soft text-sm mb-4">Este espaço foi criado para pessoas que:</p>
            <ul className="space-y-2.5">
              {[
                'Querem entender melhor suas emoções',
                'Vivem altos e baixos emocionais frequentes',
                'Precisam de um lugar seguro para registrar o que sentem',
                'Querem criar uma rotina de autocuidado de forma sustentável',
                'Buscam acompanhar sua evolução emocional ao longo do tempo',
                'Desejam apoio sem julgamento e sem pressa',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                  <span className="w-1.5 h-1.5 rounded-full bg-forest-400 flex-shrink-0 mt-1.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* O que oferecemos */}
        <section>
          <h2 className="font-serif text-2xl text-forest-900 mb-4">O que oferecemos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { Icon: FileText, title: 'Diário de bem-estar', desc: 'Espaço para registrar sentimentos com diferentes níveis de profundidade conforme o plano.' },
              { Icon: Sparkles, title: 'Questionários de autoavaliação', desc: 'Perguntas acolhedoras para entender como você está se sentindo.' },
              { Icon: BarChart2, title: 'Gráficos e relatórios', desc: 'Visualize seus padrões emocionais e evolução ao longo do tempo.' },
              { Icon: Heart, title: 'Pequenas práticas de autocuidado', desc: 'Ações pequenas e práticas para criar hábitos positivos no dia a dia.' },
              { Icon: BookOpen, title: 'Artigos e conteúdos', desc: 'Textos reflexivos sobre bem-estar emocional, autoconhecimento e autocuidado.' },
              { Icon: Map, title: 'Planos personalizados', desc: 'Sugestões e planos de autocuidado adaptados ao que você está vivendo.' },
            ].map(({ Icon, title, desc }, i) => (
              <div key={i} className="bg-white border border-line rounded-2xl p-5 flex gap-4">
                <div className="w-9 h-9 rounded-xl bg-mint flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-forest-700" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-forest-900 mb-1">{title}</h3>
                  <p className="text-xs text-ink-soft leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* O que não prometemos */}
        <section>
          <h2 className="font-serif text-2xl text-forest-900 mb-4">O que não prometemos</h2>
          <div className="bg-white border border-line rounded-2xl p-6 space-y-2.5">
            {[
              'Não fazemos diagnósticos de qualquer tipo',
              'Não substituímos acompanhamento psicológico, psiquiátrico ou médico',
              'Não tratamos condições de saúde mental',
              'Não prometemos cura ou resultado clínico de qualquer natureza',
              'Não somos um serviço de emergência ou crise',
            ].map((item, i) => (
              <p key={i} className="text-sm text-ink-soft flex items-start gap-2.5">
                <span className="text-forest-400 font-bold flex-shrink-0">✕</span>
                {item}
              </p>
            ))}
          </div>
        </section>

        {/* Sobre o autoconhecimento */}
        <section>
          <h2 className="font-serif text-2xl text-forest-900 mb-4">Sobre o autoconhecimento</h2>
          <div className="bg-white border border-line rounded-2xl p-6 space-y-3">
            <p className="text-ink-soft text-sm leading-relaxed">
              O autoconhecimento é um processo contínuo, não linear e profundamente pessoal. Ele não exige perfeição — exige presença e disposição para olhar para si com honestidade e gentileza.
            </p>
            <p className="text-ink-soft text-sm leading-relaxed">
              Registrar o que sentimos, perceber padrões e nomear emoções são práticas simples que, ao longo do tempo, podem transformar nossa relação conosco e com o mundo ao redor.
            </p>
            <p className="text-ink-soft text-sm leading-relaxed">
              Aqui, nenhuma emoção é errada. Nenhum caminho é mais válido do que outro. Você está no lugar certo, da forma que você é.
            </p>
          </div>
        </section>

        {/* Aviso importante */}
        <div className="bg-white border border-line rounded-2xl p-6">
          <h3 className="font-semibold text-forest-900 mb-2 text-sm">Aviso importante</h3>
          <p className="text-sm text-ink-soft leading-relaxed">
            Este serviço não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência. Se você estiver em crise, ligue para o{' '}
            <strong className="text-forest-900">CVV: 188</strong> (gratuito, 24h) ou acesse{' '}
            <a href="https://cvv.org.br" target="_blank" rel="noopener noreferrer" className="text-forest-700 underline underline-offset-2">cvv.org.br</a>.
          </p>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={() => onNavigate('auth')}
            className="bg-forest-900 hover:bg-forest-800 text-white px-8 py-3 rounded-2xl font-medium text-sm transition-colors"
          >
            Começar gratuitamente
          </button>
        </div>
      </div>
    </div>
  )
}
