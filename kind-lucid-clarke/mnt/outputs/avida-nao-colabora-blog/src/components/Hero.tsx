import { useState } from 'react'
import {
  HeartPulse, CloudRain, BatteryLow, HelpCircle, Shield, Lock, Leaf, CheckCircle2,
  CalendarCheck, MessageSquare, BarChart3, Mail, BookOpen, PenLine, LineChart, ArrowRight,
} from 'lucide-react'
import HeroArt from './HeroArt'

interface HeroProps {
  onNavigate: (section: string) => void
}

/* ── Ícones customizados para bater com a imagem de referência ── */
// Ansioso — novelo/emaranhado (linhas sobrepostas)
function TangleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" className={className}>
      <ellipse cx="12" cy="12" rx="8" ry="4.6" transform="rotate(22 12 12)" />
      <ellipse cx="12" cy="12" rx="8" ry="4.6" transform="rotate(75 12 12)" />
      <ellipse cx="12" cy="12" rx="8" ry="4.6" transform="rotate(128 12 12)" />
      <ellipse cx="12" cy="12" rx="6.4" ry="3.6" transform="rotate(50 12 12)" />
    </svg>
  )
}
// Sobrecarregado — pedras empilhadas (cairn)
function StonesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" className={className}>
      <ellipse cx="12" cy="18" rx="7" ry="2.9" />
      <ellipse cx="12" cy="12" rx="5.4" ry="2.5" />
      <ellipse cx="12" cy="6.4" rx="3.9" ry="2.1" />
    </svg>
  )
}

// Rótulos neutros (substantivos) — sem marcação de gênero.
const MOODS = [
  { id: 'ansioso', label: 'Ansiedade', Icon: TangleIcon, color: 'text-forest-600' },
  { id: 'triste', label: 'Tristeza', Icon: CloudRain, color: 'text-[#3d6ea5]' },
  { id: 'sobrecarregado', label: 'Sobrecarga', Icon: StonesIcon, color: 'text-[#c05f3c]' },
  { id: 'sem-energia', label: 'Sem energia', Icon: BatteryLow, color: 'text-stone-400' },
  { id: 'confuso', label: 'Confusão', Icon: HelpCircle, color: 'text-[#7c5cbf]' },
]

// Mapeia o humor do Hero para a chave de chip do diário, para pré-selecionar após o login (§8.6).
const HERO_MOOD_TO_CHIP: Record<string, string> = {
  ansioso: 'ansiosa', triste: 'outro', sobrecarregado: 'sobrecarregada', 'sem-energia': 'cansada', confuso: 'outro',
}

const PLUS_ITEMS = [
  { Icon: CalendarCheck, bg: 'bg-mint', color: 'text-forest-600', title: 'Plano de autocuidado', desc: 'Crie um plano personalizado de ações práticas para sua rotina, sono, limites e ansiedade.' },
  { Icon: MessageSquare, bg: 'bg-sky', color: 'text-[#3d6ea5]', title: 'Comentário profissional', desc: 'Receba um olhar profissional sobre seus registros uma vez por mês.' },
  { Icon: BarChart3, bg: 'bg-lilac', color: 'text-[#7c5cbf]', title: 'Relatório mensal', desc: 'Veja padrões, percepções e insights sobre o seu bem-estar emocional.' },
  { Icon: Mail, bg: 'bg-coral', color: 'text-[#c05f3c]', title: 'Orientação por mensagem', desc: 'Tire dúvidas e receba orientação por mensagem durante o mês.' },
]

const PATHS = [
  { Icon: BookOpen, bg: 'bg-mint', color: 'text-forest-600', cardBg: 'bg-[#f1f6f2]', title: 'Ler um conteúdo guiado', desc: 'Artigos e reflexões com carinho para acolher, informar e inspirar você.', cta: 'Explorar conteúdos', to: 'articles' },
  { Icon: PenLine, bg: 'bg-sky', color: 'text-[#3d6ea5]', cardBg: 'bg-[#eff5fb]', title: 'Escrever no diário', desc: 'Um espaço seguro para colocar em palavras o que você sente.', cta: 'Ir para meu diário', to: 'diary' },
  { Icon: LineChart, bg: 'bg-coral', color: 'text-[#c05f3c]', cardBg: 'bg-[#fdf2ee]', title: 'Ver meu mapa emocional', desc: 'Acompanhe seus padrões, emoções e progressos ao longo do tempo.', cta: 'Ver meu mapa', to: 'my-evolution' },
]

function PlusTag() {
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-coral text-[#b0532f] align-middle">Plus</span>
}

export default function Hero({ onNavigate }: HeroProps) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null)

  return (
    <section id="home" className="bg-paper">
      {/* ── Hero ── */}
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-10 md:pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Coluna esquerda — texto + still-life */}
          <div className="lg:col-span-4 lg:pt-6">
            <h1 className="font-serif text-4xl md:text-5xl leading-[1.08] text-forest-900">
              Um lugar para se organizar por dentro nos dias difíceis
            </h1>
            <p className="mt-5 text-ink-soft leading-relaxed max-w-md">
              Escreva o que pesa, entenda seus padrões e encontre pequenos passos possíveis
              para cuidar de você.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onNavigate('diary')}
                className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white font-medium text-sm px-6 py-3.5 rounded-2xl transition-colors shadow-sm"
              >
                <Leaf className="w-4 h-4" />
                Começar grátis
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('diary')}
                className="inline-flex items-center gap-2 text-forest-800 font-medium text-sm px-2 py-3.5 hover:text-forest-900 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Fazer check-in
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-soft">
              <Lock className="w-3.5 h-3.5" />
              Seus dados são privados e protegidos.
            </p>

            {/* still-life (planta + xícara + livros) — sangra pela esquerda */}
            <div className="mt-6 -ml-6 sm:-ml-10 max-w-[250px] sm:max-w-[340px] pointer-events-none select-none">
              <HeroArt className="w-full h-auto" />
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
                Escolha como se sente agora. Isso nos ajuda a sugerir conteúdos que fazem sentido para você.
              </p>

              <div className="mt-6 grid grid-cols-5 gap-1.5 sm:gap-3">
                {MOODS.map(({ id, label, Icon, color }) => {
                  const active = selectedMood === id
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedMood(active ? null : id)}
                      aria-pressed={active}
                      className={`flex flex-col items-center gap-2 sm:gap-3 rounded-lg px-1 py-3.5 sm:px-2 sm:py-5 transition-all ${
                        active
                          ? 'border border-forest-600 ring-2 ring-forest-600/25 bg-mint/50'
                          : 'border border-line bg-white hover:border-forest-400 hover:shadow-sm'
                      }`}
                    >
                      <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${color}`} />
                      <span className="text-[10px] sm:text-[11px] text-ink text-center leading-tight">{label}</span>
                    </button>
                  )
                })}
              </div>

              {selectedMood ? (
                <button
                  onClick={() => onNavigate(`diary?mood=${HERO_MOOD_TO_CHIP[selectedMood] ?? 'outro'}`)}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium py-3 rounded-2xl transition-colors"
                >
                  Continuar para o diário
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
                  <Shield className="w-3.5 h-3.5" />
                  Um check-in rápido para começar sem julgamento.
                </p>
              )}
            </div>
          </div>

          {/* Coluna direita — Recursos Plus */}
          <div className="lg:col-span-3">
            <div className="bg-paper-soft border border-line rounded-3xl p-6 shadow-sm h-full">
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-xl text-forest-900">Recursos Plus</h3>
                <PlusTag />
              </div>
              <p className="mt-1.5 text-sm text-ink-soft">Apoio extra para transformar percepção em próximos passos.</p>

              <div className="mt-4">
                {PLUS_ITEMS.map(({ Icon, bg, color, title, desc }, i) => (
                  <div key={title} className={`flex gap-3 py-3.5 ${i < PLUS_ITEMS.length - 1 ? 'border-b border-line' : ''}`}>
                    <span className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-forest-900">{title}</p>
                      <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => onNavigate('pricing')}
                className="mt-5 pt-4 border-t border-line w-full inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900 transition-colors"
              >
                Saiba mais sobre o Plus
                <ArrowRight className="w-4 h-4" />
              </button>
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
          {PATHS.map(({ Icon, bg, color, cardBg, title, desc, cta, to }) => (
            <button
              key={title}
              onClick={() => onNavigate(to)}
              className={`text-left ${cardBg} border border-line rounded-3xl p-6 hover:shadow-md hover:border-forest-200 transition-all group flex flex-col`}
            >
              <span className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </span>
              <h3 className="font-serif text-lg text-forest-800">{title}</h3>
              <p className="mt-2 text-sm text-ink-soft leading-relaxed flex-1">{desc}</p>
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
