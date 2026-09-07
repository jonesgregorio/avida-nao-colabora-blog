import { supabase } from './supabase'

// Feature flags (Etapa 12). Avaliadas no servidor para o usuário atual; o
// cliente só lê o resultado { chave: bool } e escolhe o que mostrar.
//
// Falha-segura: se a RPC não existir ou der erro, devolve o último valor
// conhecido (ou {}), e `isFeatureEnabled` usa o fallback que o chamador passar —
// nunca "some" com uma funcionalidade já publicada por causa de indisponibilidade.

export type FlagMap = Record<string, boolean>

let cache: FlagMap = {}
let inflight: Promise<FlagMap> | null = null

function currentEnv(): string {
  try {
    return (import.meta as { env?: { PROD?: boolean } }).env?.PROD ? 'production' : 'preview'
  } catch {
    return 'production'
  }
}

export async function fetchFeatureFlags(force = false): Promise<FlagMap> {
  if (!force && inflight) return inflight
  inflight = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_active_feature_flags', { p_env: currentEnv() })
      if (error || !data || typeof data !== 'object') return cache
      cache = data as FlagMap
      return cache
    } catch {
      return cache
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function isFeatureEnabled(flags: FlagMap | null | undefined, key: string, fallback = false): boolean {
  if (!flags || !(key in flags)) return fallback
  return flags[key] === true
}

export function cachedFlags(): FlagMap {
  return cache
}
