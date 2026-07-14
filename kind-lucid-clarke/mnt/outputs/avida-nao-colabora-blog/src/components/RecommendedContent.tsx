import { useEffect, useState } from 'react'
import { Sparkles, Clock, ArrowRight, BookOpen, LifeBuoy, PenLine, Heart } from 'lucide-react'
import {
  fetchGuidedCatalog, fetchReadSlugsForRec, fetchUserSignal, scoreCatalog,
  logRecommendationsShown, RISK_HELP,
  type Signal, type CatalogItem, type ScoredContent,
} from '../lib/contentRecommendation'

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  essential: { label: 'Essencial', cls: 'bg-mint text-forest-700' },
  plus: { label: 'Plus', cls: 'bg-coral/60 text-[#7a3320]' },
}

interface Props {
  user?: { id: string } | null
  profile?: { plan?: string } | null
  /** Sinal já calculado (Mapa/Relatório/pós-save). Se ausente, é carregado do usuário. */
  signal?: Signal | null
  /** Catálogo já carregado (evita refetch). Se ausente, é buscado. */
  catalog?: CatalogItem[] | null
  source: string
  limit?: number
  title?: string
  description?: string
  variant?: 'grid' | 'compact'
  /** Mostra estados vazios com CTAs (padrão true na página; false em blocos discretos). */
  showEmpty?: boolean
  onOpen: (slug: string) => void
  onCheckin?: () => void
  onDiary?: () => void
  onSeeAll?: () => void
}

export default function RecommendedContent({
  user, profile, signal, catalog, source, limit = 3,
  title = 'Recomendados para você',
  description = 'Selecionados com base nos seus check-ins, diário e questionários recentes.',
  variant = 'grid', showEmpty = false, onOpen, onCheckin, onDiary, onSeeAll,
}: Props) {
  const [scored, setScored] = useState<ScoredContent[] | null>(null)
  const [risk, setRisk] = useState(false)
  const [hasData, setHasData] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const [cat, sig, read] = await Promise.all([
        catalog && catalog.length ? Promise.resolve(catalog) : fetchGuidedCatalog(),
        signal ? Promise.resolve(signal) : fetchUserSignal(user?.id),
        fetchReadSlugsForRec(user?.id),
      ])
      if (!active) return
      setHasData(sig.hasData)
      setRisk(sig.risk)
      if (sig.risk) { setScored([]); return }
      const recs = scoreCatalog(cat, sig, profile?.plan, { limit, readSlugs: read })
      setScored(recs)
      if (recs.length) void logRecommendationsShown(user?.id, source, recs)
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.plan, signal, catalog])

  // Linguagem de risco (§15): não tratar só com conteúdo — orientar ajuda.
  if (risk) {
    return (
      <section className="rounded-3xl border border-coral/50 bg-coral/10 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[#7a3320] mb-2">
          <LifeBuoy className="w-5 h-5" />
          <h2 className="font-serif text-lg sm:text-xl">{RISK_HELP.title}</h2>
        </div>
        <p className="text-sm text-ink leading-relaxed mb-3">{RISK_HELP.message}</p>
        <ul className="space-y-1.5 text-sm text-ink">
          <li className="flex gap-2"><Heart className="w-4 h-4 text-[#7a3320] flex-shrink-0 mt-0.5" /> {RISK_HELP.cvv}</li>
          <li className="flex gap-2"><Heart className="w-4 h-4 text-[#7a3320] flex-shrink-0 mt-0.5" /> {RISK_HELP.emergency}</li>
        </ul>
      </section>
    )
  }

  if (scored === null) {
    // Carregando — placeholder discreto (não polui blocos embutidos).
    return variant === 'grid'
      ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: limit }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-paper-soft border border-line animate-pulse" />)}
        </div>
      : null
  }

  if (scored.length === 0) {
    if (!showEmpty) return null
    // Sem dados suficientes vs. sem conteúdo compatível (§16).
    return (
      <div className="rounded-3xl border border-line bg-paper-soft p-6 text-center">
        {!hasData ? (
          <>
            <p className="font-medium text-forest-900 mb-1">Ainda não há registros suficientes para recomendações personalizadas.</p>
            <p className="text-sm text-ink-soft mb-4">Faça alguns check-ins ou registros no diário para receber sugestões alinhadas ao seu momento.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {onCheckin && <button onClick={onCheckin} className="inline-flex items-center gap-1.5 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"><PenLine className="w-4 h-4" /> Fazer check-in</button>}
              {onDiary && <button onClick={onDiary} className="inline-flex items-center gap-1.5 border border-line text-forest-900 text-sm font-medium px-4 py-2 rounded-xl hover:bg-mint/40 transition-colors"><BookOpen className="w-4 h-4" /> Registrar no diário</button>}
            </div>
          </>
        ) : (
          <>
            <p className="font-medium text-forest-900 mb-1">Ainda não encontramos conteúdos específicos para os temas mais recentes.</p>
            <p className="text-sm text-ink-soft mb-4">Você pode explorar todos os conteúdos guiados.</p>
            {onSeeAll && <button onClick={onSeeAll} className="text-sm text-forest-700 underline underline-offset-2">Ver todos os conteúdos</button>}
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      {title && (
        <h2 className={`font-serif ${variant === 'grid' ? 'text-xl sm:text-2xl' : 'text-lg'} text-forest-900 mb-1 flex items-center gap-2`}>
          <Sparkles className="w-5 h-5 text-forest-500" /> {title}
        </h2>
      )}
      {description && <p className="text-sm text-ink-soft mb-4">{description}</p>}
      <div className={variant === 'grid'
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
        : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
        {scored.map(s => <RecCard key={s.item.id} s={s} onOpen={onOpen} compact={variant === 'compact'} />)}
      </div>
    </div>
  )
}

function RecCard({ s, onOpen, compact }: { s: ScoredContent; onOpen: (slug: string) => void; compact?: boolean }) {
  const it = s.item
  const plan = it.plan_required && it.plan_required !== 'free' ? PLAN_BADGE[it.plan_required] : null
  const time = it.estimated_time_minutes ?? it.read_time ?? null
  return (
    <button
      onClick={() => it.slug && onOpen(it.slug)}
      className="group flex flex-col text-left bg-white border border-line rounded-2xl p-4 sm:p-5 hover:shadow-md hover:border-forest-200 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-medium text-forest-700 bg-mint px-2 py-0.5 rounded-full truncate max-w-[70%]">{it.category || 'Conteúdo'}</span>
        {plan
          ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${plan.cls}`}>{plan.label}</span>
          : time ? <span className="text-xs text-ink-soft flex items-center gap-1"><Clock size={12} /> {time} min</span> : null}
      </div>
      <h3 className={`font-serif ${compact ? 'text-base' : 'text-lg'} text-forest-900 leading-snug mb-1.5 line-clamp-2 group-hover:text-forest-700 transition-colors`}>
        {it.title}
      </h3>
      {!compact && it.summary && <p className="text-ink-soft text-sm leading-relaxed line-clamp-2 mb-3">{it.summary}</p>}
      {s.reason && (
        <p className="text-[13px] text-forest-700 bg-forest-50 border border-forest-100 rounded-xl px-3 py-2 mb-3 leading-snug">
          {s.reason}
        </p>
      )}
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 group-hover:gap-2 transition-all">
        Abrir conteúdo <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  )
}
