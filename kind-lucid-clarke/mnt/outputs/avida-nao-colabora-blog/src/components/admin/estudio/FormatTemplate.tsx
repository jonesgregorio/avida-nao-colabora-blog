import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import { LogoIcon } from '../../Logo'
import { safeInsets, type FormatSpec } from '../../../lib/estudioFormats'

// Template da marca para uma arte do Instagram, renderizado no tamanho EXATO
// em pixels. Estilos inline (não Tailwind) para o html2canvas capturar as
// dimensões corretas. Paleta fixa da marca — um post do Instagram é sempre
// "claro", não segue o tema do painel.

const PAPER = '#FBFAF7'
const FOREST = '#1A4A3A'
const FOREST_INK = '#0F2F25'
const MINT = '#E8F0EB'
const INK_SOFT = '#5F6661'

export interface TemplateContent {
  titulo: string
  kicker?: string
  corpo?: string
  slideIndex?: number
  slideTotal?: number
}

interface Props {
  spec: FormatSpec
  content: TemplateContent
}

const FONT_SERIF = '"Playfair Display", Georgia, serif'
const FONT_SANS = 'Inter, system-ui, sans-serif'

const FormatTemplate = forwardRef<HTMLDivElement, Props>(function FormatTemplate({ spec, content }, ref) {
  const { top, bottom } = safeInsets(spec)
  const isTall = spec.height > spec.width
  const titleSize = Math.round(spec.width * (isTall ? 0.072 : 0.088))
  const pad = Math.round(spec.width * 0.09)

  const root: CSSProperties = {
    width: spec.width,
    height: spec.height,
    position: 'relative',
    background: `linear-gradient(160deg, ${PAPER} 0%, ${MINT} 100%)`,
    fontFamily: FONT_SANS,
    color: FOREST_INK,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingLeft: pad,
    paddingRight: pad,
    paddingTop: pad + spec.height * top,
    paddingBottom: pad + spec.height * bottom,
    boxSizing: 'border-box',
  }

  return (
    <div ref={ref} style={root}>
      {content.kicker && (
        <div style={{ fontSize: Math.round(spec.width * 0.024), letterSpacing: '0.18em', textTransform: 'uppercase', color: FOREST, fontWeight: 600, marginBottom: Math.round(spec.width * 0.03) }}>
          {content.kicker}
        </div>
      )}

      <div style={{ fontFamily: FONT_SERIF, fontWeight: 600, fontSize: titleSize, lineHeight: 1.12, color: FOREST, maxWidth: '15ch' }}>
        {content.titulo || 'Seu título aqui'}
      </div>

      {content.corpo && (
        <p style={{ marginTop: Math.round(spec.width * 0.04), fontSize: Math.round(spec.width * 0.032), lineHeight: 1.5, color: INK_SOFT, maxWidth: '32ch' }}>
          {content.corpo}
        </p>
      )}

      {/* assinatura da marca */}
      <div style={{ position: 'absolute', left: pad, bottom: Math.round(spec.height * bottom) + Math.round(spec.width * 0.05), display: 'flex', alignItems: 'center', gap: Math.round(spec.width * 0.018), color: FOREST }}>
        <span style={{ width: Math.round(spec.width * 0.05), height: Math.round(spec.width * 0.05), display: 'block' }}>
          <LogoIcon className="w-full h-full" />
        </span>
        <span style={{ fontSize: Math.round(spec.width * 0.022), letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          a vida não colabora
        </span>
      </div>

      {typeof content.slideIndex === 'number' && content.slideTotal ? (
        <div style={{ position: 'absolute', right: pad, top: Math.round(spec.height * top) + Math.round(spec.width * 0.05), fontSize: Math.round(spec.width * 0.026), color: INK_SOFT, fontFamily: FONT_SANS }}>
          {content.slideIndex + 1}/{content.slideTotal}
        </div>
      ) : null}
    </div>
  )
})

export default FormatTemplate
