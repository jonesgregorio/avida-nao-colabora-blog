import {
  HeartPulse, Wind, CloudRain, Layers, BatteryLow, HelpCircle, Shield, Lock,
  NotebookPen, CalendarCheck, MessageSquare, BarChart3, BookOpen, PenLine, LineChart, ArrowRight,
} from 'lucide-react'

interface HeroProps {
  onNavigate: (section: string) => void
}

const MOODS = [
  { id: 'ansioso', label: 'Ansioso', Icon: Wind, bg: 'bg-mint', color: 'text-forest-600' },
  { id: 'triste', label: 'Triste', Icon: CloudRain, bg: 'bg-sky', color: 'text-[#3d6ea5]' },
  { id: 'sobrecarregado', label: 'Sobrecarregado', Icon: Layers, bg: 'bg-coral', color: 'text-[#c05f3c]' },
  { id: 'sem-energia', label: 'Sem energia', Icon: BatteryLow, bg: 'bg-stone-100', color: 'text-stone-500' },
  { id: 'confuso', label: 'Confuso', Icon: HelpCircle, bg: 'bg-lilac', color: 'text-[#7c5cbf]' },
]

const PLUS_ITEMS = [
  { Icon: CalendarCheck, bg: 'bg-mint', color: 'text-forest-600', title: 'Plano de autocuidado', desc: 'Ações práticas para rotina, sono, limites e ansiedade.' },
  { Icon: MessageSquare, bg: 'bg-sky', color: 'text-[#3d6ea5]', title: 'Comentário profissional', desc: 'Um olhar profissional sobre seus registros.' },
  { Icon: BarChart3, bg: 'bg-lilac', color: 'text-[#7c5cbf]', title: 'Relatório mensal', desc: 'Padrões emocionais do mês.' },
]

const PATHS = [
  { Icon: BookOpen, bg: 'bg-mint', color: 'text-forest-600', title: 'Ler um texto', desc: 'Conteúdos escritos com carinho para acolher, informar e inspirar você.', cta: 'Explorar o blog', to: 'articles' },
  { Icon: PenLine, bg: 'bg-sky', color: 'text-[#3d6ea5]', title: 'Escrever no diário', desc: 'Um espaço seguro para colocar em palavras o que você sente.', cta: 'Ir para meu diário', to: 'diary' },
  { Icon: LineChart, bg: 'bg-coral', color: 'text-[#c05f3c]', title: 'Ver meu mapa emocional', desc: 'Acompanhe seus padrões, emoções e progressos ao longo do tempo.', cta: 'Ver meu mapa emocional', to: 'my-evolution' },
]

function PlusTag() {
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-coral text-[#b0532f] align-middle">Plus</span>
}

export default function Hero({ onNavigate }: HeroProps) {
  return (
    <section id="home" className="bg-paper">
      {/* ── Hero ── */}
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-10 md:pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Coluna esquerda — texto */}
          <div className="lg:col-span-4 lg:pt-6">
            <h1 className="font-serif text-4xl md:text-5xl leading-[1.08] text-forest-900">
              Um lugar para se organizar por dentro nos dias difíceis
            </h1>
            <p className="mt-5 text-ink-soft leading-relaxed max-w-md">
              Escreva, reflita e cuide de você com apoio e estrutura. Pequenos passos, reais e
              possíveis, um dia de cada vez.
            </p>

            <button
              onClick={() => onNavigate('diary')}
              className="mt-7 inline-flex items-center gap-2.5 bg-forest-900 hover:bg-forest-800 text-white font-medium text-sm px-6 py-3.5 rounded-2xl transition-colors shadow-sm"
            >
              <NotebookPen className="w-4 h-4" />
              Ir para meu diário
            </button>

            <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-soft">
              <Lock className="w-3.5 h-3.5" />
              Seus dados são privados e protegidos.
            </p>

            {/* Elemento natural (planta + xícara + caderno) — como na imagem de referência.
                Para trocar pela foto exata: substitua a src abaixo. */}
            <div className="hidden lg:block mt-10 -ml-6">
              <img
                src="https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=600&q=80"
                alt="Planta em um ambiente calmo e acolhedor"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                className="w-80 h-52 object-cover rounded-3xl border border-line shadow-sm"
              />
            </div>
          </div>

          {/* Coluna central — check-in emocional */}
          <div className="lg:col-span-5">
            <div className="bg-paper-soft border border-line rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-mint flex items-center justify-center">
                  <HeartPulse className="w-6 h-6 text-forest-600" />
                </div>
              </div>
              <h2 className="mt-4 text-center font-serif text-2xl text-forest-900">Como você está hoje?</h2>
              <p className="mt-2 text-center text-sm text-ink-soft max-w-sm mx-auto">
                Escolha como se sente para receber conteúdos e sugestões que façam sentido para você.
              </p>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
                {MOODS.map(({ id, label, Icon, bg, color }) => (
                  <button
                    key={id}
                    onClick={() => onNavigate('diary')}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-3 hover:border-forest-300 hover:shadow-sm transition-all"
                  >
                    <span className={`w-11 h-11 rounded-full ${bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </span>
                    <span className="text-[11px] text-ink text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>

              <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
                <Shield className="w-3.5 h-3.5" />
                Você pode mudar depois. Está tudo bem.
              </p>
            </div>
          </div>

          {/* Coluna direita — Recursos Plus */}
          <div className="lg:col-span-3">
            <div className="bg-paper-soft border border-line rounded-3xl p-6 shadow-sm h-full">
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-xl text-forest-900">Recursos Plus</h3>
                <PlusTag />
              </div>
              <p className="mt-1.5 text-sm text-ink-soft">Mais ferramentas para um cuidado ainda mais profundo.</p>

              <div className="mt-5 space-y-5">
                {PLUS_ITEMS.map(({ Icon, bg, color, title, desc }) => (
                  <div key={title} className="flex gap-3">
                    <span className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-forest-900 flex items-center gap-1.5">
                        {title} <PlusTag />
                      </p>
                      <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-6 pt-4 border-t border-line text-xs text-ink-soft">
                Recursos exclusivos do Plano Plus. Você pode ativar quando quiser.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Três caminhos ── */}
      <div className="max-w-6xl mx-auto px-4 pb-16 pt-4">
        <div className="text-center mb-8">
          <h2 className="font-serif text-2xl md:text-3xl text-forest-900 inline-block">
            Três caminhos para o seu cuidado diário
          </h2>
          <div className="w-16 h-0.5 bg-forest-500 mx-auto mt-3 rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PATHS.map(({ Icon, bg, color, title, desc, cta, to }) => (
            <button
              key={title}
              onClick={() => onNavigate(to)}
              className="text-left bg-paper-soft border border-line rounded-3xl p-6 hover:shadow-md hover:border-forest-200 transition-all group"
            >
              <span className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </span>
              <h3 className="font-serif text-xl text-forest-900">{title}</h3>
              <p className="mt-2 text-sm text-ink-soft leading-relaxed">{desc}</p>
              <span className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium ${color}`}>
                {cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
