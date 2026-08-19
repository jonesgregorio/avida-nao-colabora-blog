export interface ConfirmableUser {
  email_confirmed_at?: string | null
  confirmed_at?: string | null
}

export function isEmailConfirmed(user: ConfirmableUser | null | undefined): boolean {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at)
}

export function isEmailNotConfirmedError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null
  const code = String(candidate?.code ?? '').toLowerCase()
  const message = String(candidate?.message ?? '').toLowerCase()
  return code === 'email_not_confirmed'
    || message.includes('email not confirmed')
    || message.includes('email_not_confirmed')
}

export function confirmationRedirectUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/login?email_confirmed=1`
}
