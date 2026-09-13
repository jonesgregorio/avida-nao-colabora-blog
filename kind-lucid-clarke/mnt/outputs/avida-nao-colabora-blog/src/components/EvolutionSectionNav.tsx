import { BarChart3, Compass, History, LineChart } from 'lucide-react'

interface Props {
  current: 'discoveries' | 'map' | 'reports' | 'history'
  onNavigate: (section: string) => void
  compact?: boolean
}

const ITEMS = [
  { id: 'descobertas', key: 'discoveries', label: 'Descobertas', Icon: Compass },
  { id: 'my-evolution', key: 'map', label: 'Mapa', Icon: LineChart },
  { id: 'my-report', key: 'reports', label: 'Relatórios', Icon: BarChart3 },
  { id: 'my-history', key: 'history', label: 'História', Icon: History },
] as const

export default function EvolutionSectionNav({ current, onNavigate, compact = false }: Props) {
  return (
    <nav aria-label="Navegação da sua evolução" className={compact ? '' : 'mb-6 sm:mb-8'}>
      <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <div className="inline-flex min-w-max gap-1 rounded-2xl border border-line bg-white/80 p-1 shadow-sm">
          {ITEMS.map(({ id, key, label, Icon }) => {
            const active = current === key
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${active ? 'bg-forest-900 text-white shadow-sm' : 'text-ink-soft hover:bg-mint/50 hover:text-forest-900'}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
