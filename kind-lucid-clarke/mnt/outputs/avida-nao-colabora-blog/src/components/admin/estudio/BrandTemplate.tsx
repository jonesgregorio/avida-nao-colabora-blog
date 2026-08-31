import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import { LogoIcon } from '../../Logo'
import { safeInsets, type FormatSpec } from '../../../lib/estudioFormats'

// Templates da marca "A Vida Não Colabora" para o Estúdio (2 variantes):
//   frase  — moldura decorativa + grande área para o título tipográfico
//   pessoa — a mesma moldura + um círculo à direita com uma foto real
//
// Recriado em SVG/CSS para refluir em qualquer proporção (feed 4:5, 1:1,
// story/reel 9:16, capa de destaque). Cores fixas da marca — um post do
// Instagram é sempre "claro".

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

const FONT_SERIF = '"Playfair Display", Georgia, serif'

function leafSprig(w: number, h: number, color: string, opacity: number) {
  // caule curvo saindo da borda esquerda + folhas em elipse ao longo dele
  const baseX = -w * 0.04
  const baseY = h * (0.24)
  const leaves = []
  for (let i = 0; i < 9; i++) {
    const t = i / 8
    const cx = baseX + w * (0.02 + t * 0.24)
    const cy = baseY + h * (t * 0.34)
    const rot = -35 + t * 20 + (i % 2 === 0 ? 18 : -18)
    const lw = w * 0.055
    const lh = w * 0.020
    leaves.push(
      <ellipse key={i} cx={cx} cy={cy} rx={lw} ry={lh} fill={color} opacity={opacity}
        transform={`rotate(${rot} ${cx} ${cy})`} />,
    )
  }
  return (
    <g>
      <path
        d={`M ${baseX} ${baseY} Q ${baseX + w * 0.14} ${baseY + h * 0.16} ${baseX + w * 0.22} ${baseY + h * 0.36}`}
        fill="none" stroke={color} strokeWidth={w * 0.006} opacity={opacity * 0.8} strokeLinecap="round"
      />
      {leaves}
    </g>
  )
}

const BrandTemplate = forwardRef<
  HTMLDivElement,
  { spec: FormatSpec; content: TemplateContent; variant?: TemplateVariant; photoUrl?: string | null }
>(function BrandTemplate({ spec, content, variant = 'frase', photoUrl }, ref) {
  const { width: W, height: H } = spec
  const isTall = H / W > 1.2
  const { top: safeTop } = safeInsets(spec)
  const pad = Math.round(W * 0.06)

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

  const leafColor = variant === 'pessoa' ? LEAF_PESSOA : LEAF_FRASE
  const leafOpacity = variant === 'pessoa' ? 0.85 : 0.55

  // círculo da foto (variante "pessoa")
  const circleR = Math.round(Math.min(W, H) * (isTall ? 0.34 : 0.4))
  const circleCx = Math.round(W - circleR - W * 0.04)
  const circleCy = Math.round(H * (isTall ? 0.44 : 0.46))

  const titleSize = Math.round(W * (isTall ? 0.078 : variant === 'pessoa' ? 0.07 : 0.09))
  const titleTop = Math.round(H * (isTall ? 0.2 + safeTop : 0.26))
  const titleLeft = Math.round(pad + (variant === 'frase' ? W * 0.02 : 0))

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
        <circle cx={W * 0.95} cy={H * 0.04} r={Math.min(W, H) * 0.3} fill="none" stroke={FOREST} strokeWidth={W * 0.0035} opacity={0.45} />
        <circle cx={W * 0.9} cy={H * 0.99} r={Math.min(W, H) * 0.22} fill="none" stroke={CREAM} strokeWidth={W * 0.0035} opacity={0.5} />
        {/* sprig botânico à esquerda */}
        {leafSprig(W, H, leafColor, leafOpacity)}
      </svg>

      {/* foto real (variante pessoa) */}
      {variant === 'pessoa' && (
        <>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              style={{
                position: 'absolute',
                left: circleCx - circleR,
                top: circleCy - circleR,
                width: circleR * 2,
                height: circleR * 2,
                borderRadius: '50%',
                objectFit: 'cover',
                border: `${Math.max(2, W * 0.003)}px solid ${FOREST}`,
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                left: circleCx - circleR,
                top: circleCy - circleR,
                width: circleR * 2,
                height: circleR * 2,
                borderRadius: '50%',
                border: `${Math.max(2, W * 0.003)}px dashed ${INK_SOFT}`,
                background: '#FFFFFF',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'Inter, sans-serif',
                fontSize: W * 0.02,
                color: INK_SOFT,
              }}
            >
              suba uma foto
            </div>
          )}
        </>
      )}

      {/* logo topo-esquerda */}
      <div style={{ position: 'absolute', left: pad, top: pad, display: 'flex', alignItems: 'center', gap: W * 0.014, color: FOREST }}>
        <span style={{ width: W * 0.045, height: W * 0.045, display: 'block' }}><LogoIcon className="w-full h-full" /></span>
        <span style={{ fontWeight: 600, fontSize: W * 0.036, color: FOREST }}>A Vida Não Colabora</span>
      </div>

      {/* título */}
      <div
        style={{
          position: 'absolute',
          left: titleLeft,
          top: titleTop,
          right: variant === 'pessoa' ? W - (circleCx - circleR) + W * 0.02 : pad,
          fontWeight: 600,
          fontSize: titleSize,
          lineHeight: 1.14,
          color: FOREST,
          maxWidth: variant === 'pessoa' ? undefined : '14ch',
        }}
      >
        {content.kicker && (
          <span style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: W * 0.024, letterSpacing: '0.14em', textTransform: 'uppercase', color: FOREST, marginBottom: W * 0.02 }}>
            {content.kicker}
          </span>
        )}
        {content.titulo || 'Seu título aqui'}
        {content.corpo && (
          <span style={{ display: 'block', marginTop: W * 0.03, fontFamily: 'Inter, sans-serif', fontSize: W * 0.03, lineHeight: 1.5, color: INK_SOFT, fontWeight: 400 }}>
            {content.corpo}
          </span>
        )}
      </div>

      {/* assinatura inferior-esquerda (sobre a onda verde) */}
      <div style={{ position: 'absolute', left: pad, bottom: Math.round(H * 0.055), display: 'flex', alignItems: 'center', gap: W * 0.016, color: CREAM }}>
        <span style={{ width: W * 0.05, height: W * 0.05, display: 'block' }}><LogoIcon className="w-full h-full" /></span>
        <span style={{ fontStyle: 'italic', fontSize: W * 0.032, color: CREAM }}>Seu espaço de cuidado</span>
      </div>

      {typeof content.slideIndex === 'number' && content.slideTotal ? (
        <div style={{ position: 'absolute', right: pad, top: pad + H * safeTop + W * 0.06, fontFamily: 'Inter, sans-serif', fontSize: W * 0.026, color: INK_SOFT }}>
          {content.slideIndex + 1}/{content.slideTotal}
        </div>
      ) : null}
    </div>
  )
})

export default BrandTemplate
