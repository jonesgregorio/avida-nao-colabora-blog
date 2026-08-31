import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import { HIGHLIGHT_SPEC, type HighlightCover } from '../../../lib/estudioHighlights'

// Capa de destaque renderizada no tamanho exato (1080×1920). O conteúdo fica
// no miolo porque o perfil só mostra um círculo centralizado. Paleta fixa da
// marca — o Instagram não segue o tema do painel.

const PAPER = '#FBFAF7'
const MINT = '#E8F0EB'
const FOREST = '#1A4A3A'
const FONT_SERIF = '"Playfair Display", Georgia, serif'

const HighlightCoverTemplate = forwardRef<HTMLDivElement, { cover: HighlightCover }>(
  function HighlightCoverTemplate({ cover }, ref) {
    const { width, height } = HIGHLIGHT_SPEC
    const root: CSSProperties = {
      width,
      height,
      position: 'relative',
      background: `radial-gradient(circle at 50% 42%, ${PAPER} 0%, ${MINT} 70%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Math.round(width * 0.03),
      boxSizing: 'border-box',
    }
    return (
      <div ref={ref} style={root}>
        <span style={{ fontSize: Math.round(width * 0.26), lineHeight: 1 }}>{cover.emoji || '✨'}</span>
        <span
          style={{
            fontFamily: FONT_SERIF,
            fontWeight: 600,
            fontSize: Math.round(width * 0.062),
            color: FOREST,
            textAlign: 'center',
            maxWidth: '10ch',
          }}
        >
          {cover.label || 'Destaque'}
        </span>
      </div>
    )
  },
)

export default HighlightCoverTemplate
