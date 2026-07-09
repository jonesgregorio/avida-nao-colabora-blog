import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string, email?: string | null) => {
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
  }

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        setUser(session?.user ?? null)
        if (session?.user) await fetchProfile(session.user.id, session.user.email)
      })
      .catch(() => { /* falha silenciosa — mantém user=null */ })
      .finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, user.email)
  }

  return { user, profile, loading, signOut, refreshProfile }
}
