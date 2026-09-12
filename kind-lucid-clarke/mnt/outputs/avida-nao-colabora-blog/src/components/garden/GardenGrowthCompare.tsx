import { useEffect } from 'react'
import { X } from 'lucide-react'
import { gardenVisualProgress, type GardenTheme } from '../../lib/gardenThemes'

interface Props {
  theme: GardenTheme
  /** garden_progress (0..59) antes e agora — funciona igual pra qualquer um dos 8 jardins,
   * porque só depende de theme.stages (sempre 4 fotos) e da mesma matemática de crossfade
   * que a cena viva usa (gardenVisualProgress). */
  from: number
  to: number
  onClose: () => void
}

/** Composição estática (sem canvas/motor) das 4 fotos do jardim, na mesma mistura de opacidade
 * que a cena viva mostraria nesse ponto do progresso — usada pra "congelar" um antes/depois. */
function GardenSnapshot({ theme, progress, label }: { theme: GardenTheme; progress: number; label: string }) {
  const f = gardenVisualProgress(progress) * 3
  const opacities = [1, Math.max(0, Math.min(1, f)), Math.max(0, Math.min(1, f - 1)), Math.max(0, Math.min(1, f - 2))]
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
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fromPct = Math.round((from / 59) * 100)
  const toPct = Math.round((to / 59) * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Comparar crescimento do jardim" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-[28px] bg-[#fffaf3] p-6 shadow-[0_40px_120px_rgba(10,20,15,.35)] sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-600">{theme.label}</p>
            <h2 className="mt-1 font-serif text-2xl text-forest-950">Como seu jardim cresceu</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-forest-600 transition hover:bg-[#efe4d4]"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <GardenSnapshot theme={theme} progress={from} label="Antes" />
          <GardenSnapshot theme={theme} progress={to} label="Agora" />
        </div>
        <p className="mt-4 text-center text-sm leading-6 text-ink-soft">Seu jardim foi de <strong className="text-forest-800">{fromPct}%</strong> para <strong className="text-forest-800">{toPct}%</strong> deste ciclo desde sua última visita.</p>
      </div>
    </div>
  )
}
