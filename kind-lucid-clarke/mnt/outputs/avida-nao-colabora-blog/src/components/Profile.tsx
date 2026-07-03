import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Profile as ProfileType } from '../types'
import { ArrowLeft, Camera, Crown, TrendingUp, Save, Key, LogOut } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

interface ProfileProps {
  user: User | null
  profile: ProfileType | null
  onBack: () => void
  onNavigatePricing: () => void
  onRefreshProfile: () => void
}

const planInfo: Record<string, { label: string; color: string; price: string }> = {
  free: { label: 'Gratuito', color: 'bg-stone-100 text-stone-600', price: 'R$ 0' },
  essential: { label: 'Essencial', color: 'bg-blue-100 text-blue-700', price: 'R$ 19,90/mês' },
  therapeutic: { label: 'Terapêutico', color: 'bg-emerald-100 text-emerald-700', price: 'R$ 39,90/mês' },
  'therapeutic-plus': { label: 'Terapêutico Plus', color: 'bg-purple-100 text-purple-700', price: 'R$ 79,90/mês' },
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Imagem deve ter no máximo 2MB')
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
      } else {
        alert('Erro ao salvar avatar: ' + rpcError.message)
      }
    } else {
      alert('Erro ao fazer upload: ' + uploadError.message)
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
      alert('Erro ao salvar perfil: ' + error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onRefreshProfile()
    }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordMsg('A senha deve ter pelo menos 6 caracteres')
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setPasswordMsg('Erro: ' + error.message)
    else {
      setPasswordMsg('Senha alterada com sucesso!')
      setNewPassword('')
      setShowPasswordForm(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onBack()
  }

  const plan = profile?.plan || 'free'
  const planDetails = planInfo[plan] || planInfo.free

  const initials = (preferredName || displayName || user?.email || 'U').slice(0, 2).toUpperCase()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="font-serif text-3xl text-sage-800 mb-8">Meu perfil</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Foto de perfil" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-sage-100 flex items-center justify-center border-4 border-white shadow-md">
              <span className="text-2xl font-bold text-sage-600">{initials}</span>
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute bottom-0 right-0 bg-sage-600 text-white p-2 rounded-full shadow-md hover:bg-sage-700"
          >
            <Camera size={14} />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
        {uploadingAvatar && <p className="text-sm text-stone-500 mt-2">Enviando foto...</p>}
        {statusPhrase && <p className="text-sage-500 italic text-sm mt-3">"{statusPhrase}"</p>}
      </div>

      {/* Plano */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-white rounded-xl border border-sand-200">
        <div>
          <p className="text-sm text-sage-400">Plano atual</p>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${planDetails.color}`}>
            {planDetails.label}
          </span>
        </div>
        {plan !== 'therapeutic-plus' && (
          <button onClick={onNavigatePricing} className="ml-auto flex items-center gap-1 text-sage-600 text-sm hover:underline">
            <TrendingUp className="w-4 h-4" /> Ver planos
          </button>
        )}
        {plan !== 'free' && plan === 'therapeutic-plus' && (
          <Crown className="ml-auto w-5 h-5 text-purple-500" />
        )}
      </div>

      {/* Formulário */}
      <div className="space-y-5 bg-white rounded-xl border border-sand-200 p-6 mb-4">
        <div>
          <label className="block text-sm font-medium text-sage-700 mb-1">E-mail</label>
          <input
            value={user?.email || ''}
            disabled
            className="w-full px-4 py-2 rounded-lg border border-sand-200 bg-stone-50 text-sage-400 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sage-700 mb-1">Nome completo</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-sand-200 focus:ring-2 focus:ring-sage-300 outline-none text-sm"
            placeholder="Seu nome"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sage-700 mb-1">Como gostaria de ser chamado(a)?</label>
          <input
            value={preferredName}
            onChange={e => setPreferredName(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-sand-200 focus:ring-2 focus:ring-sage-300 outline-none text-sm"
            placeholder="Ex: Mari, Rafa, Carol..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sage-700 mb-1">
            Frase de status <span className="text-sage-400 font-normal">(opcional)</span>
          </label>
          <input
            value={statusPhrase}
            onChange={e => setStatusPhrase(e.target.value)}
            maxLength={80}
            className="w-full px-4 py-2 rounded-lg border border-sand-200 focus:ring-2 focus:ring-sage-300 outline-none text-sm"
            placeholder="Ex: Hoje eu estou tentando com calma."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sage-700 mb-1">Frequência de lembretes</label>
          <select
            value={notificationFrequency}
            onChange={e => setNotificationFrequency(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-sand-200 focus:ring-2 focus:ring-sage-300 outline-none text-sm"
          >
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
            <option value="never">Nunca</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-sage-600 text-white py-3 rounded-lg font-medium hover:bg-sage-700 flex items-center justify-center gap-2"
        >
          <Save size={16} />
          {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar alterações'}
        </button>
      </div>

      {/* Alterar senha */}
      <div className="bg-white rounded-xl border border-sand-200 p-6 mb-4">
        <button
          onClick={() => setShowPasswordForm(!showPasswordForm)}
          className="flex items-center gap-2 text-sage-600 hover:text-sage-800 font-medium text-sm"
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
              className="w-full px-4 py-2 rounded-lg border border-sand-200 focus:ring-2 focus:ring-sage-300 outline-none text-sm"
            />
            <button
              onClick={handleChangePassword}
              className="bg-sage-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-sage-800"
            >
              Confirmar nova senha
            </button>
            {passwordMsg && <p className="text-sm text-sage-600">{passwordMsg}</p>}
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-700 py-3 border border-red-200 rounded-xl hover:bg-red-50"
      >
        <LogOut size={16} /> Sair da conta
      </button>
    </div>
  )
}
