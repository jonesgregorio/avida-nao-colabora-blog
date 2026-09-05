import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import AdminUsersImpl from './AdminUsersImpl'

interface Props {
  initialUserId?: string | null
}

function compactText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function criticalConfirmation(target: Element): { control: HTMLElement; message: string } | null {
  const adminToggle = target.closest('input#admin-toggle') as HTMLInputElement | null
  if (adminToggle) {
    return {
      control: adminToggle,
      message: adminToggle.checked
        ? 'Confirmar a remoção da permissão administrativa? A pessoa perderá imediatamente o acesso ao painel.'
        : 'Confirmar a concessão de permissão administrativa? Essa pessoa passará a ter acesso aos dados e operações protegidas do painel.',
    }
  }

  const button = target.closest('button') as HTMLButtonElement | null
  if (!button || button.disabled) return null
  const label = compactText(button.textContent)
  const cardText = compactText(button.closest('.rounded-xl')?.textContent)

  if (label === 'Aplicar' && cardText.includes('Alterar plano (admin)')) {
    return {
      control: button,
      message: 'Confirmar a alteração imediata do plano deste usuário? Verifique o plano selecionado antes de continuar.',
    }
  }
  if (label === 'Confirmar alteração') {
    return {
      control: button,
      message: 'Confirmar a alteração do plano deste usuário? Esta ação será registrada no histórico administrativo.',
    }
  }
  if (label === 'Agendar cancelamento') {
    return {
      control: button,
      message: 'Confirmar o agendamento do cancelamento desta assinatura? O usuário continuará com acesso até o fim do ciclo vigente.',
    }
  }
  if (label === 'Definir' && cardText.includes('Redefinir senha')) {
    return {
      control: button,
      message: 'Confirmar a redefinição da senha deste usuário? A nova senha é temporária e não será registrada no log de auditoria.',
    }
  }
  return null
}

// A implementação de Usuários é grande e deliberadamente separada. Esta fachada
// concentra a camada defensiva de UX para operações críticas sem duplicar a lógica
// de negócio: confirmação antes da ação; feedback de sucesso/erro continua vindo
// dos próprios fluxos e o log de auditoria permanece no AdminUsersImpl.
export default function AdminUsers(props: Props) {
  const replaying = useRef(new WeakSet<HTMLElement>())
  const [notice, setNotice] = useState('')

  function onClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return
    const critical = criticalConfirmation(event.target)
    if (!critical) return

    if (replaying.current.has(critical.control)) {
      replaying.current.delete(critical.control)
      return
    }

    event.preventDefault()
    event.stopPropagation()
    if (!window.confirm(critical.message)) return

    setNotice('Ação confirmada. Aguarde a mensagem de sucesso ou erro do próprio painel antes de sair desta tela.')
    window.setTimeout(() => setNotice(''), 5_000)
    replaying.current.add(critical.control)
    critical.control.click()
  }

  return (
    <div onClickCapture={onClickCapture}>
      {notice && (
        <div role="status" aria-live="polite" className="fixed right-4 top-4 z-[100] max-w-sm rounded-xl border border-forest-200 bg-white px-4 py-3 text-sm text-forest-900 shadow-lg">
          {notice}
        </div>
      )}
      <AdminUsersImpl {...props} />
    </div>
  )
}
