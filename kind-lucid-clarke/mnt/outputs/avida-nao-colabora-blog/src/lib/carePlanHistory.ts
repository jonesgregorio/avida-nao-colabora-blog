// Histórico do Plano de Autocuidado: organização por ano e busca. Funções puras, sem rede.

export interface CarePlanHistoryItem {
  id: string
  /** AAAA-MM */
  month_reference: string
  /** Foco do plano, ou "Ciclo sem plano gerado". */
  title: string
  /** true quando o ciclo não gerou plano (não há o que abrir de verdade). */
  empty: boolean
}

export interface CarePlanYearGroup {
  year: string
  items: CarePlanHistoryItem[]
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function monthOf(reference: string): number {
  const m = Number(reference.split('-')[1])
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : 0
}

/** "Setembro" (só o mês; o ano vem do agrupamento). */
export function monthName(reference: string): string {
  const m = monthOf(reference)
  if (!m) return reference
  return MONTHS[m - 1].charAt(0).toUpperCase() + MONTHS[m - 1].slice(1)
}

/** "Setembro de 2026". */
export function monthYearLabel(reference: string): string {
  const year = reference.split('-')[0]
  return `${monthName(reference)} de ${year}`
}

function sortDesc(a: CarePlanHistoryItem, b: CarePlanHistoryItem): number {
  return b.month_reference.localeCompare(a.month_reference)
}

/** Agrupa por ano, do mais recente ao mais antigo, com os meses também do mais recente ao mais antigo. */
export function groupPlansByYear(items: CarePlanHistoryItem[]): CarePlanYearGroup[] {
  const byYear = new Map<string, CarePlanHistoryItem[]>()
  for (const item of [...items].sort(sortDesc)) {
    const year = item.month_reference.split('-')[0] || 'Sem data'
    byYear.set(year, [...(byYear.get(year) ?? []), item])
  }
  return [...byYear.entries()].map(([year, list]) => ({ year, items: list })).sort((a, b) => b.year.localeCompare(a.year))
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Busca por mês (nome ou número), ano ou palavras do foco; ignora acentos e maiúsculas. */
export function filterPlans(items: CarePlanHistoryItem[], query: string): CarePlanHistoryItem[] {
  const q = normalize(query)
  if (!q) return [...items].sort(sortDesc)
  const terms = q.split(/\s+/)
  return items
    .filter((item) => {
      const haystack = normalize(`${monthYearLabel(item.month_reference)} ${item.month_reference} ${item.title}`)
      return terms.every((term) => haystack.includes(term))
    })
    .sort(sortDesc)
}

/** Quantos planos de verdade (não vazios) existem, para o resumo do histórico. */
export function countRealPlans(items: CarePlanHistoryItem[]): number {
  return items.filter((item) => !item.empty).length
}

/** A busca só vale a pena a partir de certo tamanho. */
export const SEARCH_THRESHOLD = 6
