import { useState } from 'react'
import { marketingConsent, setMarketingConsent, trackMetaPageView, type MarketingConsent } from '../lib/metaConversions'

export default function MarketingConsentBanner() {
  const [consent, setConsent] = useState<MarketingConsent>(() => marketingConsent())

  if (consent !== null) return null

  const choose = (value: Exclude<MarketingConsent, null>) => {
    setMarketingConsent(value)
    setConsent(value)
    if (value === 'granted') trackMetaPageView()
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-line bg-white p-4 shadow-xl sm:flex sm:items-center sm:justify-between sm:gap-5" aria-label="Preferências de medição">
      <p className="text-xs leading-relaxed text-ink-soft">
        Usamos medição anônima própria. Com sua permissão, a Meta também mede visitas e cadastros confirmados para avaliar anúncios. Nunca enviamos respostas do diário ou do check-in. <a href="/privacidade" className="font-medium text-forest-800 underline underline-offset-2">Saiba mais</a>.
      </p>
      <div className="mt-3 flex flex-none gap-2 sm:mt-0">
        <button type="button" onClick={() => choose('denied')} className="rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink-soft hover:text-forest-900">Só essenciais</button>
        <button type="button" onClick={() => choose('granted')} className="rounded-xl bg-forest-900 px-3 py-2 text-xs font-medium text-white hover:bg-forest-800">Permitir medição</button>
      </div>
    </aside>
  )
}
