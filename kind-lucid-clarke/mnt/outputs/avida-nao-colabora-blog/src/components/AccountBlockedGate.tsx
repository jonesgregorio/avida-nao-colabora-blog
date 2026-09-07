import { LogOut, ShieldAlert } from 'lucide-react'

interface Props {
  status: 'blocked' | 'suspended'
  reason?: string | null
  onSignOut: () => void
}

// Barreira mostrada quando profiles.account_status é 'blocked' ou 'suspended'.
// Roda antes de qualquer UserLayout, então uma conta bloqueada não acessa nada
// da área logada — apenas esta tela e o botão de sair.
export default function AccountBlockedGate({ status, reason, onSignOut }: Props) {
  const isSuspended = status === 'suspended'
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-paper-soft border border-line rounded-3xl p-7 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-coral/25 text-[#c05f3c] flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="font-serif text-2xl text-forest-900">
          {isSuspended ? 'Conta temporariamente suspensa' : 'Conta bloqueada'}
        </h1>
        <p className="text-sm text-ink-soft mt-2 leading-relaxed">
          {isSuspended
            ? 'Sua conta está suspensa e o acesso está pausado no momento. Se você acha que isso é um engano, entre em contato com o suporte.'
            : 'O acesso a esta conta foi bloqueado. Se você acha que isso é um engano, entre em contato com o suporte.'}
        </p>

        {reason && (
          <div className="mt-4 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink-soft">
            <span className="font-medium text-forest-900">Motivo informado:</span> {reason}
          </div>
        )}

        <p className="mt-4 text-xs text-ink-soft">
          Suporte: <a href="mailto:contato@avidanaocolabora.com.br" className="text-forest-800 underline underline-offset-2">contato@avidanaocolabora.com.br</a>
        </p>

        <button
          type="button"
          onClick={onSignOut}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 border border-line rounded-2xl py-2.5 text-sm text-ink-soft hover:text-forest-900 hover:bg-mint/40 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </div>
  )
}
