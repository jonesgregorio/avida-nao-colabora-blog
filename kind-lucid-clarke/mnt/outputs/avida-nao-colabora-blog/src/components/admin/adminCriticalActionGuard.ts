const replaying = new WeakSet<HTMLElement>()
const installKey = Symbol.for('avnc.adminCriticalActionGuard.installed')

type GuardWindow = Window & Record<PropertyKey, unknown>

function compactText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function criticalConfirmation(target: Element): { control: HTMLElement; message: string } | null {
  const adminToggle = target.closest('input#admin-toggle') as HTMLInputElement | null
  if (adminToggle) {
    return {
      control: adminToggle,
      message: adminToggle.checked
        ? 'Confirmar a concessão de permissão administrativa? Essa pessoa passará a ter acesso aos dados e operações protegidas do painel.'
        : 'Confirmar a remoção da permissão administrativa? A pessoa perderá imediatamente o acesso ao painel.',
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

function installGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const guardedWindow = window as GuardWindow
  if (guardedWindow[installKey]) return
  guardedWindow[installKey] = true

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const critical = criticalConfirmation(event.target)
    if (!critical) return

    if (replaying.has(critical.control)) {
      replaying.delete(critical.control)
      return
    }

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    if (!window.confirm(critical.message)) return

    queueMicrotask(() => {
      replaying.add(critical.control)
      critical.control.click()
    })
  }, true)
}

installGuard()
