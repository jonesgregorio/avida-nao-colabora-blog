import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { gardenVisualProgress, type GardenTheme } from '../../lib/gardenThemes'

interface Props {
  theme: GardenTheme
  /** garden_progress (0..59) antes e agora — funciona igual pra qualquer jardim, porque só
   * depende de theme.stages (4 ou 6 fotos) e da mesma matemática de crossfade que a cena viva
   * usa (gardenVisualProgress). */
  from: number
  to: number
  onClose: () => void
}

type CompareMode = 'last' | 'initial'

/** Composição estática (sem canvas/motor) das fotos do jardim, na mesma mistura de opacidade
 * que a cena viva mostraria nesse ponto do progresso — usada pra "congelar" um antes/depois. */
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
  // Quando existe uma visita anterior real, abrimos nela para preservar o comportamento atual.
  // O usuário pode alternar a qualquer momento para o começo do jardim e enxergar toda a mudança.
  const hasLastVisitComparison = from > 0 && from < to
  const [mode, setMode] = useState<CompareMode>(hasLastVisitComparison ? 'last' : 'initial')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const comparisonFrom = mode === 'initial' ? 0 : from
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
            <p className="mt-1 text-xs leading-5 text-ink-soft">Compare a mudança mais recente ou veja toda a transformação desde quando este jardim começou.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-forest-600 transition hover:bg-[#efe4d4]"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-[#efe9de] p-1" role="group" aria-label="Período da comparação">
          <button type="button" onClick={() => setMode('initial')} aria-pressed={mode === 'initial'} className={`rounded-xl px-3 py-2.5 text-xs font-medium transition ${mode === 'initial' ? 'bg-white text-forest-900 shadow-sm' : 'text-forest-600 hover:text-forest-900'}`}>Desde o início</button>
          <button type="button" onClick={() => setMode('last')} disabled={!hasLastVisitComparison} aria-pressed={mode === 'last'} className={`rounded-xl px-3 py-2.5 text-xs font-medium transition ${mode === 'last' ? 'bg-white text-forest-900 shadow-sm' : 'text-forest-600 hover:text-forest-900'} disabled:cursor-not-allowed disabled:opacity-40`}>Última atualização</button>
        </div>
        {!hasLastVisitComparison && <p className="mt-2 text-center text-[11px] leading-4 text-ink-soft">Quando houver uma atualização anterior deste mesmo jardim, ela também ficará disponível para comparação.</p>}

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
