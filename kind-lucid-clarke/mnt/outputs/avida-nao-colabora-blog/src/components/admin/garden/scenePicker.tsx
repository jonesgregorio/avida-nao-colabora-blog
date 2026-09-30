import { useEffect, useState } from 'react'
import type { Point } from '../../../lib/gardenThemes'
import type { SceneConfig } from '../../../lib/gardenSceneConfig'
import { TOOL_HELP, toolMode, type PickTool, type PickValue } from './sceneTools'

// Um único quadro (a imagem final do jardim) onde o administrador marca, com cliques, onde ficam
// o sol, a água, as luzes, as zonas de queda etc. Tudo em coordenadas 0..1 do quadro, igual à
// engine. O quadro mostra por cima tudo que já foi marcado.

interface Props {
  image: string
  scene: SceneConfig
  tool: PickTool | null
  onPick: (tool: PickTool, value: PickValue) => void
  onCancel: () => void
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`
const round = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000

export default function ScenePicker({ image, scene, tool, onPick, onCancel }: Props) {
  const [pending, setPending] = useState<Point[]>([])
  useEffect(() => { setPending([]) }, [tool])

  const mode = tool ? toolMode(tool) : null

  function click(e: React.MouseEvent<HTMLDivElement>) {
    if (!tool || !mode) return
    const box = e.currentTarget.getBoundingClientRect()
    const p: Point = [round((e.clientX - box.left) / box.width), round((e.clientY - box.top) / box.height)]
    if (mode === 'point') { onPick(tool, p); return }
    if (mode === 'rect' || mode === 'line') {
      if (pending.length === 0) { setPending([p]); return }
      const [a] = pending
      onPick(tool, [a[0], a[1], p[0], p[1]])
      setPending([])
      return
    }
    setPending((list) => [...list, p])
  }

  function finish() {
    if (!tool) return
    if (mode === 'poly' && pending.length < 3) return
    if ((mode === 'poly' || mode === 'points') && pending.length) onPick(tool, pending)
    setPending([])
    onCancel()
  }

  const water = scene.water
  const dot = (p: Point, color: string, key: string, size = 10) => (
    <span key={key} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
      style={{ left: pct(p[0]), top: pct(p[1]), width: size, height: size, background: color }} />
  )
  const box = (r: [number, number, number, number], color: string, key: string) => (
    <span key={key} className="pointer-events-none absolute"
      style={{ left: pct(Math.min(r[0], r[2])), top: pct(Math.min(r[1], r[3])), width: pct(Math.abs(r[2] - r[0])), height: pct(Math.abs(r[3] - r[1])), border: `2px dashed ${color}`, background: `${color}22` }} />
  )

  return (
    <div className="space-y-2">
      {tool && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>{TOOL_HELP[tool.kind]}{pending.length > 0 && ` (${pending.length} marcado${pending.length > 1 ? 's' : ''})`}</span>
          <span className="flex gap-2">
            {(mode === 'poly' || mode === 'points') && <button type="button" className="rounded-lg bg-forest-900 px-3 py-1 font-semibold text-white" onClick={finish}>Concluir</button>}
            {pending.length > 0 && <button type="button" className="rounded-lg border border-amber-400 px-3 py-1" onClick={() => setPending((l) => l.slice(0, -1))}>Desfazer ponto</button>}
            <button type="button" className="rounded-lg border border-amber-400 px-3 py-1" onClick={() => { setPending([]); onCancel() }}>Cancelar</button>
          </span>
        </div>
      )}
      <div
        onClick={click}
        role="presentation"
        className={`relative w-full overflow-hidden rounded-2xl border border-line bg-stone-100 ${tool ? 'cursor-crosshair ring-2 ring-amber-400' : ''}`}
        style={{ aspectRatio: '1672 / 941' }}
      >
        {image
          ? <img src={image} alt="Jardim completo para posicionar a cena" className="absolute inset-0 h-full w-full select-none object-cover" draggable={false} />
          : <div className="absolute inset-0 grid place-items-center text-xs text-ink-soft">Envie a imagem do estágio final para posicionar a cena.</div>}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
          {water.poly && <polygon points={water.poly.map((p) => `${p[0]},${p[1]}`).join(' ')} fill="rgba(80,160,220,.25)" stroke="#2f7fc0" strokeWidth="0.004" />}
          {pending.length > 1 && <polyline points={pending.map((p) => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke="#d97706" strokeWidth="0.004" />}
          {water.kind === 'basin' && water.center && <ellipse cx={water.center[0]} cy={water.center[1]} rx={water.rx ?? 0} ry={water.ry ?? 0} fill="rgba(80,160,220,.25)" stroke="#2f7fc0" strokeWidth="0.004" />}
          {scene.waterfall && <rect x={scene.waterfall.x0} y={scene.waterfall.top} width={scene.waterfall.x1 - scene.waterfall.x0} height={scene.waterfall.bottom - scene.waterfall.top} fill="rgba(120,200,255,.25)" stroke="#2f7fc0" strokeWidth="0.004" strokeDasharray="0.01" />}
          {scene.ducks?.map((d, i) => <line key={i} x1={d.path[0]} y1={d.path[1]} x2={d.path[2]} y2={d.path[3]} stroke="#7c3aed" strokeWidth="0.004" />)}
          {water.thread && <line x1={water.thread[0]} y1={water.thread[1]} x2={water.thread[2]} y2={water.thread[3]} stroke="#2f7fc0" strokeWidth="0.004" />}
        </svg>
        {scene.fall.emitters.map((em, i) => box(em.zone, '#16a34a', `fall${i}`))}
        {scene.flyers.hbZone && box(scene.flyers.hbZone, '#db2777', 'hb')}
        {scene.dust && box(scene.dust.zone, '#a16207', 'dust')}
        {scene.light.glow.map((g, i) => dot([g[0], g[1]], '#f59e0b', `glow${i}`, 12))}
        {dot(scene.light.sun, '#facc15', 'sun', 16)}
        {water.ripFrom && dot(water.ripFrom, '#2f7fc0', 'rip')}
        {scene.waterfall?.land && dot(scene.waterfall.land, '#2f7fc0', 'land')}
        {scene.hawk && dot(scene.hawk.center, '#7c2d12', 'hawk')}
        {scene.owl && dot(scene.owl, '#57534e', 'owl')}
        {scene.smoke && dot(scene.smoke, '#9ca3af', 'smoke')}
        {scene.stars?.map((s, i) => dot([s[0], s[1]], '#ffffff', `star${i}`, 6))}
        {pending.map((p, i) => dot(p, '#d97706', `pend${i}`, 10))}
      </div>
    </div>
  )
}
