import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { gardenVisualProgress, type GardenTheme } from '../../lib/gardenThemes'

interface Props {
  theme: GardenTheme
  /** garden_progress (0..59) antes e agora. */
  from: number
  to: number
  onClose: () => void
}

type CompareMode = 'last' | 'initial'

/** Retorna a última mudança visual relevante do jardim. É o fallback quando a visita anterior
 * já foi sobrescrita pelo carregamento atual. Assim "Última atualização" nunca vira um botão
 * morto só porque o usuário recarregou/abriu a página novamente. */
function previousVisualUpdate(progress: number, stageCount: number): number {
  const breakpoints = stageCount === 6 ? [0, 3, 10, 18, 28, 39] : [0, 10, 28, 50]
  const current = Math.max(0, Math.min(59, progress))
  let previous = 0
  for (const point of breakpoints) {
    if (point >= current) break
    previous = point
  }
  return previous
}

/** Composição estática (sem canvas/motor) das fotos do jardim, na mesma mistura de opacidade
 * que a cena viva mostraria nesse ponto do progresso. */
function GardenSnapshot({ theme, progress, label }: { theme: GardenTheme; progress: number; label: string }) {
  const last = theme.stages.length - 1
  const f = gardenVisualProgress(progress, theme.stages.length === 6 ? 6 : 4) * last
  const opacities = [1, ...Array.from({ length: last }, (_, i) => Math.max(0, Math.min(1, f - i)))]
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#efe4d4]">
      {theme.stages.map((src, i) => (
        <img key={src} src={src} alt="" aria-hidden={i > 0 || undefined} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: opacities[i] }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-2.5 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-white">{label}</p>
      </div>
    </div>
  )
}

export default function GardenGrowthCompare({ theme, from, to, onClose }: Props) {
  const realPrevious = from > 0 && from < to ? from : null
  const fallbackPrevious = previousVisualUpdate(to, theme.stages.length)
  const lastUpdateProgress = realPrevious ?? fallbackPrevious
  const hasLastUpdateComparison = to > 0 && lastUpdateProgress < to
  const [mode, setMode] = useState<CompareMode>(hasLastUpdateComparison ? 'last' : 'initial')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const comparisonFrom = mode === 'initial' ? 0 : lastUpdateProgress
  const fromPct = Math.round((comparisonFrom / 59) * 100)
  const toPct = Math.round((to / 59) * 100)
  const firstLabel = mode === 'initial' ? 'Jardim inicial' : 'Última atualização'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Comparar crescimento do jardim" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-[28px] bg-[#fffaf3] p-6 shadow-[0_40px_120px_rgba(10,20,15,.35)] sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-600">{theme.label}</p>
            <h2 className="mt-1 font-serif text-2xl text-forest-950">Como seu jardim cresceu</h2>
            <p className="mt-1 text-xs leading-5 text-ink-soft">Compare a última mudança do jardim ou veja toda a transformação desde o início.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-forest-600 transition hover:bg-[#efe4d4]"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-[#efe9de] p-1" role="group" aria-label="Período da comparação">
          <button type="button" onClick={() => setMode('initial')} aria-pressed={mode === 'initial'} className={`rounded-xl px-3 py-2.5 text-xs font-medium transition ${mode === 'initial' ? 'bg-white text-forest-900 shadow-sm' : 'text-forest-600 hover:text-forest-900'}`}>Desde o início</button>
          <button type="button" onClick={() => setMode('last')} disabled={!hasLastUpdateComparison} aria-pressed={mode === 'last'} className={`rounded-xl px-3 py-2.5 text-xs font-medium transition ${mode === 'last' ? 'bg-white text-forest-900 shadow-sm' : 'text-forest-600 hover:text-forest-900'} disabled:cursor-not-allowed disabled:opacity-40`}>Última atualização</button>
        </div>
        {!hasLastUpdateComparison && <p className="mt-2 text-center text-[11px] leading-4 text-ink-soft">Este jardim ainda não teve uma mudança visual anterior para comparar.</p>}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <GardenSnapshot theme={theme} progress={comparisonFrom} label={firstLabel} />
          <GardenSnapshot theme={theme} progress={to} label="Agora" />
        </div>
        <p className="mt-4 text-center text-sm leading-6 text-ink-soft">
          {mode === 'initial' ? <>Desde o início, seu jardim passou de <strong className="text-forest-800">0%</strong> para <strong className="text-forest-800">{toPct}%</strong> deste ciclo.</> : <>Desde a última atualização, seu jardim passou de <strong className="text-forest-800">{fromPct}%</strong> para <strong className="text-forest-800">{toPct}%</strong> deste ciclo.</>}
        </p>
      </div>
    </div>
  )
}
