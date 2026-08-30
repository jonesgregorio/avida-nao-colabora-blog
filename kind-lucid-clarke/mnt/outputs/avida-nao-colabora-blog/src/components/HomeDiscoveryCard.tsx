import { useEffect, useState } from 'react'
import { ArrowRight, Eye, History, Sparkles, X } from 'lucide-react'
import type { HomeDiscovery } from '../lib/homeDiscoveries'
import { trackRetentionEvent } from '../lib/retentionAnalytics'
import { supabase } from '../lib/supabase'
import { fetchDiscoveryMemories } from '../lib/discoveryMemoryStore'
import { buildHomeMemoryNudge, type HomeMemoryNudge } from '../lib/homeMemoryNudge'

function recognizedLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

export default function HomeDiscoveryCard({ discovery, onOpenMap, onDismiss, onSeeAll }: {
  discovery: HomeDiscovery
  onOpenMap: () => void
  onDismiss: () => void
  onSeeAll?: () => void
}) {
  const forming = discovery.status === 'forming'
  const analyticsStatus = forming ? 'forming' : 'confirmed'
  const [memoryNudge, setMemoryNudge] = useState<HomeMemoryNudge | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !active) return
        const memories = await fetchDiscoveryMemories(user.id)
        if (!active) return
        setMemoryNudge(buildHomeMemoryNudge(memories, [discovery]))
      } catch {
        if (active) setMemoryNudge(null)
      }
    })()
    return () => { active = false }
  }, [discovery])

  useEffect(() => {
    trackRetentionEvent('discovery_view', {
      dedupeKey: discovery.id,
      metadata: { surface: 'home', status: analyticsStatus, returned_memory: Boolean(memoryNudge) },
    })
  }, [analyticsStatus, discovery.id, memoryNudge])

  function openMap() {
    trackRetentionEvent('discovery_open', {
      dedupeKey: discovery.id,
      metadata: { surface: 'home', status: analyticsStatus, returned_memory: Boolean(memoryNudge) },
    })
    onOpenMap()
  }

  const memoryDate = memoryNudge ? recognizedLabel(memoryNudge.recognizedAt) : null

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 ${memoryNudge ? 'border-forest-100 bg-gradient-to-br from-forest-50 via-paper-soft to-sand-50' : forming ? 'border-line bg-sand-50' : 'border-forest-100 bg-gradient-to-br from-mint/60 via-paper-soft to-white'}`}
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
        <span className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${memoryNudge ? 'bg-white border border-forest-100 text-forest-700' : forming ? 'bg-white border border-line text-forest-700' : 'bg-forest-900 text-white'}`}>
          {memoryNudge ? <History className="w-5 h-5" /> : forming ? <Eye className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">{memoryNudge ? 'Algo voltou a aparecer' : discovery.eyebrow}</p>
          <h2 id="home-discovery-title" className="font-serif text-2xl text-forest-900 mt-1">{memoryNudge ? 'Você já reconheceu isso antes' : discovery.title}</h2>
          {memoryNudge && (
            <div className="mt-3 rounded-2xl border border-forest-100 bg-white/75 px-4 py-3">
              <p className="text-sm font-medium text-forest-900">{discovery.title}</p>
              {memoryDate && <p className="text-xs text-ink-soft mt-1 capitalize">Isso fez sentido para você em {memoryDate} e voltou a aparecer nos sinais recentes.</p>}
            </div>
          )}
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
            {onSeeAll && (
              <button type="button" onClick={onSeeAll} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 px-3 py-2.5 rounded-xl hover:bg-white/70 transition-colors">
                Ver todas as descobertas <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <p className="text-[11px] text-ink-soft mt-4 leading-relaxed">
            {memoryNudge
              ? 'Esta lembrança só aparece porque uma descoberta que você reconheceu no passado voltou a ser sustentada por sinais estruturados recentes. Nenhum trecho do texto livre do Diário é relido aqui.'
              : 'Esta descoberta usa apenas sinais estruturados que você registrou. Ela não relê o texto livre do Diário e não representa diagnóstico.'}
          </p>
        </div>
      </div>
    </section>
  )
}