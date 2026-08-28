import { useCallback, useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { isEmailConfirmed } from '../lib/authVerification'
import { clearSensitiveDrafts } from '../lib/sensitiveDraftStorage'
import { Profile } from '../types'

const AUTH_BOOT_TIMEOUT_MS = 8_000

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string, email?: string | null) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // Cria um perfil básico automaticamente quando o usuário existe mas não tem
      // perfil (§15) — assim a área logada sempre funciona.
      const displayName = email ? email.split('@')[0] : ''
      const { data: newProfile } = await supabase
        .from('profiles')
        .upsert(
          { user_id: userId, plan: 'free', full_name: '', display_name: displayName },
          { onConflict: 'user_id', ignoreDuplicates: true },
        )
        .select()
        .single()
      setProfile(newProfile)
    } else {
      setProfile(data)
    }
  }, [])

  const acceptConfirmedUser = useCallback(async (candidate: User | null, waitForProfile = true) => {
    if (!candidate || !isEmailConfirmed(candidate)) {
      setUser(null)
      setProfile(null)
      if (candidate) void supabase.auth.signOut().catch(() => undefined)
      return false
    }

    setUser(candidate)
    const profilePromise = fetchProfile(candidate.id, candidate.email)
    if (waitForProfile) {
      await profilePromise
    } else {
      // O perfil complementa a sessão, mas não pode bloquear o shell inteiro.
      // Uma lentidão no PostgREST/Auth não deve deixar o blog preso no loader.
      void profilePromise.catch(() => setProfile(null))
    }
    return true
  }, [fetchProfile])

  const handleAuthCandidate = useCallback(async (event: string, candidate: User | null) => {
    // Fluxo oficial Supabase: resetPasswordForEmail cria uma sessão e emite
    // PASSWORD_RECOVERY. Marcamos o perfil ANTES de recarregá-lo para que o gate
    // já existente em App.tsx mostre ForceChangePassword e conclua updateUser.
    if (event === 'PASSWORD_RECOVERY' && candidate && isEmailConfirmed(candidate)) {
      const { error } = await supabase.rpc('mark_password_recovery_required')
      if (error) {
        console.error('Não foi possível iniciar a troca obrigatória de senha:', error.message)
      }
    }
    return acceptConfirmedUser(candidate)
  }, [acceptConfirmedUser])

  useEffect(() => {
    let active = true
    // Auth pode ficar aguardando refresh/lock entre abas. O app nunca deve ficar
    // eternamente bloqueado no loader global por causa disso.
    const bootTimeout = window.setTimeout(() => {
      if (active) setLoading(false)
    }, AUTH_BOOT_TIMEOUT_MS)

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!active) return
        // Assim que a sessão é conhecida, libera o shell; o perfil termina em
        // segundo plano e continua sendo atualizado normalmente.
        const accepted = await acceptConfirmedUser(session?.user ?? null, false)
        if (accepted) {
          // Registra o acesso (096). A RPC ignora se foi tocado há < 1h e nunca
          // quebra o boot — o motor de lembretes usa isso para não e-mailar quem
          // está no site, mesmo sem registrar check-in/diário.
          void supabase.rpc('touch_last_seen').then(() => {}, () => {})
        }
      })
      .catch(() => { /* falha silenciosa — mantém user=null */ })
      .finally(() => {
        window.clearTimeout(bootTimeout)
        if (active) setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') clearSensitiveDrafts()
      void handleAuthCandidate(event, session?.user ?? null)
    })

    return () => {
      active = false
      window.clearTimeout(bootTimeout)
      subscription.unsubscribe()
    }
  }, [acceptConfirmedUser, handleAuthCandidate])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      clearSensitiveDrafts()
      setUser(null)
      setProfile(null)
    }
  }

  const refreshProfile = async () => {
    if (user && isEmailConfirmed(user)) await fetchProfile(user.id, user.email)
  }

  return { user, profile, loading, signOut, refreshProfile }
}
