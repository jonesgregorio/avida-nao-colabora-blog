import { Leaf, Crown } from 'lucide-react'
import { normalizePlan, getPlanLabel } from '../lib/officialPlans'

interface PlanBadgeProps {
  plan: string | null | undefined
  /** Mostra o prefixo "Membro" (ex.: "Membro Plus"). */
  member?: boolean
  size?: 'sm' | 'md'
  className?: string
}

// Estilo suave por plano, alinhado à identidade (mint / sálvia / coral).
const STYLES: Record<'free' | 'essential' | 'plus', string> = {
  free: 'bg-mint text-forest-700',
  essential: 'bg-forest-100 text-forest-800',
  plus: 'bg-coral/60 text-[#8a3b23]',
}

/**
 * Selo de plano padronizado — sempre exibe Gratuito / Essencial / Plus
 * (nunca "Premium" / "Terapêutico"). Fonte única: normalizePlan + getPlanLabel.
 */
export default function PlanBadge({ plan, member = false, size = 'md', className = '' }: PlanBadgeProps) {
  const key = normalizePlan(plan)
  const label = getPlanLabel(plan)
  const Icon = key === 'plus' ? Crown : Leaf
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
  const iconSize = size === 'sm' ? 11 : 13

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${STYLES[key]} ${pad} ${className}`}
    >
      <Icon size={iconSize} className="flex-shrink-0" />
      {member ? `Membro ${label}` : label}
    </span>
  )
}
