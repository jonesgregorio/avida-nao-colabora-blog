import { useEffect, useRef } from 'react'

/**
 * Acessibilidade de modais (§20): foco inicial no diálogo, Escape fecha,
 * FOCUS TRAP (Tab/Shift+Tab circulam só dentro do diálogo) e restauração do
 * foco para o elemento que abriu o modal ao fechar.
 *
 * O elemento anexado a `dialogRef` deve ter `tabIndex={-1}` para poder receber
 * foco programático sem entrar na ordem normal de Tab.
 */
const FOCUSABLE = 'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),iframe,object,embed,[contenteditable],[tabindex]:not([tabindex="-1"])'

export function useModalA11y(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement as HTMLElement | null

    // Foco inicial: primeiro eldemento focável, senão o próprio diálogo.
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? dialog)?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return }
      if (e.key !== 'Tab' || !dialog) return
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement)
      if (nodes.length === 0) { e.preventDefault(); dialog.focus(); return }
      const firstEl = nodes[0]
      const lastEl = nodes[nodes.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === firstEl || active === dialog || !dialog.contains(active)) { e.preventDefault(); lastEl.focus() }
      } else if (active === lastEl) {
        e.preventDefault(); firstEl.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      // Restaura o foco para quem abriu (se ainda estiver no DOM).
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  return dialogRef
}
