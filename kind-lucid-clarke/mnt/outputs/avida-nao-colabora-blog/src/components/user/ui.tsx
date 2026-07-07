import { type ReactNode } from 'react'
import { ArrowRight, Lock, Leaf } from 'lucide-react'
import type { MoodOption } from './moods'

// ─── Humor / check-in ────────────────────────────────────────────────────────

export function MoodChip({
  mood, active, onClick,
}: { mood: MoodOption; active: boolean; onClick?: () => void }) {
  const { Icon, label, cls } = mood
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${
        active
          ? 'bg-forest-900 text-white border-forest-900'
          : `${cls} border-transparent hover:border-forest-200`
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </button>
  )
}

// ─── Cartão de seção genérico ────────────────────────────────────────────────

export function SectionCard({
  title, action, children, className = '',
}: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-paper-soft border border-line rounded-3xl p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && <h2 className="font-serif text-lg sm:text-xl text-forest-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// ─── Métrica (Mapa Emocional / Relatórios) ───────────────────────────────────

export function MetricCard({
  icon, label, value, sub, trend,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  sub?: string
  trend?: { dir: 'up' | 'down'; text: string; good?: boolean }
}) {
  return (
    <div className="bg-paper-soft border border-line rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0">{icon}</span>
        <p className="text-sm text-ink-soft">{label}</p>
      </div>
      <p className="font-serif text-2xl text-forest-900 leading-none">{value}</p>
      {trend && (
        <p className={`mt-2 text-xs flex items-center gap-1 ${trend.good === false ? 'text-coral' : 'text-forest-600'}`}>
          {trend.dir === 'up' ? '↗' : '↘'} {trend.text}
        </p>
      )}
      {sub && !trend && <p className="mt-1.5 text-xs text-ink-soft">{sub}</p>}
    </div>
  )
}

// ─── Estado vazio ────────────────────────────────────────────────────────────

export function EmptyState({
  icon, title, description, action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="text-center py-14 px-6">
      <div className="w-14 h-14 rounded-full bg-mint flex items-center justify-center mx-auto mb-4 text-forest-500">
        {icon ?? <Leaf className="w-6 h-6" />}
      </div>
      <p className="font-serif text-lg text-forest-900">{title}</p>
      {description && <p className="text-sm text-ink-soft mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 bg-forest-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-forest-800 transition-colors"
        >
          {action.label} <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// ─── Paywall / upgrade (bonito, alinhado à marca) ────────────────────────────

export function PaywallCard({
  requiredPlan = 'Plus', title, description, onUpgrade, compact = false,
}: {
  requiredPlan?: string
  title: string
  description?: string
  onUpgrade: () => void
  compact?: boolean
}) {
  return (
    <div className={`rounded-3xl border border-line bg-gradient-to-br from-mint/50 to-paper-soft text-center ${compact ? 'p-6' : 'p-8'}`}>
      <div className="w-12 h-12 rounded-full bg-white border border-line flex items-center justify-center mx-auto mb-4 text-forest-600">
        <Lock className="w-5 h-5" />
      </div>
      <h3 className="font-serif text-lg text-forest-900">{title}</h3>
      {description && <p className="text-sm text-ink-soft mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>}
      <button
        onClick={onUpgrade}
        className="mt-5 inline-flex items-center gap-2 bg-forest-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-forest-800 transition-colors"
      >
        Conhecer o {requiredPlan} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Card de apoio (orientação) ──────────────────────────────────────────────

export function SupportCard({ onClick, title = 'Precisa de apoio?', text = 'Nossa equipe está aqui para te ouvir.' }: {
  onClick: () => void
  title?: string
  text?: string
}) {
  return (
    <div className="rounded-3xl border border-line bg-mint/40 p-5">
      <p className="font-serif text-lg text-forest-900">{title}</p>
      <p className="text-sm text-ink-soft mt-1 leading-relaxed">{text}</p>
      <button
        onClick={onClick}
        className="mt-4 inline-flex items-center gap-2 bg-forest-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-forest-800 transition-colors"
      >
        Falar com orientação
      </button>
    </div>
  )
}

// ─── Frase acolhedora (banner / citação) ─────────────────────────────────────

export function QuoteBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-mint/40 px-5 sm:px-6 py-4 flex items-center gap-4">
      <span className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0 text-forest-500">
        <Leaf className="w-5 h-5" />
      </span>
      <p className="text-sm text-forest-800 leading-relaxed">{children}</p>
    </div>
  )
}
