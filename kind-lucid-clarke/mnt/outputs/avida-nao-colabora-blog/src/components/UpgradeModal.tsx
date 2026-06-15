import { X, Heart } from 'lucide-react'
import type { Plan, View } from '../types'

const planLabels: Record<Plan, string> = {
  free: 'Gratuito',
  essential: 'Essencial',
  therapeutic: 'Terapêutico',
  'therapeutic-plus': 'Terapêutico Plus',
}

const planColors: Record<Plan, string> = {
  free: 'emerald',
  essential: 'emerald',
  therapeutic: 'blue',
  'therapeutic-plus': 'purple',
}

interface Props {
  isOpen?: boolean
  feature?: string
  featureName?: string
  requiredPlan: Plan
  onClose: () => void
  navigate: (v: View) => void
}

export function UpgradeModal({ isOpen, feature, featureName, requiredPlan, onClose, navigate }: Props) {
  const displayFeature = featureName || feature || 'Este recurso'
  const color = planColors[requiredPlan]

  if (isOpen === false) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-full bg-${color}-100 flex items-center justify-center`}>
              <Heart className={`w-5 h-5 text-${color}-600`} />
            </div>
            <h3 className="font-bold text-stone-800 text-lg">
              Recurso do plano {planLabels[requiredPlan]}
            </h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 ml-2">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <p className="text-stone-600 mb-2">
          <strong>{displayFeature}</strong> está disponível a partir do plano{' '}
          <strong>{planLabels[requiredPlan]}</strong>.
        </p>
        <p className="text-stone-500 text-sm mb-6 leading-relaxed">
          Faz sentido que você queira ir mais fundo. Você pode continuar usando os recursos
          gratuitos no seu ritmo, ou dar um passo a mais conhecendo os planos disponíveis.
          Sem pressão — o que funciona melhor para você agora?
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-lg text-sm hover:bg-stone-50 transition-colors"
          >
            Continuar com o plano gratuito
          </button>
          <button
            onClick={() => {
              navigate('pricing')
              onClose()
            }}
            className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Ver planos
          </button>
        </div>
      </div>
    </div>
  )
}

export default UpgradeModal
