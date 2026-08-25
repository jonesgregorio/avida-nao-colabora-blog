import { useEffect, useRef } from 'react'

/**
 * §20 (acessibilidade): nenhum modal do app fechava com Esc nem movia o foco
 * para dentro do diálogo ao abrir — o foco ficava preso no botão que abriu o
 * modal, atrás do overlay. Aplica os dois comportamentos em qualquer modal
 * que use este hook, sem duplicar a lógica em cada componente.
 *
 * O elemento anexado a `dialogRef` deve ter `tabIndex={-1}` para poder
 * receber foco programático sem entrar na ordem normal de Tab.
 */
export function useModalA11y(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return dialogRef
}
