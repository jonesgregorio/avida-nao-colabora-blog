import { useCallback, useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { isEmailConfirmed } from '../lib/authVerification'
import { clearSensitiveDrafts } from '../lib/sensitiveDraftStorage'
import { Profile } from '../types'

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

  const acceptConfirmedUser = useCallback(async (candidate: User | null) => {
    if (!candidate || !isEmailConfirmed(candidate)) {
      setUser(null)
      setProfile(null)
      if (candidate) void supabase.auth.signOut().catch(() => undefined)
      return false
    }

    setUser(candidate)
    await fetchProfile(candidate.id, candidate.email)
    return true
  }, [fetchProfile])

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        const accepted = await acceptConfirmedUser(session?.user ?? null)
        if (accepted) {
          // Registra o acesso (096). A RPC ignora se foi tocado há < 1h e nunca
          // quebra o boot — o motor de lembretes usa isso para não e-mailar quem
          // está no site, mesmo sem registrar check-in/diário.
          void supabase.rpc('touch_last_seen').then(() => {}, () => {})
        }
      })
      .catch(() => { /* falha silenciosa — mantém user=null */ })
      .finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') clearSensitiveDrafts()
      void acceptConfirmedUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [acceptConfirmedUser])

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
