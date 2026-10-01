import type { Profile } from '../types'

// Regras do aviso "Como você gostaria de ser chamado(a)?" (components/user/NamePrompt.tsx).

export const NAME_PROMPT_MAX_ASKS = 3
export const NAME_PROMPT_RETRY_AFTER_MS = 3 * 24 * 60 * 60 * 1000
export const NAME_PROMPT_MAX_NAME = 60

/** true quando o perfil ainda não tem nenhum nome. */
export function profileHasNoName(profile: Pick<Profile, 'preferred_name' | 'display_name' | 'full_name'> | null | undefined): boolean {
  if (!profile) return false
  return ![profile.preferred_name, profile.display_name, profile.full_name].some((v) => typeof v === 'string' && v.trim())
}

/** Remove caracteres de controle, normaliza espaços e limita o tamanho. */
export function cleanName(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_PROMPT_MAX_NAME)
}

/** Decide se o aviso pode aparecer agora, dado o histórico de vezes que já foi dispensado. */
export function shouldAskName(state: { count: number; last: number }, now: number): boolean {
  if (state.count >= NAME_PROMPT_MAX_ASKS) return false
  if (state.count > 0 && now - state.last < NAME_PROMPT_RETRY_AFTER_MS) return false
  return true
}
