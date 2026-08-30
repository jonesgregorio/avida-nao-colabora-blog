import { supabase } from './supabase'
import type { HomeDiscovery, HomeDiscoveryKind } from './homeDiscoveries'

export interface DiscoveryMemory {
  id: string
  discovery_key: string
  discovery_kind: HomeDiscoveryKind
  title: string
  description: string
  evidence: string
  question: string
  recognized_at: string
  updated_at: string
}

interface MemoryRow extends DiscoveryMemory {
  user_id: string
}

export async function fetchDiscoveryMemories(userId: string | null | undefined): Promise<DiscoveryMemory[]> {
  if (!userId) return []
  try {
    const { data, error } = await supabase
      .from('user_discovery_memories')
      .select('id,discovery_key,discovery_kind,title,description,evidence,question,recognized_at,updated_at')
      .eq('user_id', userId)
      .order('recognized_at', { ascending: false })
    if (error) return []
    return (data ?? []) as DiscoveryMemory[]
  } catch {
    return []
  }
}

export async function saveDiscoveryMemory(
  userId: string,
  discovery: HomeDiscovery,
): Promise<DiscoveryMemory | null> {
  try {
    const payload = {
      user_id: userId,
      discovery_key: discovery.stableKey,
      discovery_kind: discovery.kind,
      title: discovery.title,
      description: discovery.description,
      evidence: discovery.evidence,
      question: discovery.question,
    }
    const { data, error } = await supabase
      .from('user_discovery_memories')
      .upsert(payload, { onConflict: 'user_id,discovery_key' })
      .select('id,user_id,discovery_key,discovery_kind,title,description,evidence,question,recognized_at,updated_at')
      .maybeSingle()
    if (error || !data) return null
    const row = data as MemoryRow
    return {
      id: row.id,
      discovery_key: row.discovery_key,
      discovery_kind: row.discovery_kind,
      title: row.title,
      description: row.description,
      evidence: row.evidence,
      question: row.question,
      recognized_at: row.recognized_at,
      updated_at: row.updated_at,
    }
  } catch {
    return null
  }
}

export async function deleteDiscoveryMemory(userId: string, discoveryKey: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_discovery_memories')
      .delete()
      .eq('user_id', userId)
      .eq('discovery_key', discoveryKey)
    return !error
  } catch {
    return false
  }
}
