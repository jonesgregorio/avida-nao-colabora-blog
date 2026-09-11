import { useEffect, useRef } from 'react'
import { GARDEN_STAGE_NAMES, type GardenTheme } from '../../lib/gardenThemes'
import { startGardenEngine } from '../../lib/livingGardenEngine'

interface Props {
  theme: GardenTheme
  /** 0..1 — posição contínua dentro do ciclo do jardim atual (ver gardenVisualProgress). */
  progress: number
  className?: string
}

function stageNameFor(progress: number): string {
  const index = Math.round(Math.max(0, Math.min(3, progress * 3)))
  return GARDEN_STAGE_NAMES[index]
}

/**
 * A imagem foto-realista do jardim (4 estágios em cross-fade) com a camada de movimento —
 * água, fauna, luz e clima — por cima. Uma única engine (livingGardenEngine.ts) serve os 8
 * jardins; só a configuração muda.
 */
export default function LivingGarden({ theme, progress, className }: Props) {
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const imgRefs = useRef<(HTMLImageElement | null)[]>([null, null, null, null])
  const waterRef = useRef<HTMLCanvasElement | null>(null)
  const airRef = useRef<HTMLCanvasElement | null>(null)
  const progressRef = useRef(progress)
  progressRef.current = progress
  const reducedRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedRef.current = mq.matches
    const onChange = (e: MediaQueryListEvent) => { reducedRef.current = e.matches }
    mq.addEventListener?.('change', onChange)

    const scene = sceneRef.current
    const water = waterRef.current
    const air = airRef.current
    const images = imgRefs.current.filter((el): el is HTMLImageElement => el != null)
    if (!scene || !water || !air || images.length !== 4) return undefined

    const destroy = startGardenEngine(
      { scene, images, water, air },
      theme,
      () => progressRef.current,
      () => reducedRef.current,
    )
    return () => {
      destroy()
      mq.removeEventListener?.('change', onChange)
    }
    // a engine é reiniciada quando o jardim muda; o progresso é lido via ref a cada quadro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.slug])

  return (
    <div ref={sceneRef} className={className ?? 'absolute inset-0 overflow-hidden'}>
      {theme.stages.map((src, i) => (
        <img
          key={src}
          ref={(el) => { imgRefs.current[i] = el }}
          src={src}
          alt={i === 0 ? `${theme.label} — jardim ${stageNameFor(progress)}` : ''}
          aria-hidden={i === 0 ? undefined : true}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: i === 0 ? 1 : 0, willChange: 'opacity, transform' }}
        />
      ))}
      <canvas ref={waterRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <canvas ref={airRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  )
}
