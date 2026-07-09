import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Profile as ProfileType } from '../types'
import {
  Camera, Save, Key, LogOut, CheckCircle2, Flame, AlertTriangle, Check,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import PlanBadge from './PlanBadge'
import { SupportCard } from './user/ui'

interface ProfileProps {
  user: User | null
  profile: ProfileType | null
  onBack: () => void
  onNavigatePricing: () => void
  onRefreshProfile: () => void
}

export default function ProfilePage({ user, profile, onBack, onNavigatePricing, onRefreshProfile }: ProfileProps) {
  const [displayName, setDisplayName] = useState(profile?.display_name || profile?.full_name || '')
  const [preferredName, setPreferredName] = useState(profile?.preferred_name || '')
  const [statusPhrase, setStatusPhrase] = useState(profile?.status_phrase || '')
  const [notificationFrequency, setNotificationFrequency] = useState(profile?.notification_frequency || 'weekly')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [stats, setStats] = useState({ checkins: 0, streak: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile?.display_name || profile?.full_name || '')
      setPreferredName(profile?.preferred_name || '')
      setStatusPhrase(profile?.status_phrase || '')
      setNotificationFrequency(profile?.notification_frequency || 'weekly')
      setAvatarUrl(profile?.avatar_url || '')
    }
  }, [profile])

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const entriesRes = await supabase.from('diary_entries').select('date,entry_type').eq('user_id', user.id)
      if (!active) return
      const days = new Set((entriesRes.data ?? []).filter(e => (e as { entry_type?: string }).entry_type === 'diary').map(e => String((e as { date?: string }).date ?? '').slice(0, 10)))
      // sequência de dias consecutivos terminando hoje/ontem
      const d = new Date()
      if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1)
      let streak = 0
      while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1) }
      setStats({ checkins: days.size, streak })
    })()
    return () => { active = false }
  }, [user])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'err', text: 'A imagem deve ter no máximo 2MB.' })
      return
    }
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${user!.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!uploadError) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      const { error: rpcError } = await supabase.rpc('update_my_profile', { p_avatar_url: url })
      if (!rpcError) {
        setAvatarUrl(url)
        onRefreshProfile()
        setMsg({ type: 'ok', text: 'Foto atualizada.' })
      } else {
        setMsg({ type: 'err', text: 'Erro ao salvar a foto: ' + rpcError.message })
      }
    } else {
      setMsg({ type: 'err', text: 'Erro ao enviar a foto: ' + uploadError.message })
    }
    setUploadingAvatar(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.rpc('update_my_profile', {
      p_full_name: displayName,
      p_display_name: displayName,
      p_preferred_name: preferredName,
      p_status_phrase: statusPhrase,
      p_notification_frequency: notificationFrequency,
    })
    if (error) {
      setMsg({ type: 'err', text: 'Erro ao salvar o perfil: ' + error.message })
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onRefreshProfile()
      setMsg({ type: 'ok', text: 'Alterações salvas.' })
    }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordMsg('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setPasswordMsg('Erro: ' + error.message)
    else {
      setPasswordMsg('Senha alterada com sucesso!')
      setNewPassword('')
      setShowPasswordForm(false)
      setMsg({ type: 'ok', text: 'Senha alterada com sucesso.' })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onBack()
  }

  const name = displayName || preferredName || user?.email?.split('@')[0] || 'você'
  const initials = (preferredName || displayName || user?.email || 'U').slice(0, 2).toUpperCase()
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-line bg-white text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 focus:border-forest-300 transition-colors'

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900">Meu perfil</h1>
        <p className="mt-2 text-ink-soft">Gerencie suas informações e preferências de conta.</p>
      </header>

      {msg && (
        <div className={`mb-5 flex items-start gap-2 px-4 py-3 rounded-2xl border text-sm ${msg.type === 'ok' ? 'bg-mint/60 border-forest-100 text-forest-800' : 'bg-coral/20 border-coral/40 text-[#8a3b23]'}`}>
          {msg.type === 'err' ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <span className="flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 lg:gap-6">
        {/* ─── Coluna principal ─── */}
        <div className="space-y-5 min-w-0">
          {/* Cartão do perfil */}
          <div className="bg-paper-soft border border-line rounded-3xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="relative flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-sm" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-mint flex items-center justify-center border-4 border-white shadow-sm">
                  <span className="text-2xl font-semibold text-forest-700">{initials}</span>
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Trocar foto"
                className="absolute bottom-0 right-0 bg-forest-900 text-white p-2 rounded-full shadow-md hover:bg-forest-800 disabled:opacity-60"
              >
                <Camera size={14} />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} aria-label="Enviar foto de perfil" className="hidden" />
            </div>
            <div className="text-center sm:text-left flex-1 min-w-0">
              <h2 className="font-serif text-2xl text-forest-900">{name}</h2>
              <p className="text-sm text-ink-soft mt-0.5 break-words">{user?.email}</p>
              {memberSince && <p className="text-xs text-ink-soft mt-1 capitalize">Membro desde {memberSince}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <PlanBadge plan={profile?.plan} member size="sm" />
                {uploadingAvatar && <span className="text-xs text-ink-soft">Enviando foto…</span>}
              </div>
              {statusPhrase && <p className="text-sm text-forest-700 italic mt-3">"{statusPhrase}"</p>}
            </div>
          </div>

          {/* Configurações da conta */}
          <section className="bg-paper-soft border border-line rounded-3xl p-6">
            <h2 className="font-serif text-lg sm:text-xl text-forest-900 mb-4">Configurações da conta</h2>
            <div className="space-y-4">
              <Field label="E-mail">
                <input value={user?.email || ''} disabled className={`${inputCls} bg-mint/30 text-ink-soft`} />
              </Field>
              <Field label="Nome completo">
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls} placeholder="Seu nome" />
              </Field>
              <Field label="Como prefere que a gente te chame?">
                <input value={preferredName} onChange={e => setPreferredName(e.target.value)} className={inputCls} placeholder="Ex.: Mari, Rafa, Carol…" />
              </Field>
              <Field label="Frase de status" hint="(opcional)">
                <input value={statusPhrase} onChange={e => setStatusPhrase(e.target.value)} maxLength={80} className={inputCls} placeholder="Ex.: Hoje eu estou tentando com calma." />
              </Field>
              <Field label="Frequência de lembretes">
                <select value={notificationFrequency} onChange={e => setNotificationFrequency(e.target.value)} className={inputCls}>
                  <option value="daily">Diária</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                  <option value="never">Nunca</option>
                </select>
              </Field>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 bg-forest-900 text-white py-3 rounded-2xl font-medium hover:bg-forest-800 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Salvando…' : saved ? '✓ Salvo!' : 'Salvar alterações'}
              </button>
            </div>
          </section>

          {/* Segurança */}
          <section className="bg-paper-soft border border-line rounded-3xl p-6">
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="flex items-center gap-2 text-forest-700 hover:text-forest-900 font-medium text-sm"
            >
              <Key size={16} /> Alterar senha
            </button>
            {showPasswordForm && (
              <div className="mt-4 space-y-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Nova senha (mínimo 6 caracteres)"
                  className={inputCls}
                />
                <button onClick={handleChangePassword} className="bg-forest-800 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-forest-900 transition-colors">
                  Confirmar nova senha
                </button>
                {passwordMsg && <p className="text-sm text-forest-600">{passwordMsg}</p>}
              </div>
            )}
          </section>

          {/* Sair */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-600 py-3 border border-red-200 rounded-2xl hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} /> Sair da conta
          </button>
        </div>

        {/* ─── Coluna lateral ─── */}
        <aside className="space-y-5">
          <div className="bg-paper-soft border border-line rounded-3xl p-5">
            <h2 className="font-serif text-lg text-forest-900 mb-4">Resumo da sua jornada</h2>
            <div className="space-y-3">
              <JourneyStat icon={<CheckCircle2 className="w-4 h-4" />} value={stats.checkins} label="check-ins realizados" />
              <JourneyStat icon={<Flame className="w-4 h-4" />} value={stats.streak} label={stats.streak === 1 ? 'dia seguido' : 'dias seguidos'} />
            </div>
          </div>

          <SupportCard onClick={onNavigatePricing} title="Precisa de apoio?" text="Nossa equipe está aqui para te ouvir." />

          <div className="bg-paper-soft border border-line rounded-3xl p-5">
            <p className="font-serif text-lg text-forest-900 leading-snug">"Cuidar de mim não é egoísmo, é sobrevivência."</p>
            <p className="text-xs text-ink-soft mt-3">A Vida Não Colabora</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-forest-800 mb-1.5">
        {label} {hint && <span className="text-ink-soft font-normal">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function JourneyStat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0">{icon}</span>
      <p className="text-sm">
        <span className="font-semibold text-forest-900">{value}</span> <span className="text-ink-soft">{label}</span>
      </p>
    </div>
  )
}
