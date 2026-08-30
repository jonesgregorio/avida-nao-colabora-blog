import type { DiscoveryMemory } from './discoveryMemoryStore'
import type { HomeDiscovery } from './homeDiscoveries'

export interface HomeMemoryNudge {
  id: string
  title: string
  description: string
  recognizedAt: string
  stableKey: string
}

function ageInDays(value: string, now: Date) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 864e5))
}

/**
 * Só traz uma memória para Hoje quando uma percepção reconhecida no passado
 * reaparece entre as descobertas sustentadas pelos registros recentes.
 * Memórias novas (< 14 dias) ficam em Descobertas/Minha História para evitar
 * transformar a Home em mural de novidades.
 */
export function buildHomeMemoryNudge(
  memories: DiscoveryMemory[],
  currentDiscoveries: HomeDiscovery[],
  now = new Date(),
): HomeMemoryNudge | null {
  const currentKeys = new Set(currentDiscoveries.map(item => item.stableKey))

  const match = memories
    .filter(memory => currentKeys.has(memory.discovery_key) && ageInDays(memory.recognized_at, now) >= 14)
    .sort((a, b) => new Date(a.recognized_at).getTime() - new Date(b.recognized_at).getTime())[0]

  if (!match) return null

  return {
    id: `memory-return:${match.discovery_key}:${match.recognized_at.slice(0, 10)}`,
    stableKey: match.discovery_key,
    title: match.title,
    description: match.description,
    recognizedAt: match.recognized_at,
  }
}
