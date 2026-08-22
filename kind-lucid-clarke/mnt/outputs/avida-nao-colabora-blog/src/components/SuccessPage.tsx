import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface SuccessPageProps {
  onNavigateDiary: () => void
  onNavigateHome: () => void
  onRefreshProfile: () => Promise<void>
  userPlan?: string
}

const MAX_ATTEMPTS = 15
const INTERVAL_MS = 2000

export default function SuccessPage({ onNavigateDiary, onNavigateHome, onRefreshProfile }: SuccessPageProps) {
  const [status, setStatus] = useState<'processing' | 'confirmed' | 'error' | 'timeout'>('processing')
  const attempts = useRef(0)

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    if (!sessionId) {
      setStatus('error')
      return
    }

    let cancelled = false
    const checkConfirmation = async () => {
      attempts.current += 1
      const { data, error } = await supabase.functions.invoke('checkout-session-status', {
        body: { session_id: sessionId },
      })
      if (cancelled) return

      if (error || data?.error) {
        setStatus('error')
        clearInterval(interval)
        return
      }
      if (data?.status === 'confirmed') {
        await onRefreshProfile()
        if (!cancelled) setStatus('confirmed')
        clearInterval(interval)
        return
      }

      if (attempts.current >= MAX_ATTEMPTS) {
        setStatus('timeout')
        clearInterval(interval)
      }
    }

    void checkConfirmation()
    const interval = setInterval(() => { void checkConfirmation() }, INTERVAL_MS)

    return () => { cancelled = true; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-line max-w-md w-full p-10 text-center">
        <div className="flex justify-center mb-5">
          {status === 'confirmed' ? <CheckCircle className="w-16 h-16 text-forest-600" /> : <Loader2 className="w-16 h-16 text-forest-600 animate-spin" />}
        </div>

        {status === 'processing' && (
          <>
            <h1 className="font-serif text-3xl text-forest-900 mb-3">Estamos confirmando seu pagamento</h1>
            <p className="text-ink-soft text-sm leading-relaxed mb-2">Pagamento recebido. Estamos ativando seu plano.</p>
          <div className="flex items-center justify-center gap-2 text-ink-soft text-xs mt-4 mb-6">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Aguardando a confirmação segura...
          </div>
          </>
        )}

        {status === 'confirmed' && (
          <>
            <h1 className="font-serif text-3xl text-forest-900 mb-3">Assinatura confirmada.</h1>
            <p className="text-ink-soft text-sm leading-relaxed mb-6">Seu plano está ativo e os recursos correspondentes já estão disponíveis.</p>
          </>
        )}

        {(status === 'error' || status === 'timeout') && (
          <div className="flex items-start gap-2 bg-paper-soft border border-line rounded-xl px-4 py-3 mt-4 mb-6 text-left">
            <AlertCircle className="w-4 h-4 text-ink-soft mt-0.5 shrink-0" />
            <p className="text-ink-soft text-xs leading-relaxed">
              Não conseguimos confirmar automaticamente. Seu pagamento não será ativado por esta página; o Stripe e o webhook continuam verificando a assinatura. Se o plano não atualizar em alguns minutos, entre em contato com o suporte.
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
