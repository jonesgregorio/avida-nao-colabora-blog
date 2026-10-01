import { supabase } from './supabase'
import { googleErrorMessage, googleRedirectUrl } from './googleAuthRules'

// Cadastro e login com o Google (Supabase Auth, provedor "google").
//
// O botão só aparece quando o provedor está LIGADO no Supabase (Authentication → Providers →
// Google, com o Client ID/Secret do Google Cloud). Enquanto não estiver, nada muda na tela e
// ninguém vê um botão que falharia. Veja docs/LOGIN_GOOGLE.md.

let enabledProbe: Promise<boolean> | null = null

/** true se o provedor Google está ligado no projeto Supabase. Nunca lança. */
export function isGoogleLoginEnabled(): Promise<boolean> {
  if (!enabledProbe) {
    enabledProbe = (async () => {
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
        if (!url || !key) return false
        const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: key } })
        if (!response.ok) return false
        const settings = (await response.json()) as { external?: { google?: boolean } }
        return settings.external?.google === true
      } catch {
        return false
      }
    })()
  }
  return enabledProbe
}

/** Abre o Google. Devolve uma mensagem de erro, ou null quando o navegador foi redirecionado. */
export async function startGoogleSignIn(): Promise<string | null> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: googleRedirectUrl(window.location.origin),
        queryParams: { prompt: 'select_account' },
      },
    })
    return error ? googleErrorMessage(error.message) : null
  } catch (e) {
    return googleErrorMessage(e instanceof Error ? e.message : '')
  }
}
