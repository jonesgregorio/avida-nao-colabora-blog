import { useEffect } from 'react'
import { ArrowRight, Eye, Sparkles, X } from 'lucide-react'
import type { HomeDiscovery } from '../lib/homeDiscoveries'
import { trackRetentionEvent } from '../lib/retentionAnalytics'

export default function HomeDiscoveryCard({ discovery, onOpenMap, onDismiss }: {
  discovery: HomeDiscovery
  onOpenMap: () => void
  onDismiss: () => void
}) {
  const forming = discovery.status === 'forming'
  const analyticsStatus = forming ? 'forming' : 'confirmed'

  useEffect(() => {
    trackRetentionEvent('discovery_view', {
      dedupeKey: discovery.id,
      metadata: { surface: 'home', status: analyticsStatus },
    })
  }, [analyticsStatus, discovery.id])

  function openMap() {
    trackRetentionEvent('discovery_open', {
      dedupeKey: discovery.id,
      metadata: { surface: 'home', status: analyticsStatus },
    })
    onOpenMap()
  }

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 ${forming ? 'border-line bg-sand-50' : 'border-forest-100 bg-gradient-to-br from-mint/60 via-paper-soft to-white'}`}
      aria-labelledby="home-discovery-title"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Ocultar esta descoberta hoje"
        className="absolute right-4 top-4 rounded-xl p-2 text-ink-soft hover:bg-white/70 hover:text-forest-900 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4 pr-8">
        <span className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${forming ? 'bg-white border border-line text-forest-700' : 'bg-forest-900 text-white'}`}>
          {forming ? <Eye className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">{discovery.eyebrow}</p>
          <h2 id="home-discovery-title" className="font-serif text-2xl text-forest-900 mt-1">{discovery.title}</h2>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-3xl">{discovery.description}</p>

          <div className="mt-4 rounded-2xl border border-line bg-white/75 px-4 py-3">
            <p className="text-xs leading-relaxed text-ink-soft"><strong className="font-semibold text-forest-900">Base desta observação:</strong> {discovery.evidence}</p>
          </div>

          <p className="mt-4 font-serif text-lg text-forest-900">{discovery.question}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openMap}
              className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors"
            >
              Ver no Mapa Emocional <ArrowRight className="w-4 h-4" />
            </button>
            <button type="button" onClick={onDismiss} className="text-sm font-medium text-forest-700 px-3 py-2.5 rounded-xl hover:bg-white/70 transition-colors">Agora não</button>
          </div>

          <p className="text-[11px] text-ink-soft mt-4 leading-relaxed">
            Esta descoberta usa apenas sinais estruturados que você registrou. Ela não relê o texto livre do Diário e não representa diagnóstico.
          </p>
        </div>
      </div>
    </section>
  )
}
