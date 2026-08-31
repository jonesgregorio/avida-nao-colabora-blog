import { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { LogoIcon } from '../../Logo'
import { safeInsets, type FormatSpec } from '../../../lib/estudioFormats'

// Templates da marca "A Vida Não Colabora" para o Estúdio (2 variantes):
//   frase  — moldura decorativa + a frase tipográfica centralizada
//   pessoa — a mesma moldura + a frase à esquerda e uma foto real num
//            círculo à direita (colunas que nunca se sobrepõem)
//
// Recriado em SVG/CSS para refluir em qualquer proporção (feed 4:5, 1:1,
// story/reel 9:16, capa de destaque). A frase encolhe sozinha até caber
// na área reservada — nada de texto cortado. Cores fixas da marca: um
// post do Instagram é sempre "claro".

export interface TemplateContent {
  titulo: string
  kicker?: string
  corpo?: string
  slideIndex?: number
  slideTotal?: number
}

export type TemplateVariant = 'frase' | 'pessoa'

const CREAM = '#FBFAF7'
const FOREST = '#1A4A3A'
const FOREST_INK = '#0F2F25'
const INK_SOFT = '#5F6661'
const LEAF_FRASE = '#CFCCC2'
const LEAF_PESSOA = '#7E9C86'
const BRAND = 'A Vida Não Colabora'

const FONT_SERIF = '"Playfair Display", Georgia, serif'
const FONT_SANS = 'Inter, system-ui, sans-serif'

// sprig botânico compacto — fica no canto superior esquerdo, abaixo do
// logo, sem alcançar a área da frase.
function leafSprig(w: number, h: number, color: string, opacity: number) {
  const baseX = -w * 0.02
  const baseY = h * 0.1
  const spanY = h * 0.1
  const leaves = []
  for (let i = 0; i < 6; i++) {
    const t = i / 5
    const cx = baseX + w * (0.02 + t * 0.07)
    const cy = baseY + spanY * t
    const rot = -30 + t * 16 + (i % 2 === 0 ? 16 : -16)
    leaves.push(
      <ellipse key={i} cx={cx} cy={cy} rx={w * 0.05} ry={w * 0.018} fill={color} opacity={opacity}
        transform={`rotate(${rot} ${cx} ${cy})`} />,
    )
  }
  return (
    <g>
      <path
        d={`M ${baseX} ${baseY} Q ${baseX + w * 0.05} ${baseY + spanY * 0.5} ${baseX + w * 0.07} ${baseY + spanY}`}
        fill="none" stroke={color} strokeWidth={w * 0.005} opacity={opacity * 0.8} strokeLinecap="round"
      />
      {leaves}
    </g>
  )
}

/** Encolhe o texto até caber na altura reservada (sem cortar nada). */
function useFitText(maxPx: number, minPx: number, deps: unknown[]) {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(maxPx)
  useLayoutEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return
    let s = maxPx
    let guard = 240
    inner.style.fontSize = `${s}px`
    while (inner.scrollHeight > box.clientHeight && s > minPx && guard-- > 0) {
      s -= 2
      inner.style.fontSize = `${s}px`
    }
    setSize(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { boxRef, innerRef, size }
}

const BrandTemplate = forwardRef<
  HTMLDivElement,
  { spec: FormatSpec; content: TemplateContent; variant?: TemplateVariant; photoUrl?: string | null }
>(function BrandTemplate({ spec, content, variant = 'frase', photoUrl }, ref) {
  const { width: W, height: H } = spec
  const isTall = H / W > 1.2
  const { top: safeTop, bottom: safeBottom } = safeInsets(spec)
  const pad = Math.round(W * 0.06)

  const leafColor = variant === 'pessoa' ? LEAF_PESSOA : LEAF_FRASE
  const leafOpacity = variant === 'pessoa' ? 0.5 : 0.4

  const kicker = content.kicker && content.kicker.trim().toLowerCase() !== BRAND.toLowerCase()
    ? content.kicker.trim()
    : ''
  const titulo = content.titulo || 'Sua frase aqui'

  // ── geometria da foto (variante pessoa) ────────────────────────────────────
  const circleR = Math.round(W * (isTall ? 0.215 : 0.235))
  const circleCx = Math.round(W - circleR - W * 0.06)
  const circleCy = Math.round(H * 0.5)
  const circleLeft = circleCx - circleR
  const gap = Math.round(W * 0.045)

  // ── área reservada para a frase ───────────────────────────────────────────
  const topInset = H * safeTop
  const botInset = H * safeBottom
  const boxLeft = pad
  const boxRight = variant === 'pessoa' ? W - (circleLeft - gap) : pad
  const boxTop = Math.round(topInset + H * (variant === 'pessoa' ? 0.2 : 0.24))
  const boxBottom = Math.round(botInset + H * 0.2) // acima da onda verde / assinatura
  const boxHeight = Math.max(H * 0.2, H - boxTop - boxBottom)

  const maxPx = Math.round(variant === 'pessoa' ? W * 0.072 : W * (isTall ? 0.1 : 0.115))
  const minPx = Math.round(W * (variant === 'pessoa' ? 0.036 : 0.042))
  const fit = useFitText(maxPx, minPx, [titulo, kicker, content.corpo, W, H, variant, boxHeight])

  const root: CSSProperties = {
    width: W,
    height: H,
    position: 'relative',
    background: CREAM,
    overflow: 'hidden',
    fontFamily: FONT_SERIF,
    color: FOREST_INK,
    boxSizing: 'border-box',
  }

  return (
    <div ref={ref} style={root}>
      {/* moldura decorativa */}
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: 'absolute', inset: 0 }} aria-hidden>
        {/* onda verde inferior */}
        <path
          d={`M 0 ${H * 0.82} C ${W * 0.28} ${H * 0.73} ${W * 0.55} ${H * 0.93} ${W} ${H * 0.8} L ${W} ${H} L 0 ${H} Z`}
          fill={FOREST}
        />
        {/* blob verde canto superior direito */}
        <path
          d={`M ${W * 0.63} 0 C ${W * 0.64} ${H * 0.14} ${W * 0.82} ${H * 0.22} ${W} ${H * 0.19} L ${W} 0 Z`}
          fill={FOREST}
        />
        {/* círculos finos */}
        <circle cx={W * 0.95} cy={H * 0.04} r={Math.min(W, H) * 0.3} fill="none" stroke={FOREST} strokeWidth={W * 0.0035} opacity={0.4} />
        <circle cx={W * 0.9} cy={H * 0.99} r={Math.min(W, H) * 0.22} fill="none" stroke={CREAM} strokeWidth={W * 0.0035} opacity={0.5} />
        {/* sprig botânico (canto superior esquerdo, fora da área da frase) */}
        {leafSprig(W, H, leafColor, leafOpacity)}
      </svg>

      {/* foto real (variante pessoa) */}
      {variant === 'pessoa' && (
        photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            style={{
              position: 'absolute',
              left: circleLeft,
              top: circleCy - circleR,
              width: circleR * 2,
              height: circleR * 2,
              borderRadius: '50%',
              objectFit: 'cover',
              border: `${Math.max(2, W * 0.004)}px solid ${FOREST}`,
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              left: circleLeft,
              top: circleCy - circleR,
              width: circleR * 2,
              height: circleR * 2,
              borderRadius: '50%',
              border: `${Math.max(2, W * 0.004)}px dashed ${INK_SOFT}`,
              background: '#FFFFFF',
              display: 'grid',
              placeItems: 'center',
              fontFamily: FONT_SANS,
              fontSize: W * 0.02,
              color: INK_SOFT,
            }}
          >
            suba uma foto
          </div>
        )
      )}

      {/* logo topo-esquerda */}
      <div style={{ position: 'absolute', left: pad, top: Math.round(topInset + pad * 0.6), display: 'flex', alignItems: 'center', gap: W * 0.014, color: FOREST }}>
        <span style={{ width: W * 0.045, height: W * 0.045, display: 'block' }}><LogoIcon className="w-full h-full" /></span>
        <span style={{ fontWeight: 600, fontSize: W * 0.036, color: FOREST }}>{BRAND}</span>
      </div>

      {/* frase da arte — encolhe até caber, nunca corta */}
      <div
        ref={fit.boxRef}
        style={{
          position: 'absolute',
          left: boxLeft,
          right: boxRight,
          top: boxTop,
          height: boxHeight,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: variant === 'pessoa' ? 'flex-start' : 'center',
          textAlign: variant === 'pessoa' ? 'left' : 'center',
        }}
      >
        <div ref={fit.innerRef} style={{ width: '100%', fontSize: fit.size }}>
          {kicker && (
            <span style={{ display: 'block', fontFamily: FONT_SANS, fontSize: W * 0.024, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: FOREST, marginBottom: W * 0.022 }}>
              {kicker}
            </span>
          )}
          <span style={{ display: 'block', fontWeight: 600, lineHeight: 1.14, letterSpacing: '-0.01em', color: FOREST, overflowWrap: 'break-word', hyphens: 'auto' }}>
            {titulo}
          </span>
          {content.corpo && (
            <span style={{ display: 'block', marginTop: W * 0.035, fontFamily: FONT_SANS, fontSize: W * 0.03, lineHeight: 1.5, color: INK_SOFT, fontWeight: 400 }}>
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
        <div style={{ position: 'absolute', right: pad, top: Math.round(topInset + pad * 0.6), fontFamily: FONT_SANS, fontSize: W * 0.026, color: variant === 'pessoa' ? INK_SOFT : FOREST }}>
          {content.slideIndex + 1}/{content.slideTotal}
        </div>
      ) : null}
    </div>
  )
})

export default BrandTemplate
