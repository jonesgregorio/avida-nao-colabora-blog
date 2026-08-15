import { LifeBuoy, Heart } from 'lucide-react'
import { RISK_HELP } from '../lib/contentRecommendation'

// Bloco de acolhimento exibido no lugar de conteúdo/recomendações quando
// detectRisk() identifica linguagem de risco (§15). Compartilhado entre
// RecommendedContent (check-in/diário/autocuidado/relatórios) e qualquer outra
// superfície de texto livre (ex.: Orientação por mensagem) — mesma mensagem,
// mesmos contatos, em vez de duplicar o bloco em cada lugar.
export default function RiskHelpBanner() {
  return (
    <section className="rounded-3xl border border-coral/50 bg-coral/10 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[#7a3320] mb-2">
        <LifeBuoy className="w-5 h-5" />
        <h2 className="font-serif text-lg sm:text-xl">{RISK_HELP.title}</h2>
      </div>
      <p className="text-sm text-ink leading-relaxed mb-3">{RISK_HELP.message}</p>
      <ul className="space-y-1.5 text-sm text-ink">
        <li className="flex gap-2"><Heart className="w-4 h-4 text-[#7a3320] flex-shrink-0 mt-0.5" /> {RISK_HELP.cvv}</li>
        <li className="flex gap-2"><Heart className="w-4 h-4 text-[#7a3320] flex-shrink-0 mt-0.5" /> {RISK_HELP.emergency}</li>
      </ul>
    </section>
  )
}
