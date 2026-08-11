import type { ReactNode } from 'react'

// ============================================================================
// Renderizador de artigo — FONTE ÚNICA usada pelo blog (ArticleView) e pela
// pré-visualização do admin (ArticlePreview). Antes cada um tinha a sua cópia,
// e o negrito só funcionava se a LINHA INTEIRA fosse negrito.
//
// Sintaxe suportada (a mesma que a toolbar do editor insere):
//   ## Subtítulo          ### Tópico
//   - item  /  1. item    (agrupados em lista com marcador/número)
//   > citação             (linhas consecutivas viram um bloco)
//   ---                   (divisor)
//   ::video[legenda](url) (vídeo de referência do YouTube, embed responsivo)
//   **negrito**  *itálico*  [texto](url)  — inline, dentro de qualquer parágrafo
// ============================================================================

// Extrai o ID de um vídeo do YouTube de qualquer forma de URL (watch, youtu.be,
// embed, shorts). Retorna null se não for um link do YouTube reconhecido.
export function youTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?[^\s]*\bv=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ]
  for (const p of patterns) { const m = url.match(p); if (m) return m[1] }
  return null
}

// Estima o tempo de leitura em minutos (~200 palavras/min em pt-BR). Mínimo 1.
export function estimateReadTime(content: string): number {
  const palavras = (content || '').trim().split(/\s+/).filter(Boolean).length
  if (palavras === 0) return 1
  return Math.max(1, Math.round(palavras / 200))
}

// ── Inline: **negrito**, *itálico*, [texto](url) ────────────────────────────
// Tokeniza a linha respeitando a ordem: link, negrito, itálico. Links externos
// abrem em nova aba; o resto vira <strong>/<em>.
function renderInline(texto: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  // Um regex que captura os três padrões; o loop consome o texto entre eles.
  const re = /(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(texto)) !== null) {
    if (m.index > last) out.push(texto.slice(last, m.index))
    const k = `${keyBase}-${i++}`
    if (m[1]) {
      const href = m[3]
      const externo = /^https?:\/\//.test(href)
      out.push(
        <a key={k} href={href} className="text-forest-700 underline underline-offset-2 hover:text-forest-900"
          {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {m[2]}
        </a>,
      )
    } else if (m[4]) {
      out.push(<strong key={k} className="font-semibold text-forest-800">{m[5]}</strong>)
    } else if (m[6]) {
      out.push(<em key={k} className="italic">{m[7]}</em>)
    } else if (m[8]) {
      out.push(<em key={k} className="italic">{m[9]}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < texto.length) out.push(texto.slice(last))
  return out
}

// ── Blocos: agrupa listas e citações consecutivas ───────────────────────────
export function renderArticleContent(content: string): ReactNode[] {
  if (!content || !content.trim()) return []
  const linhas = content.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0

  while (i < linhas.length) {
    const linha = linhas[i]
    const t = linha.trim()

    // Divisor
    if (/^(---|\*\*\*|___)\s*$/.test(t)) {
      out.push(<hr key={`hr-${i}`} className="my-8 border-t border-forest-200" />)
      i++; continue
    }
    // Vídeo de referência: ::video[legenda](url) — embed responsivo do YouTube.
    // Se a URL não for um YouTube reconhecido, cai como link (nunca embed quebrado).
    const vmatch = t.match(/^::video\[([^\]]*)\]\(([^)\s]+)\)$/)
    if (vmatch) {
      const caption = vmatch[1].trim()
      const vid = youTubeId(vmatch[2])
      if (vid) {
        out.push(
          <figure key={`vid-${i}`} className="my-6">
            <div className="relative w-full overflow-hidden rounded-xl border border-forest-200 bg-black" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${vid}`}
                title={caption || 'Vídeo de referência'}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {caption && <figcaption className="text-xs text-forest-500 mt-2 text-center">{caption}</figcaption>}
          </figure>,
        )
      } else {
        out.push(
          <p key={`vidlink-${i}`} className="text-forest-600 leading-relaxed mb-4">
            <a href={vmatch[2]} target="_blank" rel="noopener noreferrer" className="text-forest-700 underline underline-offset-2 hover:text-forest-900">
              {caption || vmatch[2]}
            </a>
          </p>,
        )
      }
      i++; continue
    }
    // Subtítulos
    if (t.startsWith('## ')) {
      out.push(<h2 key={`h2-${i}`} className="font-serif text-2xl text-forest-800 mt-10 mb-3">{renderInline(t.slice(3), `h2-${i}`)}</h2>)
      i++; continue
    }
    if (t.startsWith('### ')) {
      out.push(<h3 key={`h3-${i}`} className="font-serif text-xl text-forest-700 mt-8 mb-2">{renderInline(t.slice(4), `h3-${i}`)}</h3>)
      i++; continue
    }
    // Lista não ordenada (itens consecutivos)
    if (/^[-*]\s+/.test(t)) {
      const itens: ReactNode[] = []
      let j = i
      while (j < linhas.length && /^[-*]\s+/.test(linhas[j].trim())) {
        const conteudo = linhas[j].trim().replace(/^[-*]\s+/, '')
        itens.push(<li key={`li-${j}`} className="text-forest-600 leading-relaxed">{renderInline(conteudo, `li-${j}`)}</li>)
        j++
      }
      out.push(<ul key={`ul-${i}`} className="list-disc pl-6 space-y-1.5 my-4 marker:text-forest-400">{itens}</ul>)
      i = j; continue
    }
    // Lista ordenada
    if (/^\d+\.\s+/.test(t)) {
      const itens: ReactNode[] = []
      let j = i
      while (j < linhas.length && /^\d+\.\s+/.test(linhas[j].trim())) {
        const conteudo = linhas[j].trim().replace(/^\d+\.\s+/, '')
        itens.push(<li key={`oli-${j}`} className="text-forest-600 leading-relaxed">{renderInline(conteudo, `oli-${j}`)}</li>)
        j++
      }
      out.push(<ol key={`ol-${i}`} className="list-decimal pl-6 space-y-1.5 my-4 marker:text-forest-400 marker:font-medium">{itens}</ol>)
      i = j; continue
    }
    // Citação (linhas consecutivas viram um bloco só)
    if (t.startsWith('> ')) {
      const partes: string[] = []
      let j = i
      while (j < linhas.length && linhas[j].trim().startsWith('> ')) {
        partes.push(linhas[j].trim().slice(2))
        j++
      }
      out.push(
        <blockquote key={`bq-${i}`} className="border-l-4 border-forest-300 bg-mint/30 pl-4 pr-3 py-2 italic text-forest-700 my-5 rounded-r-lg">
          {renderInline(partes.join(' '), `bq-${i}`)}
        </blockquote>,
      )
      i = j; continue
    }
    // Linha em branco → espaçamento
    if (t === '') { out.push(<div key={`sp-${i}`} className="h-2" />); i++; continue }

    // Parágrafo normal (com inline)
    out.push(<p key={`p-${i}`} className="text-forest-600 leading-relaxed mb-4">{renderInline(linha, `p-${i}`)}</p>)
    i++
  }

  return out
}
