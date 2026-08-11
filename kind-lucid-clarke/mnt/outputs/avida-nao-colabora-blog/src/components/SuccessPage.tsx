import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'

interface SuccessPageProps {
  onNavigateDiary: () => void
  onNavigateHome: () => void
  onRefreshProfile: () => Promise<void>
  userPlan?: string
}

const MAX_ATTEMPTS = 15
const INTERVAL_MS = 2000

export default function SuccessPage({ onNavigateDiary, onNavigateHome, onRefreshProfile, userPlan }: SuccessPageProps) {
  const [status, setStatus] = useState<'polling' | 'activated' | 'timeout'>('polling')
  const initialPlan = useRef(userPlan)
  const attempts = useRef(0)

  useEffect(() => {
    const interval = setInterval(async () => {
      attempts.current += 1
      await onRefreshProfile()

      // Detecta mudança de plano (o pai vai re-renderizar com novo userPlan)
      // Ou aceita como ativado após MAX_ATTEMPTS tentativas
      if (attempts.current >= MAX_ATTEMPTS) {
        clearInterval(interval)
        setStatus('timeout')
        return
      }
    }, INTERVAL_MS)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status === 'polling' && userPlan && userPlan !== 'free' && userPlan !== initialPlan.current) {
      setStatus('activated')
    }
  }, [userPlan, status])

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-line max-w-md w-full p-10 text-center">
        <div className="flex justify-center mb-5">
          <CheckCircle className="w-16 h-16 text-forest-600" />
        </div>

        <h1 className="font-serif text-3xl text-forest-900 mb-3">Assinatura confirmada!</h1>
        <p className="text-ink-soft text-sm leading-relaxed mb-2">
          Que bom ter você com a gente! Seu plano já está ativo e você já pode acessar todos os recursos.
        </p>

        {status === 'polling' && (
          <div className="flex items-center justify-center gap-2 text-ink-soft text-xs mt-4 mb-6">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Ativando seu plano...
          </div>
        )}

        {status === 'activated' && (
          <p className="text-forest-600 text-xs font-medium mt-4 mb-6">
            ✓ Plano ativado com sucesso
          </p>
        )}

        {status === 'timeout' && (
          <div className="flex items-start gap-2 bg-paper-soft border border-line rounded-xl px-4 py-3 mt-4 mb-6 text-left">
            <AlertCircle className="w-4 h-4 text-ink-soft mt-0.5 shrink-0" />
            <p className="text-ink-soft text-xs leading-relaxed">
              A ativação pode levar alguns minutos. Se o plano não atualizar em breve, recarregue a página ou entre em contato com o suporte.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={onNavigateDiary}
            className="w-full bg-forest-900 hover:bg-forest-800 text-white py-3 rounded-xl text-sm font-medium transition-colors"
          >
            Abrir meu diário
          </button>
          <button
            onClick={onNavigateHome}
            className="w-full text-ink-soft hover:text-forest-800 text-sm transition-colors"
          >
            Voltar para o início
          </button>
        </div>
      </div>
    </div>
  )
}
