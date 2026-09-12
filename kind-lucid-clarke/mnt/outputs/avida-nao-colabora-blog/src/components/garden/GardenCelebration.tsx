import { useEffect, useState } from 'react'
import { Leaf, X } from 'lucide-react'
import type { GardenTheme } from '../../lib/gardenThemes'

interface Props {
  theme: GardenTheme
  onViewHistory: () => void
  onClose: () => void
}

/**
 * Tela de celebração exibida uma única vez, no momento em que um jardim vira (garden_index
 * aumenta). Usa a imagem "completo" do jardim que acabou de amadurecer como pano de fundo.
 * Toda a coreografia é CSS puro (keyframes em <style> escopado neste componente, não Tailwind)
 * para não depender de nenhuma sintaxe de valor arbitrário do Tailwind nesta página.
 */
export default function GardenCelebration({ theme, onViewHistory, onClose }: Props) {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 gc-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Jardim concluído"
      onClick={onClose}
    >
      <style>{`
        @keyframes gcBackdropIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gcCardIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes gcSweep {
          0% { transform: translateX(-130%) skewX(-12deg); opacity: 0 }
          12% { opacity: .9 }
          88% { opacity: .9 }
          100% { transform: translateX(130%) skewX(-12deg); opacity: 0 }
        }
        @keyframes gcFadeScale { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: scale(1) } }
        @keyframes gcSlideFade { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes gcFadeSlow { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gcGlow {
          0%, 100% { text-shadow: 0 0 0 rgba(255,224,140,0) }
          50% { text-shadow: 0 0 20px rgba(255,224,140,.9), 0 0 6px rgba(255,224,140,.6) }
        }
        @keyframes gcLeaf {
          0% { opacity: 0; transform: translate(-30px, 8px) rotate(-10deg) scale(.85) }
          14% { opacity: .85 }
          82% { opacity: .8 }
          100% { opacity: 0; transform: translate(240px, -26px) rotate(20deg) scale(1) }
        }
        .gc-backdrop { animation: gcBackdropIn .4s ease-out both }
        .gc-card { animation: gcCardIn .5s ease-out both }
        .gc-sweep { animation: gcSweep 1.1s ease-in-out .25s 1 both }
        .gc-line1 { animation: gcFadeScale .9s cubic-bezier(.16,1,.3,1) 1.45s both }
        .gc-line2 { animation: gcSlideFade .65s ease-out 1.8s both }
        .gc-line3 { animation: gcFadeSlow 1.3s ease-out 2.35s both }
        .gc-line4 { animation: gcFadeSlow .7s ease-out 3.05s both, gcGlow 1.4s ease-in-out 3.75s 1 both }
        .gc-leaf1 { animation: gcLeaf 2.6s ease-in-out 4.2s 1 both }
        .gc-leaf2 { animation: gcLeaf 2.8s ease-in-out 4.6s 1 both }
        .gc-leaf3 { animation: gcLeaf 2.5s ease-in-out 5.05s 1 both }
        @media (prefers-reduced-motion: reduce) {
          .gc-backdrop, .gc-card, .gc-sweep, .gc-line1, .gc-line2, .gc-line3, .gc-line4, .gc-leaf1, .gc-leaf2, .gc-leaf3 { animation: none !important }
        }
      `}</style>

      <div
        className="gc-card relative w-full max-w-[560px] overflow-hidden rounded-[32px] shadow-[0_40px_120px_rgba(10,20,15,.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={theme.stages[3]} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/20" />
        {!reduced && (
          <div
            className="gc-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3"
            style={{ background: 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,246,214,.55) 45%, rgba(255,255,255,0) 100%)' }}
          />
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/30 text-white/80 backdrop-blur-sm transition hover:bg-black/45 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative z-[1] flex flex-col items-center gap-3 px-6 py-9 text-center text-white sm:gap-5 sm:px-12 sm:py-16">
          <p className={reduced ? 'text-[10px] font-semibold uppercase tracking-[.24em] text-white/70 sm:text-[11px] sm:tracking-[.28em]' : 'gc-line1 text-[10px] font-semibold uppercase tracking-[.24em] text-white/70 sm:text-[11px] sm:tracking-[.28em]'}>
            Jardim concluído
          </p>
          <div className="space-y-2 sm:space-y-3">
            <p className={reduced ? 'font-serif text-xl leading-[1.2] sm:text-[30px] sm:leading-[1.25]' : 'gc-line1 font-serif text-xl leading-[1.2] sm:text-[30px] sm:leading-[1.25]'}>
              Seu jardim floresceu por completo.
            </p>
            <p className={reduced ? 'font-serif text-base text-white/90 sm:text-lg' : 'gc-line2 font-serif text-base text-white/90 sm:text-lg'}>
              Você chegou aos 100%.
            </p>
            <p className={reduced ? 'mx-auto max-w-sm text-xs leading-5 text-white/75 sm:text-sm sm:leading-6' : 'gc-line3 mx-auto max-w-sm text-xs leading-5 text-white/75 sm:text-sm sm:leading-6'}>
              O que começou com pequenos cuidados agora ocupa todo esse espaço.
            </p>
            <p className={reduced ? 'font-serif text-base text-[#ffe08c] sm:text-lg' : 'gc-line4 font-serif text-base text-[#ffe08c] sm:text-lg'}>
              Parabéns por cultivar até aqui. 🌿
            </p>
          </div>

          <button
            type="button"
            onClick={onViewHistory}
            className={`${reduced ? '' : 'gc-line4'} mt-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-forest-900 shadow-lg transition hover:bg-white/90`}
          >
            Ver minha jornada
          </button>
        </div>

        {!reduced && (
          <>
            <Leaf className="gc-leaf1 pointer-events-none absolute left-10 top-1/3 h-4 w-4 text-[#cfe0c2]" />
            <Leaf className="gc-leaf2 pointer-events-none absolute left-6 top-1/2 h-3 w-3 text-[#e3d19a]" />
            <Leaf className="gc-leaf3 pointer-events-none absolute left-16 top-[60%] h-3.5 w-3.5 text-[#cfe0c2]" />
          </>
        )}
      </div>
    </div>
  )
}
