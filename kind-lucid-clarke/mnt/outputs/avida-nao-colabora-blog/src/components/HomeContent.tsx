import {
  NotebookPen, Compass, BookOpen, CalendarCheck, MessageSquare,
  CheckCircle2, ShieldCheck, Lock, EyeOff, ArrowRight,
} from 'lucide-react'

interface HomeContentProps {
  onNavigate: (section: string) => void
}

// ── As 5 funcionalidades principais ──
const FEATURES = [
  { Icon: NotebookPen, bg: 'bg-mint', color: 'text-forest-600', title: 'Diário emocional', desc: 'Registre como está, escreva o que aconteceu e crie seu histórico pessoal.' },
  { Icon: Compass, bg: 'bg-sky', color: 'text-[#3d6ea5]', title: 'Mapa emocional', desc: 'Enxergue padrões no que você sente, repete e precisa observar com mais cuidado.' },
  { Icon: BookOpen, bg: 'bg-lilac', color: 'text-[#7c5cbf]', title: 'Conteúdos guiados', desc: 'Textos, práticas e exercícios de acordo com o que você está vivendo agora.' },
  { Icon: CalendarCheck, bg: 'bg-coral', color: 'text-[#c05f3c]', title: 'Plano de autocuidado', desc: 'Ações práticas para o mês: sono, rotina, limites, ansiedade e relações.', plus: true },
  { Icon: MessageSquare, bg: 'bg-mint', color: 'text-forest-600', title: 'Orientação profissional', desc: 'Comentário e orientação mensal de apoio. Não é terapia nem diagnóstico.', plus: true },
]

// ── Como funciona ──
const STEPS = [
  { n: '01', title: 'Faça seu check-in', desc: 'Diga como você está se sentindo hoje, sem julgamento.' },
  { n: '02', title: 'Escreva no diário', desc: 'Coloque em palavras o que passou por você.' },
  { n: '03', title: 'Veja seu mapa emocional', desc: 'Padrões, gráficos e evolução ao longo do tempo.' },
  { n: '04', title: 'Receba conteúdos e um plano', desc: 'Práticas e direção no seu ritmo.' },
]

// ── Planos (prévia) ──
const PLANS = [
  {
    key: 'free', name: 'Gratuito', price: 'R$ 0', promise: 'Comece a se entender',
    tagline: 'Para começar com leveza e conhecer os primeiros caminhos de autocuidado.',
    benefits: ['Blog aberto', 'Diário emocional básico', 'Questionário inicial', 'Algumas práticas guiadas'],
    cta: 'Começar grátis', to: 'auth', highlight: false,
  },
  {
    key: 'essential', name: 'Essencial', price: 'R$ 19,90', promise: 'Acompanhe seus padrões',
    tagline: 'Para transformar registros soltos em clareza sobre o que sente e repete.',
    benefits: ['Diário ilimitado', 'Mapa emocional completo', 'Histórico e gráficos', 'Conteúdos guiados completos', 'Relatório semanal automático'],
    cta: 'Assinar Essencial', to: 'pricing', highlight: true,
  },
  {
    key: 'plus', name: 'Plus', price: 'R$ 39,90', promise: 'Receba orientação para agir',
    tagline: 'Para transformar percepção em próximos passos, com apoio mensal.',
    benefits: ['Tudo do Essencial', 'Plano de autocuidado mensal', 'Relatório mensal aprofundado', 'Comentário profissional mensal', 'Orientação mensal por mensagem'],
    cta: 'Assinar Plus', to: 'pricing', highlight: false,
  },
]

function PlusTag() {
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-coral text-[#b0532f]">Plus</span>
}

export default function HomeContent({ onNavigate }: HomeContentProps) {
  return (
    <>
      {/* ── 5 funcionalidades principais ── */}
      <section className="bg-forest-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <p className="text-forest-300 text-sm uppercase tracking-widest mb-2">O que você encontra aqui</p>
            <h2 className="font-serif text-3xl md:text-4xl">Cinco formas de cuidar de você</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {FEATURES.map(({ Icon, bg, color, title, desc, plus }) => (
              <div key={title} className="bg-paper-soft rounded-3xl p-5 text-ink">
                <span className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </span>
                <h3 className="font-serif text-lg text-forest-900 flex items-center gap-1.5">
                  {title} {plus && <PlusTag />}
                </h3>
                <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section className="bg-paper">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl md:text-4xl text-forest-900">Como funciona</h2>
            <p className="mt-2 text-ink-soft">Simples, seguro e no seu ritmo.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="flex gap-4 bg-paper-soft border border-line rounded-3xl p-5">
                <span className="w-10 h-10 rounded-full bg-mint text-forest-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">{n}</span>
                <div>
                  <h3 className="font-medium text-forest-900">{title}</h3>
                  <p className="text-sm text-ink-soft mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planos ── */}
      <section className="bg-paper-soft border-y border-line">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl md:text-4xl text-forest-900">Planos que crescem com você</h2>
            <p className="mt-2 text-ink-soft">Comece grátis. Evolua quando fizer sentido.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {PLANS.map(p => (
              <div
                key={p.key}
                className={`rounded-3xl p-6 flex flex-col ${p.highlight ? 'bg-forest-900 text-white ring-2 ring-forest-900 shadow-lg md:-mt-2' : 'bg-white border border-line'}`}
              >
                {p.highlight && (
                  <span className="self-start text-[11px] font-semibold px-2.5 py-1 rounded-full bg-coral text-[#b0532f] mb-3">Recomendado</span>
                )}
                <h3 className={`font-serif text-2xl ${p.highlight ? 'text-white' : 'text-forest-900'}`}>{p.name}</h3>
                <p className={`text-sm mt-0.5 ${p.highlight ? 'text-forest-100' : 'text-ink-soft'}`}>{p.promise}</p>
                <div className="mt-4 mb-1">
                  <span className={`font-serif text-3xl ${p.highlight ? 'text-white' : 'text-forest-900'}`}>{p.price}</span>
                  {p.key !== 'free' && <span className={`text-sm ${p.highlight ? 'text-forest-100' : 'text-ink-soft'}`}>/mês</span>}
                </div>
                <p className={`text-sm leading-relaxed mb-5 ${p.highlight ? 'text-forest-100' : 'text-ink-soft'}`}>{p.tagline}</p>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {p.benefits.map(b => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${p.highlight ? 'text-coral' : 'text-forest-500'}`} />
                      <span className={p.highlight ? 'text-forest-50' : 'text-ink'}>{b}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onNavigate(p.to)}
                  className={`w-full py-3 rounded-2xl font-medium text-sm transition-colors ${
                    p.highlight
                      ? 'bg-white text-forest-900 hover:bg-forest-50'
                      : 'bg-forest-900 text-white hover:bg-forest-800'
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Segurança e privacidade ── */}
      <section className="bg-paper">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl text-forest-900">Seu espaço é privado</h2>
            <p className="mt-2 text-ink-soft">O que você escreve é seu. Ponto.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { Icon: Lock, title: 'Dados protegidos', desc: 'Seus registros ficam guardados com segurança e criptografia.' },
              { Icon: EyeOff, title: 'Ninguém te julga', desc: 'Um lugar só seu para colocar em palavras o que sente.' },
              { Icon: ShieldCheck, title: 'Você no controle', desc: 'Você decide o que registrar, quando e por quanto tempo manter.' },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="bg-paper-soft border border-line rounded-3xl p-5 text-center">
                <span className="w-11 h-11 rounded-full bg-mint flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-5 h-5 text-forest-600" />
                </span>
                <h3 className="font-medium text-forest-900">{title}</h3>
                <p className="text-sm text-ink-soft mt-1 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="bg-paper pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-forest-900 rounded-3xl px-6 py-12 text-center text-white">
            <h2 className="font-serif text-3xl md:text-4xl">Comece a se entender hoje</h2>
            <p className="mt-3 text-forest-100 max-w-lg mx-auto">
              Quando a cabeça está cheia, comece escrevendo. Pequenos passos, reais e possíveis, para dias difíceis.
            </p>
            <button
              onClick={() => onNavigate('diary')}
              className="mt-7 inline-flex items-center gap-2 bg-white text-forest-900 hover:bg-forest-50 font-medium text-sm px-7 py-3.5 rounded-2xl transition-colors"
            >
              Ir para meu diário
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Aviso de não substituição */}
          <p className="mt-8 text-center text-xs text-ink-soft max-w-2xl mx-auto leading-relaxed">
            Este serviço é uma ferramenta de apoio ao autoconhecimento e à organização emocional.
            Não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.
          </p>
        </div>
      </section>
    </>
  )
}
