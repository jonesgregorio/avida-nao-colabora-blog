import type { Profile } from '../types'
import { BarChart3, Compass, History, LineChart, Lock, Sparkles } from 'lucide-react'
import { getEffectivePlan, hasPlanAccess } from '../lib/officialPlans'
import EvolutionSectionNav from './EvolutionSectionNav'

interface Props {
  profile: Profile | null
  onNavigate: (section: string) => void
}

export default function EvolutionHubPage({ profile, onNavigate }: Props) {
  const plan = getEffectivePlan(profile)
  const hasAnalytics = hasPlanAccess(plan, 'essential')

  const areas = [
    {
      id: 'descobertas',
      label: 'Descobertas',
      eyebrow: 'Interpretar',
      title: 'O que está se repetindo?',
      description: 'Padrões, conexões e sinais que ganharam contexto nos seus registros — sem transformar observação em diagnóstico.',
      Icon: Compass,
      locked: !hasAnalytics,
    },
    {
      id: 'my-evolution',
      label: 'Mapa Emocional',
      eyebrow: 'Visualizar',
      title: 'Como seus sinais mudam no tempo?',
      description: 'Calendários, distribuição de emoções e comparações entre períodos para olhar sua evolução de forma objetiva.',
      Icon: LineChart,
      locked: !hasAnalytics,
    },
    {
      id: 'my-report',
      label: 'Relatórios',
      eyebrow: 'Sintetizar',
      title: 'Como foi este período?',
      description: 'Fechamentos semanais e mensais que organizam o que mais marcou o período e ajudam a revisar o que mudou.',
      Icon: BarChart3,
      locked: !hasAnalytics,
    },
    {
      id: 'my-history',
      label: 'Minha História',
      eyebrow: 'Relembrar',
      title: 'Como sua trajetória foi se formando?',
      description: 'Uma linha do tempo com marcos, capítulos e resumos que conecta acontecimentos ao longo dos meses e anos.',
      Icon: History,
      locked: false,
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
      <EvolutionSectionNav current="hub" onNavigate={onNavigate} />

      <header className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,.75fr)] lg:items-end border-b border-line pb-7 sm:pb-9">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-forest-600">
            <Sparkles className="h-5 w-5" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Sua evolução</p>
          </div>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight text-forest-900">Entender sem transformar tudo em mais uma tarefa.</h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-ink-soft">
            Cada área responde a uma pergunta diferente. Comece pela que mais combina com o que você quer compreender agora.
          </p>
        </div>
        <div className="rounded-3xl bg-forest-900 px-5 py-5 text-white">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/65">A lógica é simples</p>
          <p className="mt-2 font-serif text-2xl">Perceber → visualizar → sintetizar → lembrar.</p>
          <p className="mt-2 text-sm leading-relaxed text-white/75">Os mesmos registros alimentam leituras diferentes. Você não precisa abrir tudo.</p>
        </div>
      </header>

      <section className="py-7 sm:py-9" aria-labelledby="evolution-areas-heading">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-600">Escolha o olhar</p>
            <h2 id="evolution-areas-heading" className="mt-1 font-serif text-2xl sm:text-3xl text-forest-900">Quatro formas de acompanhar você</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-ink-soft">Não são versões do mesmo relatório: cada superfície tem um papel específico na jornada.</p>
        </div>

        <div className="divide-y divide-line border-y border-line">
          {areas.map(({ id, label, eyebrow, title, description, Icon, locked }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(locked ? 'pricing' : id)}
              className="group grid w-full gap-4 py-5 text-left sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:items-center sm:py-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-forest-800 transition-transform group-hover:-translate-y-0.5">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-600">{eyebrow}</span>
                  <span className="text-xs text-ink-soft">{label}</span>
                  {locked && <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-ink-soft"><Lock className="h-3 w-3" /> Essencial</span>}
                </span>
                <span className="mt-1 block font-serif text-xl sm:text-2xl text-forest-900">{title}</span>
                <span className="mt-1.5 block max-w-3xl text-sm leading-relaxed text-ink-soft">{description}</span>
              </span>
              <span className="text-sm font-semibold text-forest-700 sm:justify-self-end">{locked ? 'Ver planos' : 'Abrir'} →</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
