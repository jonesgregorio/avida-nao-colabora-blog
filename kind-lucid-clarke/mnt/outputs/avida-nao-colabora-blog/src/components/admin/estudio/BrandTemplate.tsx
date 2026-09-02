import { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { LogoIcon } from '../../Logo'
import { safeInsets, type FormatSpec } from '../../../lib/estudioFormats'

// Templates da marca "A Vida Não Colabora" para o Estúdio (2 variantes):
//   frase  — moldura decorativa + a frase tipográfica centralizada
//   pessoa — moldura + a foto real num recorte grande à direita (círculo,
//            quadrado arredondado, retângulo ou sangrando toda a lateral) e
//            a frase no canto superior esquerdo
//
// Recriado em SVG/CSS para refluir em qualquer proporção. A frase encolhe
// sozinha até caber. A foto e a frase têm ajustes finos (recorte, zoom,
// posição, tamanho, cor, sobrepor) controlados pelo editor do Estúdio.

export interface TemplateContent {
  titulo: string
  kicker?: string
  corpo?: string
  slideIndex?: number
  slideTotal?: number
}

export type TemplateVariant = 'frase' | 'pessoa'
export type PhotoShape = 'circle' | 'rounded' | 'rect' | 'full'
export type TitlePlacement = 'top' | 'middle' | 'bottom'

export interface PhotoAdjust {
  shape?: PhotoShape
  zoom?: number // 1 = cobre o recorte; >1 aproxima
  offsetX?: number // -1..1 (fração do recorte)
  offsetY?: number // -1..1
  size?: number // 0.7..1.35 — tamanho do recorte no template
}

export interface TitleAdjust {
  scale?: number // 0.6..1.6 sobre o tamanho automático
  placement?: TitlePlacement
  color?: string
  onPhoto?: boolean // sobrepor a frase à foto
}

const CREAM = '#FBFAF7'
const FOREST = '#1A4A3A'
const FOREST_INK = '#0F2F25'
const INK_SOFT = '#5F6661'
const LEAF = '#6E8F73'
const BRAND = 'A Vida Não Colabora'

const FONT_SERIF = '"Playfair Display", Georgia, serif'
const FONT_SANS = 'Inter, system-ui, sans-serif'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// Folhagem desfocada saindo da borda esquerda — leitura de "sombra de folhas".
function softLeaves(w: number, h: number, opacity: number, filterId: string) {
  const stemTop = h * 0.34
  const span = h * 0.46
  const parts = []
  // dois raminhos pendentes, folhas pequenas
  for (let b = 0; b < 2; b++) {
    const bx = -w * 0.04 + b * w * 0.05
    for (let i = 0; i < 12; i++) {
      const t = i / 11
      const cx = bx + w * (0.02 + t * (0.10 + b * 0.04))
      const cy = stemTop + span * t + b * h * 0.04
      const side = i % 2 === 0 ? 1 : -1
      const rot = -70 + side * 32 + t * 30
      parts.push(
        <ellipse key={`${b}-${i}`} cx={cx} cy={cy} rx={w * 0.055} ry={w * 0.017} fill={LEAF} opacity={opacity}
          transform={`rotate(${rot} ${cx} ${cy})`} />,
      )
    }
    parts.push(
      <path key={`s${b}`} d={`M ${bx} ${stemTop} Q ${bx + w * 0.08} ${stemTop + span * 0.5} ${bx + w * 0.11} ${stemTop + span}`}
        fill="none" stroke={LEAF} strokeWidth={w * 0.006} opacity={opacity} strokeLinecap="round" />,
    )
  }
  return <g filter={`url(#${filterId})`}>{parts}</g>
}

/** Encolhe o texto até caber na área reservada — altura E largura, sem
 *  quebrar palavras no meio nem estourar o recorte da foto. */
function useFitText(maxPx: number, minPx: number, deps: unknown[]) {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(maxPx)
  useLayoutEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return
    let s = maxPx
    let guard = 260
    // mede com quebra normal: palavra comprida transborda a largura e é detectada
    inner.style.overflowWrap = 'normal'
    inner.style.fontSize = `${s}px`
    while (
      (inner.scrollHeight > box.clientHeight + 1 || inner.scrollWidth > box.clientWidth + 1) &&
      s > minPx && guard-- > 0
    ) {
      s -= 2
      inner.style.fontSize = `${s}px`
    }
    // rede de segurança: se ainda transbordar no mínimo, permite quebrar
    inner.style.overflowWrap = inner.scrollWidth > box.clientWidth + 1 ? 'break-word' : 'normal'
    setSize(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { boxRef, innerRef, size }
}

const BrandTemplate = forwardRef<
  HTMLDivElement,
  {
    spec: FormatSpec
    content: TemplateContent
    variant?: TemplateVariant
    photoUrl?: string | null
    photo?: PhotoAdjust
    title?: TitleAdjust
  }
>(function BrandTemplate({ spec, content, variant = 'frase', photoUrl, photo = {}, title = {} }, ref) {
  const { width: W, height: H } = spec
  const isTall = H / W > 1.2
  const { top: safeTop, bottom: safeBottom } = safeInsets(spec)
  const topInset = H * safeTop
  const botInset = H * safeBottom
  const pad = Math.round(W * 0.06)
  const fid = `lf-${W}x${H}`

  const kicker = content.kicker && content.kicker.trim().toLowerCase() !== BRAND.toLowerCase()
    ? content.kicker.trim()
    : ''
  const titulo = content.titulo || 'Sua frase aqui'

  const shape: PhotoShape = photo.shape ?? 'circle'
  const zoom = clamp(photo.zoom ?? 1, 1, 3)
  const offX = clamp(photo.offsetX ?? 0, -1, 1)
  const offY = clamp(photo.offsetY ?? 0, -1, 1)
  const psize = clamp(photo.size ?? 1, 0.7, 1.35)

  // ── recorte da foto (variante pessoa) ─────────────────────────────────────
  const bigR = W * 0.40 * psize
  const bigCx = W * 0.76
  const bigCy = H * (isTall ? 0.48 : 0.54)
  // "cheia": o Tamanho controla quanto da largura a foto ocupa
  const fullLeft = W * (0.52 - (psize - 0.7) * 0.34)
  const frame = shape === 'full'
    ? { left: fullLeft, top: -2, w: W - fullLeft + 2, h: H + 4, radius: 0 }
    : {
        left: bigCx - bigR,
        top: bigCy - bigR,
        w: bigR * 2,
        h: bigR * 2,
        radius: shape === 'circle' ? bigR : shape === 'rounded' ? W * 0.07 : 0,
      }
  const baseCover = Math.max(100, (frame.h / frame.w) * 100)

  // ── área da frase ────────────────────────────────────────────────────────
  const placement: TitlePlacement = title.placement ?? (variant === 'pessoa' ? 'top' : 'middle')
  const onPhoto = variant === 'pessoa' && !!title.onPhoto
  const tScale = clamp(title.scale ?? 1, 0.6, 1.6)
  const tColor = title.color || (onPhoto ? CREAM : FOREST)

  let boxLeft = pad
  let boxRight = pad
  let boxTop = Math.round(topInset + H * 0.13)
  let boxHeight = Math.max(H * 0.2, H - boxTop - Math.round(botInset + H * 0.2))

  if (variant === 'pessoa' && !onPhoto) {
    // canto superior esquerdo, sem tocar na curva do círculo
    const circleLeftEdge = shape === 'full' ? fullLeft : bigCx - bigR
    boxRight = Math.round(W - circleLeftEdge + W * 0.03)
    boxTop = Math.round(topInset + H * 0.135)
    boxHeight = Math.round(H * 0.34)
  } else if (onPhoto) {
    boxLeft = Math.round(frame.left + frame.w * 0.08)
    boxRight = Math.round(W - (frame.left + frame.w * 0.92))
    boxTop = Math.round(bigCy - H * 0.18)
    boxHeight = Math.round(H * 0.36)
  }
  if (variant === 'frase') {
    if (placement === 'top') { boxTop = Math.round(topInset + H * 0.16); boxHeight = Math.round(H * 0.4) }
    else if (placement === 'bottom') { boxTop = Math.round(H * 0.42); boxHeight = Math.round(H * 0.34) }
    else { boxTop = Math.round(topInset + H * 0.24); boxHeight = Math.max(H * 0.2, H - boxTop - Math.round(botInset + H * 0.2)) }
  } else if (!onPhoto) {
    if (placement === 'middle') boxTop = Math.round(topInset + H * 0.22)
    else if (placement === 'bottom') boxTop = Math.round(H * 0.4)
  }

  const align = variant === 'pessoa' && !onPhoto ? 'flex-start' : 'center'
  const textAlign = variant === 'pessoa' && !onPhoto ? 'left' : 'center'

  const maxPx = Math.round(
    (variant === 'pessoa' && !onPhoto ? W * 0.052 : variant === 'pessoa' ? W * 0.078 : W * (isTall ? 0.1 : 0.115)) * tScale,
  )
  const minPx = Math.round(W * 0.026 * tScale)
  const fit = useFitText(maxPx, minPx, [titulo, kicker, content.corpo, W, H, variant, boxHeight, boxLeft, boxRight, tScale, onPhoto])

  const root: CSSProperties = {
    width: W, height: H, position: 'relative', background: CREAM,
    overflow: 'hidden', fontFamily: FONT_SERIF, color: FOREST_INK, boxSizing: 'border-box',
  }

  const photoBox: CSSProperties = {
    position: 'absolute', left: frame.left, top: frame.top, width: frame.w, height: frame.h,
    borderRadius: frame.radius, overflow: 'hidden',
  }

  return (
    <div ref={ref} style={root}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
        <defs>
          <filter id={fid} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation={W * 0.019} />
          </filter>
        </defs>
        {/* onda verde inferior */}
        <path d={`M 0 ${H * 0.82} C ${W * 0.28} ${H * 0.73} ${W * 0.55} ${H * 0.93} ${W} ${H * 0.8} L ${W} ${H} L 0 ${H} Z`} fill={FOREST} />
        {/* blob verde canto superior direito (só na variante frase) */}
        {variant === 'frase' && (
          <path d={`M ${W * 0.63} 0 C ${W * 0.64} ${H * 0.14} ${W * 0.82} ${H * 0.22} ${W} ${H * 0.19} L ${W} 0 Z`} fill={FOREST} />
        )}
        {/* círculo fino decorativo inferior */}
        <circle cx={W * 0.9} cy={H * 0.99} r={Math.min(W, H) * 0.22} fill="none" stroke={CREAM} strokeWidth={W * 0.0035} opacity={0.5} />
        {/* sombra de folhas à esquerda */}
        {softLeaves(W, H, variant === 'pessoa' ? 0.6 : 0.4, fid)}
      </svg>

      {/* foto (variante pessoa) — recorte grande à direita, sobre a onda */}
      {variant === 'pessoa' && (
        <>
          <div
            style={{
              ...photoBox,
              backgroundColor: '#FFFFFF',
              backgroundImage: photoUrl ? `url("${photoUrl}")` : undefined,
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${baseCover * zoom}%`,
              backgroundPosition: `${50 + offX * 50}% ${50 + offY * 50}%`,
              display: photoUrl ? undefined : 'grid',
              placeItems: 'center',
              border: photoUrl ? undefined : `${Math.max(2, W * 0.004)}px dashed ${INK_SOFT}`,
            }}
          >
            {!photoUrl && <span style={{ fontFamily: FONT_SANS, fontSize: W * 0.02, color: INK_SOFT }}>suba uma foto</span>}
          </div>
          {/* contorno fino verde */}
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
            {shape === 'full'
              ? <line x1={frame.left} y1={0} x2={frame.left} y2={H} stroke={FOREST} strokeWidth={W * 0.0045} />
              : <rect x={frame.left} y={frame.top} width={frame.w} height={frame.h} rx={frame.radius} ry={frame.radius}
                  fill="none" stroke={FOREST} strokeWidth={W * 0.0045} />}
          </svg>
        </>
      )}

      {/* logo topo-esquerda */}
      <div style={{ position: 'absolute', left: pad, top: Math.round(topInset + pad * 0.6), display: 'flex', alignItems: 'center', gap: W * 0.014, color: FOREST }}>
        <span style={{ width: W * 0.045, height: W * 0.045, display: 'block' }}><LogoIcon className="w-full h-full" /></span>
        <span style={{ fontWeight: 600, fontSize: W * 0.036, color: FOREST }}>{BRAND}</span>
      </div>

      {/* frase */}
      <div
        ref={fit.boxRef}
        style={{
          position: 'absolute', left: boxLeft, right: boxRight, top: boxTop, height: boxHeight,
          overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center',
          alignItems: align, textAlign,
        }}
      >
        <div
          ref={fit.innerRef}
          style={{
            width: '100%', fontSize: fit.size, overflowWrap: 'normal',
            textShadow: onPhoto ? '0 2px 14px rgba(15,47,37,0.55)' : undefined,
          }}
        >
          {kicker && (
            <span style={{ display: 'block', fontFamily: FONT_SANS, fontSize: W * 0.024, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: tColor, marginBottom: W * 0.022 }}>
              {kicker}
            </span>
          )}
          <span style={{ display: 'block', fontWeight: 600, lineHeight: 1.16, letterSpacing: '-0.01em', color: tColor, textWrap: 'balance' } as CSSProperties}>
            {titulo}
          </span>
          {content.corpo && (
            <span style={{ display: 'block', marginTop: W * 0.035, fontFamily: FONT_SANS, fontSize: W * 0.03, lineHeight: 1.5, color: onPhoto ? CREAM : INK_SOFT, fontWeight: 400 }}>
              {content.corpo}
            </span>
          )}
        </div>
      </div>

      {/* assinatura inferior-esquerda (sobre a onda verde) */}
      <div style={{ position: 'absolute', left: pad, bottom: Math.round(botInset + H * 0.055), display: 'flex', alignItems: 'center', gap: W * 0.016, color: CREAM }}>
        <span style={{ width: W * 0.05, height: W * 0.05, display: 'block' }}><LogoIcon className="w-full h-full" /></span>
        <span style={{ fontStyle: 'italic', fontSize: W * 0.032, color: CREAM }}>Seu espaço de cuidado</span>
      </div>

      {typeof content.slideIndex === 'number' && content.slideTotal ? (
        <div style={{ position: 'absolute', right: pad, top: Math.round(topInset + pad * 0.6), fontFamily: FONT_SANS, fontSize: W * 0.026, color: variant === 'pessoa' ? FOREST : FOREST }}>
          {content.slideIndex + 1}/{content.slideTotal}
        </div>
      ) : null}
    </div>
  )
})

export default BrandTemplate
