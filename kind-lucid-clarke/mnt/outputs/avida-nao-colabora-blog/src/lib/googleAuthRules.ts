// Regras puras do login com o Google (sem rede nem Supabase), para ficarem testáveis.

const MINUTE = 60_000
/** Conta criada e primeiro login no mesmo instante (até 1 min) e há pouco tempo = cadastro novo. */
const NEW_USER_WINDOW = 15 * MINUTE
const SAME_MOMENT = MINUTE

export function googleRedirectUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/login?oauth=google`
}

/**
 * Distingue "acabou de se cadastrar com o Google" de "já tinha conta e entrou". O Supabase vincula
 * o Google à conta existente do mesmo e-mail, então uma conta antiga nunca é tratada como nova.
 */
export function isNewOAuthUser(user: { created_at?: string | null; last_sign_in_at?: string | null }, now: number = Date.now()): boolean {
  const created = Date.parse(user.created_at ?? '')
  const last = Date.parse(user.last_sign_in_at ?? '')
  if (Number.isNaN(created) || Number.isNaN(last)) return false
  return Math.abs(last - created) <= SAME_MOMENT && now - created <= NEW_USER_WINDOW
}

/** Mensagem amigável para o retorno com erro do Google/Supabase. */
export function googleErrorMessage(description: string | null | undefined): string {
  const text = String(description ?? '').toLowerCase()
  if (/banned|user_banned/.test(text)) return 'Esta conta está bloqueada. Entre em contato com o suporte pelo e-mail contato@avidanaocolabora.com.br.'
  if (/access_denied|denied|cancel/.test(text)) return 'O acesso com o Google foi cancelado. Você pode tentar de novo ou entrar com e-mail e senha.'
  return 'Não foi possível entrar com o Google agora. Tente de novo ou use e-mail e senha.'
}

