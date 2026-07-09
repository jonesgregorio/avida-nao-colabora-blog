import { useEffect, useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'

interface SuccessPageProps {
  onNavigateDiary: () => void
  onNavigateHome: () => void
  onRefreshProfile: () => Promise<void>
}

export default function SuccessPage({ onNavigateDiary, onNavigateHome, onRefreshProfile }: SuccessPageProps) {
  const [refreshed, setRefreshed] = useState(false)

  useEffect(() => {
    // Aguarda o webhook processar e atualiza o perfil local
    const timer = setTimeout(async () => {
      await onRefreshProfile()
      setRefreshed(true)
    }, 3000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 max-w-md w-full p-10 text-center">
        <div className="flex justify-center mb-5">
          <CheckCircle className="w-16 h-16 text-emerald-500" />
        </div>

        <h1 className="font-serif text-3xl text-sage-800 mb-3">Assinatura confirmada!</h1>
        <p className="text-sage-500 text-sm leading-relaxed mb-2">
          Que bom ter você com a gente! Seu plano já está ativo e você já pode acessar todos os recursos.
        </p>

        {!refreshed && (
          <div className="flex items-center justify-center gap-2 text-sage-400 text-xs mt-4 mb-6">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Ativando seu plano...
          </div>
        )}

        {refreshed && (
          <p className="text-emerald-600 text-xs font-medium mt-4 mb-6">
            ✓ Plano ativado com sucesso
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={onNavigateDiary}
            className="w-full bg-sage-600 hover:bg-sage-700 text-white py-3 rounded-xl text-sm font-medium transition-colors"
          >
            Abrir meu diário
          </button>
          <button
            onClick={onNavigateHome}
            className="w-full text-sage-500 hover:text-sage-700 text-sm transition-colors"
          >
            Voltar para o início
          </button>
        </div>
      </div>
    </div>
  )
}
