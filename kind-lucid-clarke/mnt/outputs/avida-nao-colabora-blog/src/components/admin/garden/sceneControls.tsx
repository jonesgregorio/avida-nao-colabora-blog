import { useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { FallEmitter } from '../../../lib/gardenThemes'
import { FALL_KINDS, sanitizeSceneConfig, type SceneConfig } from '../../../lib/gardenSceneConfig'
import type { PickTool } from './sceneTools'

// Painel de controles da cena viva. Cada recurso é exatamente um dos que a engine já desenha nos
// jardins do código (água, queda, fauna, luz, cachoeira, névoa, patos, calor, poeira, gavião,
// estrelas, coruja, fumaça e aurora). Nada aqui inventa comportamento novo.

interface Props {
  scene: SceneConfig
  setScene: (next: SceneConfig) => void
  pick: (tool: PickTool) => void
}

const FALL_LABEL: Record<FallEmitter['kind'], string> = {
  petal: 'Pétalas', olive: 'Folhas de oliveira', snow: 'Neve', maple: 'Folhas de bordo', ginkgo: 'Folhas de ginkgo',
}

function Slider({ label, value, min, max, step = 1, onChange, hint }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="block text-xs text-ink-soft">
      <span className="flex justify-between"><span>{label}</span><span className="font-semibold text-forest-800">{Number.isInteger(step) ? value : value.toFixed(3)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-forest-700" />
      {hint && <span className="block text-[10px] opacity-80">{hint}</span>}
    </label>
  )
}

function Hex({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-ink-soft">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-line bg-white p-0.5" />
    </label>
  )
}

function Section({ title, hint, children, defaultOpen = false }: { title: string; hint?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-2xl border border-line bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left" aria-expanded={open}>
        <span><span className="block font-serif text-lg text-forest-900">{title}</span>{hint && <span className="block text-[11px] text-ink-soft">{hint}</span>}</span>
        <span className="text-xs text-ink-soft">{open ? 'Fechar' : 'Abrir'}</span>
      </button>
      {open && <div className="space-y-3 border-t border-line px-4 py-4">{children}</div>}
    </section>
  )
}

const PickBtn = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="rounded-lg border border-forest-300 bg-mint px-3 py-1.5 text-xs font-medium text-forest-800 hover:bg-forest-100">{children}</button>
)

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
function rgbToHex(rgb: string): string {
  const [r, g, b] = rgb.split(',').map((v) => Math.min(255, Math.max(0, Number(v) || 0)))
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export default function SceneControls({ scene, setScene, pick }: Props) {
  // toda alteração passa pelo mesmo saneador que o site usa ao exibir: o que o admin vê aqui é o que o usuário recebe.
  const commit = (next: SceneConfig) => setScene(sanitizeSceneConfig(next))
  const patch = (partial: Partial<SceneConfig>) => commit({ ...scene, ...partial })
  const w = scene.water
  const hasWater = w.kind === 'pond' ? Boolean(w.poly?.length) : (w.rx ?? 0) > 0.001
  const waterMode: 'none' | 'basin' | 'pond' = !hasWater ? 'none' : w.kind

  function setWaterMode(mode: 'none' | 'basin' | 'pond') {
    if (mode === 'none') { commit({ ...scene, water: { kind: 'basin', center: [0.5, 0.97], rx: 0.0005, ry: 0.0005, tint: w.tint }, koi: undefined }); return }
    if (mode === 'basin') { commit({ ...scene, water: { kind: 'basin', center: w.center ?? [0.5, 0.85], rx: w.rx && w.rx > 0.001 ? w.rx : 0.1, ry: w.ry && w.ry > 0.001 ? w.ry : 0.04, tint: w.tint === '#000000' ? '#3d5a52' : w.tint, reflect: w.reflect, drip: w.drip }, koi: undefined }); return }
    commit({ ...scene, water: { kind: 'pond', poly: w.poly?.length ? w.poly : [[0.3, 0.75], [0.7, 0.72], [0.9, 0.85], [0.4, 0.95]], tint: w.tint === '#000000' ? '#3d5a52' : w.tint, reflect: w.reflect, drip: w.drip } })
  }

  const setEmitter = (i: number, partial: Partial<FallEmitter>) =>
    patch({ fall: { ...scene.fall, emitters: scene.fall.emitters.map((e, idx) => (idx === i ? { ...e, ...partial } : e)) } })

  const flyerCount = (key: 'butterflies' | 'bees' | 'dragonflies' | 'fireflies' | 'hummingbirds', label: string, max: number) => (
    <Slider key={key} label={label} value={scene.flyers[key] ?? 0} min={0} max={max} onChange={(v) => patch({ flyers: { ...scene.flyers, [key]: v } })} />
  )

  return (
    <div className="space-y-3">
      <Section title="Luz" hint="Sol ou lua, raios de luz e pontos que brilham (lanternas, janelas, fogo)." defaultOpen>
        <div className="flex flex-wrap items-center gap-3">
          <PickBtn onClick={() => pick({ kind: 'sun' })}>Marcar sol/lua na imagem</PickBtn>
          <Hex label="Cor dos raios" value={scene.light.ray} onChange={(v) => patch({ light: { ...scene.light, ray: v } })} />
        </div>
        <Slider label="Intensidade dos raios" value={scene.light.rayAmt} min={0} max={0.4} step={0.01} hint="0 = sem raios (bom para noite)." onChange={(v) => patch({ light: { ...scene.light, rayAmt: v } })} />
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold text-forest-800">Pontos que brilham ({scene.light.glow.length}/8)</p><PickBtn onClick={() => pick({ kind: 'glow' })}>Marcar na imagem</PickBtn></div>
          {scene.light.glow.map((g, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-line p-2">
              <Hex value={rgbToHex(g[3])} onChange={(v) => patch({ light: { ...scene.light, glow: scene.light.glow.map((x, idx) => (idx === i ? [x[0], x[1], x[2], hexToRgb(v)] : x)) } })} />
              <div className="flex-1"><Slider label="Raio" value={g[2]} min={4} max={80} onChange={(v) => patch({ light: { ...scene.light, glow: scene.light.glow.map((x, idx) => (idx === i ? [x[0], x[1], v, x[3]] : x)) } })} /></div>
              <button type="button" aria-label="Remover brilho" onClick={() => patch({ light: { ...scene.light, glow: scene.light.glow.filter((_, idx) => idx !== i) } })}><Trash2 className="h-4 w-4 text-red-600" /></button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Água" hint="Bacia (elipse) ou lago (contorno livre), com reflexo, gotejar e marolas.">
        <label className="block text-xs text-ink-soft">Tipo de água
          <select className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm" value={waterMode} onChange={(e) => setWaterMode(e.target.value as 'none' | 'basin' | 'pond')}>
            <option value="none">Sem água</option><option value="basin">Bacia (elipse)</option><option value="pond">Lago (contorno livre)</option>
          </select>
        </label>
        {waterMode !== 'none' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              {waterMode === 'basin' ? <PickBtn onClick={() => pick({ kind: 'waterCenter' })}>Marcar centro da bacia</PickBtn> : <PickBtn onClick={() => pick({ kind: 'waterPoly' })}>Desenhar contorno do lago</PickBtn>}
              <PickBtn onClick={() => pick({ kind: 'waterRip' })}>Origem das marolas</PickBtn>
              {waterMode === 'basin' && <PickBtn onClick={() => pick({ kind: 'thread' })}>Fio d&apos;água caindo</PickBtn>}
              <Hex label="Cor da água" value={w.tint} onChange={(v) => patch({ water: { ...w, tint: v } })} />
            </div>
            {waterMode === 'basin' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Slider label="Largura" value={w.rx ?? 0.1} min={0.01} max={0.45} step={0.005} onChange={(v) => patch({ water: { ...w, rx: v } })} />
                <Slider label="Altura" value={w.ry ?? 0.04} min={0.005} max={0.3} step={0.005} onChange={(v) => patch({ water: { ...w, ry: v } })} />
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-ink-soft"><input type="checkbox" checked={Boolean(w.reflect)} onChange={(e) => patch({ water: { ...w, reflect: e.target.checked } })} />Refletir o jardim na água</label>
            <Slider label="Gotejar (segundos entre gotas, 0 = desligado)" value={w.drip ?? 0} min={0} max={30} step={0.5} onChange={(v) => patch({ water: { ...w, drip: v || undefined } })} />
            {waterMode === 'pond' && <Slider label="Carpas koi" value={scene.koi ?? 0} min={0} max={12} onChange={(v) => patch({ koi: v || undefined })} />}
          </>
        )}
      </Section>

      <Section title="Queda (folhas, pétalas ou neve)" hint="Até 3 tipos caindo de áreas diferentes.">
        <Slider label="Quantidade total" value={scene.fall.count} min={0} max={80} onChange={(v) => patch({ fall: { ...scene.fall, count: v } })} />
        {scene.fall.emitters.map((em, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-center gap-3">
              <select className="flex-1 rounded-lg border border-line bg-white p-2 text-xs" value={em.kind} onChange={(e) => setEmitter(i, { kind: e.target.value as FallEmitter['kind'] })}>
                {FALL_KINDS.map((k) => <option key={k} value={k}>{FALL_LABEL[k]}</option>)}
              </select>
              <PickBtn onClick={() => pick({ kind: 'fallZone', index: i })}>Marcar área</PickBtn>
              <button type="button" aria-label="Remover tipo" onClick={() => patch({ fall: { ...scene.fall, emitters: scene.fall.emitters.filter((_, idx) => idx !== i) } })}><Trash2 className="h-4 w-4 text-red-600" /></button>
            </div>
            <Slider label="Proporção" value={em.weight} min={0.05} max={1} step={0.05} onChange={(v) => setEmitter(i, { weight: v })} />
            <div className="flex flex-wrap items-center gap-2">
              {em.colors.map((c, ci) => <Hex key={ci} value={c} onChange={(v) => setEmitter(i, { colors: em.colors.map((x, xi) => (xi === ci ? v : x)) })} />)}
              {em.colors.length < 8 && <button type="button" className="text-xs text-forest-700 underline" onClick={() => setEmitter(i, { colors: [...em.colors, '#f4c4d4'] })}>+ cor</button>}
              {em.colors.length > 1 && <button type="button" className="text-xs text-red-600 underline" onClick={() => setEmitter(i, { colors: em.colors.slice(0, -1) })}>− cor</button>}
            </div>
          </div>
        ))}
        {scene.fall.emitters.length < 3 && (
          <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-forest-700" onClick={() => patch({ fall: { count: scene.fall.count || 30, emitters: [...scene.fall.emitters, { kind: 'petal', weight: 1, colors: ['#f4c4d4', '#eaa9c0'], zone: [0.3, -0.05, 0.9, 0.4] }] } })}><Plus className="h-3.5 w-3.5" />Adicionar tipo de queda</button>
        )}
      </Section>

      <Section title="Fauna" hint="Borboletas, abelhas, libélulas, vaga-lumes, beija-flores e andorinhas.">
        <div className="grid gap-3 sm:grid-cols-2">
          {flyerCount('butterflies', 'Borboletas', 12)}
          {flyerCount('bees', 'Abelhas', 14)}
          {flyerCount('dragonflies', 'Libélulas', 8)}
          {flyerCount('fireflies', 'Vaga-lumes', 40)}
          {flyerCount('hummingbirds', 'Beija-flores', 4)}
          <Slider label="Andorinhas" value={scene.birds.kind === 'swallows' ? scene.birds.count ?? 0 : 0} min={0} max={10} onChange={(v) => patch({ birds: v > 0 ? { kind: 'swallows', count: v } : { kind: 'none' } })} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-soft">Cores das borboletas:</span>
          {(scene.flyers.butColors ?? []).map((c, i) => <Hex key={i} value={c} onChange={(v) => patch({ flyers: { ...scene.flyers, butColors: (scene.flyers.butColors ?? []).map((x, xi) => (xi === i ? v : x)) } })} />)}
          {(scene.flyers.butColors ?? []).length < 6 && <button type="button" className="text-xs text-forest-700 underline" onClick={() => patch({ flyers: { ...scene.flyers, butColors: [...(scene.flyers.butColors ?? []), '#e8894d'] } })}>+ cor</button>}
          {(scene.flyers.butColors ?? []).length > 0 && <button type="button" className="text-xs text-red-600 underline" onClick={() => patch({ flyers: { ...scene.flyers, butColors: (scene.flyers.butColors ?? []).slice(0, -1) } })}>− cor</button>}
        </div>
        {(scene.flyers.hummingbirds ?? 0) > 0 && <PickBtn onClick={() => pick({ kind: 'hbZone' })}>Marcar onde os beija-flores ficam</PickBtn>}
      </Section>

      <Section title="Extras de cenário" hint="Cachoeira, névoa, patos, calor, poeira, gavião, estrelas, coruja, fumaça e aurora.">
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-forest-800">Cachoeira</p>{scene.waterfall ? <button type="button" className="text-xs text-red-600 underline" onClick={() => patch({ waterfall: undefined })}>Remover</button> : null}</div>
            <div className="flex gap-2"><PickBtn onClick={() => pick({ kind: 'waterfall' })}>{scene.waterfall ? 'Remarcar queda' : 'Marcar queda'}</PickBtn>{scene.waterfall && <PickBtn onClick={() => pick({ kind: 'waterfallLand' })}>Onde encontra a água</PickBtn>}</div>
          </div>

          <div className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-forest-800">Névoa</p>
              <label className="text-xs text-ink-soft"><input type="checkbox" className="mr-1" checked={Boolean(scene.mist)} onChange={(e) => patch({ mist: e.target.checked ? { bands: 2, y0: 0.3, y1: 0.42, amt: 0.12 } : undefined })} />Ativar</label></div>
            {scene.mist && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Slider label="Faixas" value={scene.mist.bands} min={1} max={6} onChange={(v) => patch({ mist: { ...scene.mist!, bands: v } })} />
                <Slider label="Intensidade" value={scene.mist.amt} min={0.02} max={0.4} step={0.01} onChange={(v) => patch({ mist: { ...scene.mist!, amt: v } })} />
                <Slider label="Altura inicial" value={scene.mist.y0} min={0} max={1} step={0.01} onChange={(v) => patch({ mist: { ...scene.mist!, y0: v } })} />
                <Slider label="Altura final" value={scene.mist.y1} min={0} max={1} step={0.01} onChange={(v) => patch({ mist: { ...scene.mist!, y1: v } })} />
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-forest-800">Patos ({scene.ducks?.length ?? 0}/4)</p>
              {(scene.ducks?.length ?? 0) < 4 && <button type="button" className="inline-flex items-center gap-1 text-xs text-forest-700" onClick={() => patch({ ducks: [...(scene.ducks ?? []), { path: [0.6, 0.6, 0.4, 0.7], sp: 1, per: 20, col: '#3c3a35' }] })}><Plus className="h-3.5 w-3.5" />Adicionar</button>}</div>
            {scene.ducks?.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-2">
                <PickBtn onClick={() => pick({ kind: 'duck', index: i })}>Marcar trajeto</PickBtn>
                <Hex value={d.col ?? '#3c3a35'} onChange={(v) => patch({ ducks: scene.ducks!.map((x, xi) => (xi === i ? { ...x, col: v } : x)) })} />
                <div className="min-w-[8rem] flex-1"><Slider label="Velocidade" value={d.sp} min={0.3} max={2} step={0.1} onChange={(v) => patch({ ducks: scene.ducks!.map((x, xi) => (xi === i ? { ...x, sp: v } : x)) })} /></div>
                <button type="button" aria-label="Remover pato" onClick={() => patch({ ducks: scene.ducks!.filter((_, xi) => xi !== i) })}><Trash2 className="h-4 w-4 text-red-600" /></button>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-forest-800">Ondulação de calor ({scene.shimmer?.length ?? 0}/4)</p>
              {(scene.shimmer?.length ?? 0) < 4 && <button type="button" className="inline-flex items-center gap-1 text-xs text-forest-700" onClick={() => patch({ shimmer: [...(scene.shimmer ?? []), { y0: 0.3, y1: 0.4, x0: 0, x1: 1, amp: 1.2, freq: 0.07, speed: 0.8 }] })}><Plus className="h-3.5 w-3.5" />Adicionar faixa</button>}</div>
            {scene.shimmer?.map((b, i) => (
              <div key={i} className="grid gap-3 rounded-lg border border-line p-2 sm:grid-cols-2">
                <Slider label="De (altura)" value={b.y0} min={0} max={1} step={0.01} onChange={(v) => patch({ shimmer: scene.shimmer!.map((x, xi) => (xi === i ? { ...x, y0: v } : x)) })} />
                <Slider label="Até (altura)" value={b.y1} min={0} max={1} step={0.01} onChange={(v) => patch({ shimmer: scene.shimmer!.map((x, xi) => (xi === i ? { ...x, y1: v } : x)) })} />
                <Slider label="Intensidade" value={b.amp} min={0.3} max={3} step={0.1} onChange={(v) => patch({ shimmer: scene.shimmer!.map((x, xi) => (xi === i ? { ...x, amp: v } : x)) })} />
                <div className="flex items-end justify-between gap-2">
                  <label className="text-xs text-ink-soft"><input type="checkbox" className="mr-1" checked={Boolean(b.top)} onChange={(e) => patch({ shimmer: scene.shimmer!.map((x, xi) => (xi === i ? { ...x, top: e.target.checked || undefined } : x)) })} />Balançar só no topo (gramínea)</label>
                  <button type="button" aria-label="Remover faixa" onClick={() => patch({ shimmer: scene.shimmer!.filter((_, xi) => xi !== i) })}><Trash2 className="h-4 w-4 text-red-600" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-forest-800">Poeira no ar</p>{scene.dust && <button type="button" className="text-xs text-red-600 underline" onClick={() => patch({ dust: undefined })}>Remover</button>}</div>
            <div className="flex flex-wrap items-center gap-3">
              <PickBtn onClick={() => pick({ kind: 'dustZone' })}>{scene.dust ? 'Remarcar área' : 'Marcar área'}</PickBtn>
              {scene.dust && <div className="min-w-[10rem] flex-1"><Slider label="Quantidade" value={scene.dust.count} min={1} max={60} onChange={(v) => patch({ dust: { ...scene.dust!, count: v } })} /></div>}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-forest-800">Gavião voando em círculo</p>{scene.hawk && <button type="button" className="text-xs text-red-600 underline" onClick={() => patch({ hawk: undefined })}>Remover</button>}</div>
            <PickBtn onClick={() => pick({ kind: 'hawk' })}>{scene.hawk ? 'Remarcar centro' : 'Marcar centro do voo'}</PickBtn>
            {scene.hawk && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Slider label="Raio horizontal" value={scene.hawk.r[0]} min={0.05} max={0.6} step={0.01} onChange={(v) => patch({ hawk: { ...scene.hawk!, r: [v, scene.hawk!.r[1]] } })} />
                <Slider label="Raio vertical" value={scene.hawk.r[1]} min={0.02} max={0.3} step={0.01} onChange={(v) => patch({ hawk: { ...scene.hawk!, r: [scene.hawk!.r[0], v] } })} />
                <Slider label="Velocidade" value={scene.hawk.sp} min={0.03} max={0.4} step={0.01} onChange={(v) => patch({ hawk: { ...scene.hawk!, sp: v } })} />
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-forest-800">Estrelas ({scene.stars?.length ?? 0}/60)</p>
              <span className="flex gap-2">
                <PickBtn onClick={() => pick({ kind: 'star' })}>Marcar na imagem</PickBtn>
                <PickBtn onClick={() => patch({ stars: Array.from({ length: 14 }, (_, i): [number, number, number] => [0.06 + ((i * 0.137) % 0.9), 0.03 + ((i * 0.071) % 0.22), 1 + (i % 3) * 0.15]) })}>Gerar 14</PickBtn>
                {(scene.stars?.length ?? 0) > 0 && <button type="button" className="text-xs text-red-600 underline" onClick={() => patch({ stars: undefined })}>Limpar</button>}
              </span></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-line p-3">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold text-forest-800">Coruja</p>{scene.owl && <button type="button" className="text-xs text-red-600 underline" onClick={() => patch({ owl: undefined })}>Remover</button>}</div>
              <PickBtn onClick={() => pick({ kind: 'owl' })}>{scene.owl ? 'Remarcar' : 'Marcar onde pousa'}</PickBtn>
            </div>
            <div className="space-y-2 rounded-xl border border-line p-3">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold text-forest-800">Fumaça de chaminé</p>{scene.smoke && <button type="button" className="text-xs text-red-600 underline" onClick={() => patch({ smoke: undefined })}>Remover</button>}</div>
              <PickBtn onClick={() => pick({ kind: 'smoke' })}>{scene.smoke ? 'Remarcar' : 'Marcar chaminé'}</PickBtn>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-forest-800">Aurora boreal</p>
              <label className="text-xs text-ink-soft"><input type="checkbox" className="mr-1" checked={Boolean(scene.aurora)} onChange={(e) => patch({ aurora: e.target.checked ? { x0: 0.3, x1: 1, bands: [[0.03, 0.11, '#6fd9a0'], [0.08, 0.17, '#9db8e8']] } : undefined })} />Ativar</label></div>
            {scene.aurora && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Slider label="Começa em (horizontal)" value={scene.aurora.x0} min={0} max={1} step={0.01} onChange={(v) => patch({ aurora: { ...scene.aurora!, x0: v } })} />
                  <Slider label="Termina em (horizontal)" value={scene.aurora.x1} min={0} max={1} step={0.01} onChange={(v) => patch({ aurora: { ...scene.aurora!, x1: v } })} />
                </div>
                {scene.aurora.bands.map((b, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-2">
                    <Hex value={b[2]} onChange={(v) => patch({ aurora: { ...scene.aurora!, bands: scene.aurora!.bands.map((x, xi) => (xi === i ? [x[0], x[1], v] : x)) } })} />
                    <div className="min-w-[7rem] flex-1"><Slider label="Topo" value={b[0]} min={0} max={0.5} step={0.01} onChange={(v) => patch({ aurora: { ...scene.aurora!, bands: scene.aurora!.bands.map((x, xi) => (xi === i ? [v, x[1], x[2]] : x)) } })} /></div>
                    <div className="min-w-[7rem] flex-1"><Slider label="Base" value={b[1]} min={0} max={0.5} step={0.01} onChange={(v) => patch({ aurora: { ...scene.aurora!, bands: scene.aurora!.bands.map((x, xi) => (xi === i ? [x[0], v, x[2]] : x)) } })} /></div>
                    {scene.aurora!.bands.length > 1 && <button type="button" aria-label="Remover faixa" onClick={() => patch({ aurora: { ...scene.aurora!, bands: scene.aurora!.bands.filter((_, xi) => xi !== i) } })}><Trash2 className="h-4 w-4 text-red-600" /></button>}
                  </div>
                ))}
                {scene.aurora.bands.length < 4 && <button type="button" className="inline-flex items-center gap-1 text-xs text-forest-700" onClick={() => patch({ aurora: { ...scene.aurora!, bands: [...scene.aurora!.bands, [0.1, 0.2, '#5fcf95']] } })}><Plus className="h-3.5 w-3.5" />Adicionar faixa</button>}
              </>
            )}
          </div>
        </div>
      </Section>
    </div>
  )
}

