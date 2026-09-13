import type { Profile } from '../types'
import { ArrowRight, BookOpen, Compass, Flower2, NotebookPen, Sprout } from 'lucide-react'
import { getEffectivePlan, hasPlanAccess } from '../lib/officialPlans'

interface Props {
  profile: Profile | null
  onNavigate: (section: string) => void
}

export default function TodayJourney({ profile, onNavigate }: Props) {
  const plan = getEffectivePlan(profile)
  const hasEvolution = hasPlanAccess(plan, 'essential')
  const hasCarePlan = hasPlanAccess(plan, 'plus')

  const nextSteps = [
    {
      id: 'diary',
      eyebrow: 'Registrar',
      title: 'Quero colocar o dia em palavras',
      description: 'Abra o Diário quando quiser ir além do check-in e registrar o que aconteceu no seu ritmo.',
      Icon: NotebookPen,
      action: 'Abrir Diário',
    },
    {
      id: hasEvolution ? 'descobertas' : 'pricing',
      eyebrow: 'Entender',
      title: hasEvolution ? 'Quero olhar o que está mudando' : 'Conheça sua evolução completa',
      description: hasEvolution
        ? 'Descobertas, Mapa, Relatórios e História ficam reunidos numa mesma jornada de compreensão.'
        : 'No Essencial, seus registros passam a alimentar Descobertas, Mapa e Relatórios semanais.',
      Icon: Compass,
      action: hasEvolution ? 'Ver minha evolução' : 'Conhecer Essencial',
    },
    {
      id: 'cuidar',
      eyebrow: 'Cuidar',
      title: 'Quero algo que me ajude agora',
      description: hasCarePlan
        ? 'Encontre seu plano, orientação, questionários e práticas sem precisar analisar mais nada.'
        : 'Encontre questionários, conteúdos e possibilidades de cuidado disponíveis para o seu plano.',
      Icon: Sprout,
      action: 'Ir para Cuidar',
    },
  ]

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8" aria-labelledby="today-next-heading">
      <div className="border-y border-line py-6 sm:py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-600">Seu próximo passo</p>
            <h2 id="today-next-heading" className="mt-1 font-serif text-2xl sm:text-3xl text-forest-900">O que faria mais sentido agora?</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-ink-soft">Você não precisa decidir entre todas as funcionalidades. Escolha apenas a intenção do momento.</p>
        </div>

        <div className="mt-5 divide-y divide-line border-y border-line">
          {nextSteps.map(({ id, eyebrow, title, description, Icon, action }) => (
            <button
              key={eyebrow}
              type="button"
              onClick={() => onNavigate(id)}
              className="group grid w-full gap-3 py-4 text-left sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center sm:py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mint text-forest-800"><Icon className="h-4.5 w-4.5" /></span>
              <span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-600">{eyebrow}</span>
                <span className="mt-0.5 block font-serif text-lg sm:text-xl text-forest-900">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{description}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 sm:justify-self-end">{action}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => onNavigate('my-garden')} className="flex items-center gap-3 rounded-2xl bg-sand-50 px-4 py-3.5 text-left hover:bg-sand-100 transition-colors">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-forest-700"><Flower2 className="h-4 w-4" /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold text-forest-900">Meu Jardim</span><span className="block text-xs text-ink-soft mt-0.5">Veja o espaço que seus cuidados estão cultivando.</span></span>
          </button>
          <button type="button" onClick={() => onNavigate('articles')} className="flex items-center gap-3 rounded-2xl bg-sand-50 px-4 py-3.5 text-left hover:bg-sand-100 transition-colors">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-forest-700"><BookOpen className="h-4 w-4" /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold text-forest-900">Conteúdos</span><span className="block text-xs text-ink-soft mt-0.5">Escolha entre leituras e práticas guiadas.</span></span>
          </button>
        </div>
      </div>
    </section>
  )
}
