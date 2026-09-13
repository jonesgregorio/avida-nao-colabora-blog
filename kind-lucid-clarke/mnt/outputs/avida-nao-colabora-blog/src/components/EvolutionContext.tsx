import { BarChart3, Compass, History, LineChart, Sparkles } from 'lucide-react'
import EvolutionSectionNav from './EvolutionSectionNav'

interface Props {
  currentView: string
  onNavigate: (section: string) => void
}

const META: Record<string, { current: 'discoveries' | 'map' | 'reports' | 'history'; eyebrow: string; title: string; description: string; Icon: typeof Compass }> = {
  descobertas: {
    current: 'discoveries',
    eyebrow: 'Interpretar',
    title: 'O que está se repetindo?',
    description: 'Descobertas transforma repetições e conexões dos seus registros em sinais para observar — sem diagnosticar e sem substituir o seu próprio olhar.',
    Icon: Compass,
  },
  'my-evolution': {
    current: 'map',
    eyebrow: 'Visualizar',
    title: 'Como seus sinais mudam no tempo?',
    description: 'O Mapa é a superfície quantitativa: distribuições, períodos e comparações. Aqui os dados aparecem antes da narrativa.',
    Icon: LineChart,
  },
  'my-report': {
    current: 'reports',
    eyebrow: 'Sintetizar',
    title: 'Como foi este período?',
    description: 'Relatórios organizam um fechamento semanal ou mensal. Eles resumem um período; não substituem o Mapa nem a linha do tempo.',
    Icon: BarChart3,
  },
  'my-history': {
    current: 'history',
    eyebrow: 'Relembrar',
    title: 'Como sua trajetória foi se formando?',
    description: 'Minha História conecta marcos, capítulos e resumos ao longo do tempo para mostrar trajetória, não apenas números de um período.',
    Icon: History,
  },
}

export default function EvolutionContext({ currentView, onNavigate }: Props) {
  const meta = META[currentView]
  if (!meta) return null
  const { current, eyebrow, title, description, Icon } = meta
  const isHub = currentView === 'descobertas'

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7" aria-label="Sua evolução">
      <EvolutionSectionNav current={current} onNavigate={onNavigate} compact />
      {isHub ? (
        <div className="mt-5 grid gap-5 border-b border-line pb-7 sm:pb-9 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)] lg:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-forest-600"><Sparkles className="h-5 w-5" /><p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Sua evolução</p></div>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight text-forest-900">Entender sem transformar tudo em mais uma tarefa.</h1>
            <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-ink-soft">Comece por Descobertas para perceber repetições. Quando quiser números, abra o Mapa; para um fechamento, use Relatórios; para olhar a trajetória, vá para Minha História.</p>
          </div>
          <div className="rounded-3xl bg-forest-900 px-5 py-5 text-white">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/65">Quatro olhares, uma jornada</p>
            <p className="mt-2 font-serif text-2xl">Perceber → visualizar → sintetizar → lembrar.</p>
            <p className="mt-2 text-sm leading-relaxed text-white/75">Você não precisa abrir todas as áreas para acompanhar sua evolução.</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-3 border-b border-line pb-5 sm:pb-6">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-mint text-forest-700"><Icon className="h-4.5 w-4.5" /></span>
          <div className="max-w-3xl"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-600">{eyebrow}</p><p className="mt-0.5 font-serif text-xl text-forest-900">{title}</p><p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p></div>
        </div>
      )}
    </section>
  )
}
