import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { SEARCH_THRESHOLD, countRealPlans, filterPlans, groupPlansByYear, monthName, monthYearLabel, type CarePlanHistoryItem } from '../lib/carePlanHistory'

// Histórico do Plano de Autocuidado: em vez de uma lista única e longa, os ciclos ficam agrupados
// por ano (só o ano mais recente começa aberto), cada linha é compacta, o plano que a pessoa está
// vendo é destacado e, com muitos ciclos, há busca por mês ou palavra do foco.

interface Props {
  items: CarePlanHistoryItem[]
  currentId: string | null
  onOpen: (id: string) => void
  onClose: () => void
}

function Row({ item, current, label, onOpen }: { item: CarePlanHistoryItem; current: boolean; label: string; onOpen: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        aria-current={current ? 'true' : undefined}
        className={`group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${current ? 'border-forest-300 bg-mint/50' : 'border-line bg-white hover:bg-paper-soft'}`}
      >
        <span className="w-[4.75rem] shrink-0 text-sm font-semibold text-forest-900 sm:w-28">{label}</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${item.empty ? 'italic text-ink-soft' : 'text-forest-900'}`} title={item.title}>{item.title}</span>
        {current && <span className="shrink-0 rounded-full bg-forest-900 px-2 py-0.5 text-[10px] font-semibold text-white">Aberto</span>}
      </button>
    </li>
  )
}

export default function CarePlanHistory({ items, currentId, onOpen, onClose }: Props) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => groupPlansByYear(items), [items])
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const years = groupPlansByYear(items).map((g) => g.year)
    const currentYear = items.find((i) => i.id === currentId)?.month_reference.split('-')[0]
    return Object.fromEntries(years.map((y, index) => [y, index === 0 || y === currentYear]))
  })
  const searching = query.trim().length > 0
  const results = useMemo(() => (searching ? filterPlans(items, query) : []), [items, query, searching])
  const real = countRealPlans(items)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="care-history-title" className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-paper shadow-2xl">
        <div className="flex justify-between gap-4 px-6 pb-3 pt-6">
          <div>
            <h2 id="care-history-title" className="font-serif text-2xl text-forest-900">Histórico do Plano de Autocuidado</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Uma linha do tempo dos focos que acompanharam seus ciclos.{real > 0 && <> {real} {real === 1 ? 'plano' : 'planos'} até agora.</>}
            </p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="h-fit shrink-0 rounded-full p-1 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>

        {items.length > SEARCH_THRESHOLD && (
          <div className="px-6 pb-3">
            <label htmlFor="care-history-search" className="sr-only">Buscar no histórico</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="care-history-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por mês ou palavra do foco"
                className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-forest-900 outline-none focus:border-forest-400"
              />
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {searching ? (
            results.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-soft">Nenhum plano encontrado para "{query.trim()}".</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-ink-soft" aria-live="polite">{results.length} {results.length === 1 ? 'resultado' : 'resultados'}</p>
                <ul className="space-y-2">{results.map((item) => <Row key={item.id} item={item} current={item.id === currentId} label={monthYearLabel(item.month_reference)} onOpen={onOpen} />)}</ul>
              </>
            )
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const isOpen = open[group.year] ?? false
                const plans = countRealPlans(group.items)
                return (
                  <section key={group.year} className="rounded-2xl border border-line bg-paper-soft/60">
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [group.year]: !isOpen }))}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="font-serif text-lg text-forest-900">{group.year}</span>
                      <span className="flex items-center gap-2 text-xs text-ink-soft">
                        {plans} {plans === 1 ? 'plano' : 'planos'}
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {isOpen && <ul className="space-y-2 px-3 pb-3">{group.items.map((item) => <Row key={item.id} item={item} current={item.id === currentId} label={monthName(item.month_reference)} onOpen={onOpen} />)}</ul>}
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
