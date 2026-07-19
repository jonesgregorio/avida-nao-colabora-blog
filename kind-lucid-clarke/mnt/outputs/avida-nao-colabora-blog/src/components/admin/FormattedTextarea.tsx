import { useRef } from 'react'
import { Heading, Heading2, Bold, Italic, List, ListOrdered, Quote, Link2, Minus, Eye } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  className?: string
}

// Textarea com barra de formatação do blog. A sintaxe é a MESMA que o
// ArticleView/ArticlePreview interpretam:
//   ## Subtítulo   ### Sub-subtítulo   **negrito**   - lista   > citação
// Por isso a toolbar só INSERE esses marcadores — o que você vê aqui é
// exatamente o que o "Visualizar" renderiza como no blog.
export default function FormattedTextarea({ value, onChange, rows = 16, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Aplica a transformação na seleção e repõe o cursor/seleção.
  function aplicar(fn: (sel: string) => { texto: string; selInicio: number; selFim: number }) {
    const ta = ref.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selecionado = value.slice(start, end)
    const { texto, selInicio, selFim } = fn(selecionado)
    const novo = value.slice(0, start) + texto + value.slice(end)
    onChange(novo)
    // Restaura foco/seleção após o React reconciliar.
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + selInicio, start + selFim)
    })
  }

  // Prefixo de linha (##, ###, -, >): aplica ao início da(s) linha(s) da seleção.
  function prefixoLinha(marca: string, exemplo: string) {
    aplicar(sel => {
      if (!sel) {
        const t = `${marca}${exemplo}`
        return { texto: t, selInicio: marca.length, selFim: t.length }
      }
      const linhas = sel.split('\n').map(l => (l.trim() ? `${marca}${l}` : l))
      const t = linhas.join('\n')
      return { texto: t, selInicio: 0, selFim: t.length }
    })
  }

  // Lista numerada: numera cada linha da seleção (1. 2. 3.…).
  function listaNumerada() {
    aplicar(sel => {
      if (!sel) { const t = '1. item'; return { texto: t, selInicio: 3, selFim: t.length } }
      let n = 0
      const t = sel.split('\n').map(l => (l.trim() ? `${++n}. ${l}` : l)).join('\n')
      return { texto: t, selInicio: 0, selFim: t.length }
    })
  }

  // Insere um bloco cru (divisor), garantindo linhas em branco em volta.
  function inserirBloco(bloco: string) {
    aplicar(() => {
      const t = `\n${bloco}\n`
      return { texto: t, selInicio: t.length, selFim: t.length }
    })
  }

  // Link: [texto](url). Se houver seleção, ela vira o texto e o cursor cai na url.
  function inserirLink() {
    aplicar(sel => {
      const txt = sel || 'texto'
      const t = `[${txt}](url)`
      const inicioUrl = t.length - 4 // posição de "url"
      return { texto: t, selInicio: inicioUrl, selFim: inicioUrl + 3 }
    })
  }

  // Envolve a seleção (negrito).
  function envolver(abre: string, fecha: string, exemplo: string) {
    aplicar(sel => {
      const conteudo = sel || exemplo
      const t = `${abre}${conteudo}${fecha}`
      const inicio = sel ? 0 : abre.length
      const fim = sel ? t.length : abre.length + exemplo.length
      return { texto: t, selInicio: inicio, selFim: fim }
    })
  }

  const btn = 'flex items-center gap-1 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 rounded transition-colors'

  return (
    <div className="border border-line rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-stone-300">
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-line bg-stone-50">
        <button type="button" onClick={() => prefixoLinha('## ', 'Subtítulo')} className={btn} title="Subtítulo (##)">
          <Heading className="w-3.5 h-3.5" /> Subtítulo
        </button>
        <button type="button" onClick={() => prefixoLinha('### ', 'Tópico')} className={btn} title="Sub-subtítulo (###)">
          <Heading2 className="w-3.5 h-3.5" /> Tópico
        </button>
        <button type="button" onClick={() => envolver('**', '**', 'texto')} className={btn} title="Negrito (**texto**)">
          <Bold className="w-3.5 h-3.5" /> Negrito
        </button>
        <button type="button" onClick={() => envolver('*', '*', 'texto')} className={btn} title="Itálico (*texto*)">
          <Italic className="w-3.5 h-3.5" /> Itálico
        </button>
        <button type="button" onClick={() => prefixoLinha('- ', 'item')} className={btn} title="Lista (- item)">
          <List className="w-3.5 h-3.5" /> Lista
        </button>
        <button type="button" onClick={listaNumerada} className={btn} title="Lista numerada (1. item)">
          <ListOrdered className="w-3.5 h-3.5" /> Numerada
        </button>
        <button type="button" onClick={() => prefixoLinha('> ', 'citação')} className={btn} title="Citação (> texto)">
          <Quote className="w-3.5 h-3.5" /> Citação
        </button>
        <button type="button" onClick={inserirLink} className={btn} title="Link [texto](url)">
          <Link2 className="w-3.5 h-3.5" /> Link
        </button>
        <button type="button" onClick={() => inserirBloco('---')} className={btn} title="Divisor (---)">
          <Minus className="w-3.5 h-3.5" /> Divisor
        </button>
        <span className="ml-auto text-[10px] text-stone-400 flex items-center gap-1 pr-1">
          <Eye className="w-3 h-3" /> use “Visualizar” para ver como fica no blog
        </span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={className ?? 'w-full px-3 py-2 text-xs font-mono focus:outline-none resize-y'}
      />
    </div>
  )
}
