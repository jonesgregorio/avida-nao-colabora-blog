import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import type { FormatSpec } from '../../../lib/estudioFormats'

// Texto de tela do reel, renderizado como PNG TRANSPARENTE 1080×1920 para
// arrastar sobre o vídeo no CapCut/InShot. Sem fundo, sem marca — só a
// legenda, com sombra para legibilidade sobre qualquer imagem.

const FONT_SERIF = '"Playfair Display", Georgia, serif'

interface Props {
  spec: FormatSpec
  texto: string
}

const OverlayTemplate = forwardRef<HTMLDivElement, Props>(function OverlayTemplate({ spec, texto }, ref) {
  const pad = Math.round(spec.width * 0.09)
  const root: CSSProperties = {
    width: spec.width,
    height: spec.height,
    position: 'relative',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // zona segura: longe do topo e da base cobertos pela interface
    paddingLeft: pad,
    paddingRight: pad,
    paddingTop: spec.height * 0.16,
    paddingBottom: spec.height * 0.22,
    boxSizing: 'border-box',
  }
  const text: CSSProperties = {
    fontFamily: FONT_SERIF,
    fontWeight: 600,
    fontSize: Math.round(spec.width * 0.082),
    lineHeight: 1.15,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadow: '0 2px 24px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.6)',
    maxWidth: '16ch',
  }

  return (
    <div ref={ref} style={root}>
      <span style={text}>{texto || 'Texto na tela'}</span>
    </div>
  )
})

export default OverlayTemplate
