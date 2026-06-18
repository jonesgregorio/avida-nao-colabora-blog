import { DollarSign } from 'lucide-react'

export default function AdminFinancial() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Gestão Financeira</h1>
      <div className="text-center py-20 text-stone-400">
        <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="font-medium text-stone-600 mb-2">Em breve</p>
        <p className="text-sm max-w-sm mx-auto">
          Receita por plano, assinaturas ativas, churn, MRR, histórico de pagamentos e integração
          com gateway de pagamento (Stripe / Pagar.me).
        </p>
      </div>
    </div>
  )
}
