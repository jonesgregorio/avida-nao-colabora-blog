export type EditorialAutomationType =
  | 'generate_daily'
  | 'generate_weekly_package'
  | 'generate_pauta'
  | 'monthly_pauta'

export interface EditorialAutomationConfig {
  quantity?: number
  themes?: string[]
  tone?: string
  extra?: string
}

export interface EditorialAutomationSpec {
  type: EditorialAutomationType
  label: string
  output: 'article' | 'article_package' | 'editorial_ideas' | 'monthly_editorial_plan'
  defaultQuantity: number
  minQuantity: number
  maxQuantity: number
}

export const EDITORIAL_AUTOMATION_SPECS: Record<EditorialAutomationType, EditorialAutomationSpec> = {
  generate_daily: {
    type: 'generate_daily',
    label: 'Gerar artigo com IA',
    output: 'article',
    defaultQuantity: 1,
    minQuantity: 1,
    maxQuantity: 1,
  },
  generate_weekly_package: {
    type: 'generate_weekly_package',
    label: 'Gerar pacote de artigos',
    output: 'article_package',
    defaultQuantity: 3,
    minQuantity: 2,
    maxQuantity: 4,
  },
  generate_pauta: {
    type: 'generate_pauta',
    label: 'Gerar pauta',
    output: 'editorial_ideas',
    defaultQuantity: 6,
    minQuantity: 3,
    maxQuantity: 10,
  },
  monthly_pauta: {
    type: 'monthly_pauta',
    label: 'Pauta mensal',
    output: 'monthly_editorial_plan',
    defaultQuantity: 12,
    minQuantity: 8,
    maxQuantity: 20,
  },
}

export const SUPPORTED_EDITORIAL_AUTOMATION_TYPES = Object.keys(EDITORIAL_AUTOMATION_SPECS) as EditorialAutomationType[]

export function isEditorialAutomationType(value: string): value is EditorialAutomationType {
  return value in EDITORIAL_AUTOMATION_SPECS
}

export function clampAutomationQuantity(type: EditorialAutomationType, raw: unknown): number {
  const spec = EDITORIAL_AUTOMATION_SPECS[type]
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(parsed)) return spec.defaultQuantity
  return Math.min(spec.maxQuantity, Math.max(spec.minQuantity, Math.round(parsed)))
}

export function plannedDateForIdea(type: EditorialAutomationType, index: number, total: number, now = new Date()): string {
  if (type === 'monthly_pauta') {
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth()
    const first = new Date(Date.UTC(year, month + 1, 1))
    const last = new Date(Date.UTC(year, month + 2, 0))
    const daysInMonth = last.getUTCDate()
    const day = Math.min(daysInMonth, 1 + Math.floor((index * Math.max(1, daysInMonth - 1)) / Math.max(1, total - 1)))
    return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const horizonDays = type === 'generate_pauta' ? 14 : 7
  const offset = Math.floor((index * Math.max(1, horizonDays - 1)) / Math.max(1, total - 1))
  base.setUTCDate(base.getUTCDate() + offset)
  return base.toISOString().slice(0, 10)
}
