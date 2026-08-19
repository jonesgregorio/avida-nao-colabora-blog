import { createClient, type User } from 'npm:@supabase/supabase-js@2'

export type AdminAuthResult =
  | { ok: true; user: User }
  | { ok: false; status: number; error: string }

function bearerToken(req: Request): string {
  return (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
}

// O payload só é lido DEPOIS de auth.getUser(token) validar assinatura/expiração.
// Assim o claim `aal` nunca é confiado a partir de um JWT não verificado.
function aalFromVerifiedJwt(token: string): string {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return 'aal1'
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { aal?: unknown }
    return typeof payload.aal === 'string' ? payload.aal : 'aal1'
  } catch {
    return 'aal1'
  }
}

/**
 * Autoriza uma operação administrativa sensível.
 * 1) valida o JWT no Supabase Auth;
 * 2) confirma role=admin no banco;
 * 3) exige AAL2 (senha + TOTP) no MESMO JWT já validado.
 */
export async function requireAdminAal2(req: Request): Promise<AdminAuthResult> {
  const token = bearerToken(req)
  if (!token) return { ok: false, status: 401, error: 'Não autorizado' }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return { ok: false, status: 401, error: 'Não autorizado' }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) return { ok: false, status: 500, error: 'Não foi possível validar a permissão administrativa.' }
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return { ok: false, status: 403, error: 'Apenas admin' }
  }

  if (aalFromVerifiedJwt(token) !== 'aal2') {
    return { ok: false, status: 403, error: 'MFA obrigatório para esta ação administrativa.' }
  }

  return { ok: true, user }
}
