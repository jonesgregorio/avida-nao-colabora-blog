import { useEffect, useMemo, useState } from 'react'
import { Archive, Clock3, RotateCcw, Trash2 } from 'lucide-react'
import type { HomeDiscovery } from '../../lib/homeDiscoveries'
import type { DiscoveryFeedbackMap } from '../../lib/discoveryFeedback'
import {
  deleteDiscoveryMemory,
  fetchDiscoveryMemories,
  saveDiscoveryMemory,
  type DiscoveryMemory,
} from '../../lib/discoveryMemoryStore'

interface Props {
  userId: string | null | undefined
  discoveries: HomeDiscovery[]
  feedback: DiscoveryFeedbackMap
}

function dateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Em algum momento da sua trajetória'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(date)
}

export default function DiscoveryMemoryArchive({ userId, discoveries, feedback }: Props) {
  const [memories, setMemories] = useState<DiscoveryMemory[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const rows = await fetchDiscoveryMemories(userId)
      if (!active) return
      setMemories(rows)
      setLoaded(true)
    })()
    return () => { active = false }
  }, [userId])

  const currentByKey = useMemo(
    () => new Map(discoveries.map(discovery => [discovery.stableKey, discovery])),
    [discoveries],
  )

  const activeMadeSenseKeys = useMemo(
    () => new Set(discoveries
      .filter(discovery => feedback[discovery.stableKey] === 'made_sense')
      .map(discovery => discovery.stableKey)),
    [discoveries, feedback],
  )

  // Backfill seguro: só cria snapshot para uma descoberta que o próprio usuário
  // já marcou como "Fez sentido" e que ainda não possui memória histórica.
  useEffect(() => {
    if (!userId || !loaded) return
    const known = new Set(memories.map(memory => memory.discovery_key))
    const missing = discoveries.filter(discovery =>
      feedback[discovery.stableKey] === 'made_sense' && !known.has(discovery.stableKey)
    )
    if (!missing.length) return
    let active = true
    ;(async () => {
      const saved = (await Promise.all(missing.map(discovery => saveDiscoveryMemory(userId, discovery))))
        .filter((memory): memory is DiscoveryMemory => Boolean(memory))
      if (!active || !saved.length) return
      setMemories(current => {
        const byKey = new Map(current.map(memory => [memory.discovery_key, memory]))
        saved.forEach(memory => byKey.set(memory.discovery_key, memory))
        return [...byKey.values()].sort((a, b) => b.recognized_at.localeCompare(a.recognized_at))
      })
    })()
    return () => { active = false }
  }, [userId, loaded, discoveries, feedback, memories])

  const historical = useMemo(
    () => memories.filter(memory => !activeMadeSenseKeys.has(memory.discovery_key)),
    [memories, activeMadeSenseKeys],
  )

  async function remove(memory: DiscoveryMemory) {
    if (!userId) return
    const previous = memories
    setMemories(current => current.filter(item => item.id !== memory.id))
    const ok = await deleteDiscoveryMemory(userId, memory.discovery_key)
    if (!ok) setMemories(previous)
  }

  if (!loaded || historical.length === 0) return null

  return (
    <section className="rounded-3xl border border-line bg-sand-50 p-5 sm:p-6" aria-labelledby="discovery-memory-heading">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-2xl border border-line bg-white text-forest-700 flex items-center justify-center flex-shrink-0">
          <Archive className="w-5 h-5" />
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Memória da sua trajetória</p>
          <h2 id="discovery-memory-heading" className="font-serif text-2xl text-forest-900 mt-0.5">O que já fez sentido antes</h2>
          <p className="text-sm text-ink-soft mt-1 leading-relaxed max-w-2xl">
            Estas memórias continuam aqui mesmo quando uma descoberta deixa de aparecer na janela recente. São snapshots do que você reconheceu naquele momento — não uma meta para manter.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {historical.map(memory => {
          const current = currentByKey.get(memory.discovery_key)
          return (
            <article key={memory.id} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] font-semibold text-forest-600">
                      <Clock3 className="w-3.5 h-3.5" /> Reconhecida em {dateLabel(memory.recognized_at)}
                    </span>
                    {current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-forest-700">
                        <RotateCcw className="w-3 h-3" /> Voltou a aparecer
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-lg text-forest-900 mt-1.5">{memory.title}</h3>
                  <p className="text-sm text-ink-soft mt-2 leading-relaxed">{memory.description}</p>
                  <p className="text-xs text-ink-soft mt-2">Evidência guardada naquele momento: {memory.evidence}</p>
                  <p className="text-sm text-forest-800 mt-3">Para revisitar: {memory.question}</p>
                  {current && (
                    <p className="text-xs text-forest-700 mt-3">
                      Um padrão com a mesma chave voltou a ser sustentado pelos seus registros recentes. Isso não significa causa nem diagnóstico.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(memory)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-paper-soft px-3 py-2 text-xs font-medium text-ink-soft hover:text-[#8a3b23] hover:border-coral transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remover da memória
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <p className="text-[11px] text-ink-soft mt-4 leading-relaxed">
        O arquivo guarda apenas o snapshot estruturado da descoberta e a data em que ela foi reconhecida. Nenhum trecho do texto livre do Diário é copiado para esta memória.
      </p>
    </section>
  )
}
